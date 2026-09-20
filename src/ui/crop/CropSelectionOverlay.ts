import type { NormalizedPdfRect } from '../../types/contracts';
import {
	clampCropRect,
	denormalizeCropRect,
	isCropRectLargeEnough,
	normalizeCropRect,
	type CropPageBounds,
	type CropPoint
} from './CropGeometry';
import {
	cancelPreparedCrop,
	createCropDragPayload,
	type CropDragPayload,
	type PreparedCropDrag,
	writeCropDragPayload
} from './CropDragTransport';

export type CropTargetKind = 'canvas' | 'image' | 'markdown';
export type CropOverlayState = 'ready' | 'loading' | 'disabled' | 'error';

export interface CropSelectionPayload {
	/** Zero-based PDF page index, matching persisted annotation coordinates. */
	page: number;
	rect: NormalizedPdfRect;
	target: CropTargetKind;
}

export interface CropSelectionOverlayHost {
	/** Renders the selected PDF region and retains the real bytes behind a token. */
	prepareCrop(payload: CropSelectionPayload): Promise<PreparedCropDrag>;
	/** Writes a previously prepared crop for the keyboard/button alternative. */
	commitPreparedCrop(dragToken: string): Promise<void> | void;
	/** Releases a token which the user cancels or reselects before dropping. */
	discardPreparedCrop?(dragToken: string): Promise<void> | void;
	onCancel?(): void;
}

export interface CropSelectionOverlayOptions {
	/** Zero-based PDF page index. ReaderView callers should pass currentPage - 1. */
	page: number;
	host: CropSelectionOverlayHost;
	getPageBounds?: () => CropPageBounds;
	defaultTarget?: CropTargetKind;
	state?: CropOverlayState;
	message?: string;
}

const STATUS_ID = 'rd-crop-status';
const SELECTION_ACTIVE_CLASS = 'rd-crop-selection--active';
const KEYBOARD_FINE_STEP = 0.02;
const KEYBOARD_COARSE_STEP = 0.1;
const KEYBOARD_PREVIEW_DELAY_MS = 220;
const DEFAULT_KEYBOARD_RECT: NormalizedPdfRect = { x: 0.32, y: 0.38, width: 0.36, height: 0.24 };
const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

/**
 * A DOM-only crop selector. It creates no target on pointer-up: the host must
 * first return a token for a real renderer-produced bitmap, which is then
 * draggable to a Canvas target or committed through the button alternative.
 *
 * Presentation (position, chrome, colors, focus rings) lives in styles.css.
 * This class only writes live geometry (selection pixel offsets) and state
 * attributes; keyboard users seed a default selection and adjust it with the
 * arrow keys because pointer drawing is not keyboard reachable.
 */
export class CropSelectionOverlay {
	private readonly root: HTMLElement;
	private readonly selection: HTMLElement;
	private readonly controls: HTMLElement;
	private readonly status: HTMLElement;
	private readonly targetInput: HTMLSelectElement;
	private readonly submitButton: HTMLButtonElement;
	private readonly dragHandle: HTMLButtonElement;
	private state: CropOverlayState;
	private selectedRect: NormalizedPdfRect | null = null;
	private prepared: PreparedCropDrag | null = null;
	private startPoint: CropPoint | null = null;
	private activePointerId: number | null = null;
	private keyboardPreviewTimer: number | null = null;
	private destroyed = false;

	constructor(private readonly pageHost: HTMLElement, private readonly options: CropSelectionOverlayOptions) {
		this.state = options.state ?? 'ready';
		this.root = this.createRoot();
		this.selection = this.createSelection();
		this.status = this.createStatus();
		this.controls = this.createControls();
		this.targetInput = this.createTargetInput();
		this.submitButton = this.makeButton('创建裁剪对象', () => void this.createCrop());
		this.dragHandle = this.createDragHandle();
		this.makeButton('重新框选', () => this.clearSelection('请在 PDF 页面上重新框选，或按 Enter 创建默认选区。'));
		this.makeButton('取消裁剪', () => this.cancel());
		this.root.append(this.selection, this.status, this.controls);
		this.pageHost.append(this.root);
		this.bindEvents();
		this.setState(this.state, options.message);
	}

	setState(state: CropOverlayState, message?: string): void {
		this.state = state;
		const disabled = state === 'loading' || state === 'disabled';
		this.root.dataset.cropState = state;
		this.root.setAttribute('aria-disabled', String(disabled));
		this.root.setAttribute('aria-busy', String(state === 'loading'));
		this.root.classList.toggle('is-disabled', disabled);
		this.submitButton.disabled = disabled || !this.prepared;
		this.submitButton.classList.toggle('is-disabled', disabled);
		this.targetInput.disabled = disabled;
		this.targetInput.classList.toggle('is-disabled', disabled);
		this.controls.toggleAttribute('hidden', !this.selectedRect);
		this.dragHandle.hidden = !this.prepared || this.targetInput.value !== 'canvas';
		// The status node is created once and only mutated in place so that
		// screen readers keep announcing updates from the same live region.
		this.status.textContent = message ?? this.defaultMessage(state);
		this.status.setAttribute('role', state === 'error' ? 'alert' : 'status');
		this.status.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
	}

	destroy(): void {
		this.destroyed = true;
		this.clearKeyboardPreviewTimer();
		this.discardPreparedCrop();
		this.root.remove();
	}

	private createRoot(): HTMLElement {
		const root = element('div', 'rd-crop-overlay');
		root.setAttribute('role', 'group');
		root.setAttribute('aria-label', 'PDF 裁剪区域选择');
		root.setAttribute('aria-describedby', STATUS_ID);
		// Tabbable so keyboard users can reach the crop surface; the arrow key
		// flow in handleKeydown replaces pointer drawing for them.
		root.tabIndex = 0;
		return root;
	}

	private createSelection(): HTMLElement {
		const selection = element('div', 'rd-crop-selection');
		selection.setAttribute('aria-hidden', 'true');
		return selection;
	}

	private createStatus(): HTMLElement {
		const status = element('div', 'rd-crop-status');
		status.id = STATUS_ID;
		status.setAttribute('role', 'status');
		status.setAttribute('aria-live', 'polite');
		return status;
	}

	private createControls(): HTMLElement {
		const controls = element('div', 'rd-crop-controls');
		controls.setAttribute('data-crop-control', 'true');
		return controls;
	}

	private createTargetInput(): HTMLSelectElement {
		const label = element('label');
		label.textContent = '创建到';
		label.setAttribute('data-crop-control', 'true');
		const input = document.createElement('select');
		// rd-button supplies the shared control chrome and focus ring; the
		// crop class lets styles.css adjust select specific presentation.
		input.className = 'rd-button rd-crop-target-select';
		input.setAttribute('aria-label', '裁剪目标类型');
		input.setAttribute('data-crop-control', 'true');
		input.append(option('canvas', 'Canvas 图片卡片'), option('image', '图片目标'), option('markdown', 'Markdown 文档'));
		input.value = this.options.defaultTarget ?? 'canvas';
		input.addEventListener('change', () => {
			this.discardPreparedCrop();
			this.setState('ready', '目标已变更，正在重新准备真实裁剪预览。');
			void this.prepareSelectedCrop();
		});
		label.append(input);
		this.controls.append(label);
		return input;
	}

	private makeButton(label: string, action: () => void): HTMLButtonElement {
		const button = element('button', 'rd-button') as HTMLButtonElement;
		button.textContent = label;
		button.type = 'button';
		button.setAttribute('data-crop-control', 'true');
		button.addEventListener('click', action);
		this.controls.append(button);
		return button;
	}

	private createDragHandle(): HTMLButtonElement {
		const handle = element('button', 'rd-crop-drag-handle') as HTMLButtonElement;
		handle.type = 'button';
		handle.draggable = true;
		handle.hidden = true;
		handle.textContent = '拖到 Canvas';
		handle.setAttribute('data-crop-control', 'true');
		handle.setAttribute('aria-label', '拖动真实裁剪预览到 Canvas 目标');
		handle.addEventListener('dragstart', event => this.beginCropDrag(event));
		this.selection.append(handle);
		return handle;
	}

	private bindEvents(): void {
		this.root.addEventListener('pointerdown', event => this.beginSelection(event));
		this.root.addEventListener('pointermove', event => this.updateSelection(event));
		this.root.addEventListener('pointerup', event => this.finishSelection(event));
		this.root.addEventListener('pointercancel', event => this.finishSelection(event));
		this.root.addEventListener('keydown', event => this.handleKeydown(event));
	}

	private beginSelection(event: PointerEvent): void {
		if (!this.canSelect() || event.button !== 0 || this.isControlTarget(event.target)) return;
		event.preventDefault();
		this.startPoint = { x: event.clientX, y: event.clientY };
		this.activePointerId = event.pointerId;
		this.root.setPointerCapture(event.pointerId);
		this.status.textContent = '正在框选裁剪区域。';
		this.updateDraft({ x: event.clientX, y: event.clientY });
	}

	private updateSelection(event: PointerEvent): void {
		if (event.pointerId !== this.activePointerId || !this.startPoint) return;
		event.preventDefault();
		this.updateDraft({ x: event.clientX, y: event.clientY });
	}

	private finishSelection(event: PointerEvent): void {
		if (event.pointerId !== this.activePointerId || !this.startPoint) return;
		const bounds = this.pageBounds();
		const rect = normalizeCropRect(this.startPoint, { x: event.clientX, y: event.clientY }, bounds);
		this.releasePointer(event.pointerId);
		this.startPoint = null;
		if (!isCropRectLargeEnough(rect, bounds)) {
			this.clearSelection('选区过小；请至少框选 8 × 8 像素的页面区域。');
			return;
		}
		this.discardPreparedCrop();
		this.selectedRect = clampCropRect(rect);
		this.renderSelection(this.selectedRect);
		this.setState('ready', '已选择裁剪区域，正在生成真实裁剪预览。');
		void this.prepareSelectedCrop();
	}

	private handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			this.cancel();
			return;
		}
		if (this.isControlTarget(event.target) || !ARROW_KEYS.includes(event.key) || !this.canSelect()) return;
		event.preventDefault();
		if (!this.selectedRect) {
			this.seedSelection();
			return;
		}
		const step = event.shiftKey ? KEYBOARD_COARSE_STEP : KEYBOARD_FINE_STEP;
		if (event.altKey) this.resizeSelection(event.key, step);
		else this.moveSelection(event.key, step);
	}

	private seedSelection(): void {
		this.applyKeyboardRect(clampCropRect({ ...DEFAULT_KEYBOARD_RECT }), '已创建默认选区。方向键移动选区，Alt 加方向键调整边缘，Shift 加大步长。');
	}

	private moveSelection(key: string, step: number): void {
		const rect = this.selectedRect;
		if (!rect) return;
		const offset = this.keyboardOffset(key, step);
		this.applyKeyboardRect(clampCropRect({ ...rect, x: rect.x + offset.x, y: rect.y + offset.y }), '选区已移动。');
	}

	private resizeSelection(key: string, step: number): void {
		const rect = this.selectedRect;
		if (!rect) return;
		// Left and Right adjust the right edge; Up and Down adjust the bottom edge.
		let width = rect.width;
		let height = rect.height;
		if (key === 'ArrowLeft') width = rect.width - step;
		else if (key === 'ArrowRight') width = rect.width + step;
		else if (key === 'ArrowUp') height = rect.height - step;
		else height = rect.height + step;
		const next = clampCropRect({ ...rect, width: Math.max(0, width), height: Math.max(0, height) });
		if (!isCropRectLargeEnough(next, this.pageBounds())) {
			this.setState('ready', '选区过小，已保持原选区；请按相反方向调整。');
			return;
		}
		this.applyKeyboardRect(next, '选区边缘已调整。');
	}

	private applyKeyboardRect(rect: NormalizedPdfRect, message: string): void {
		this.discardPreparedCrop();
		this.selectedRect = rect;
		this.renderSelection(rect);
		this.setState('ready', `${message}${this.describeBounds()}`);
		this.scheduleKeyboardPreview();
	}

	private keyboardOffset(key: string, step: number): CropPoint {
		if (key === 'ArrowLeft') return { x: -step, y: 0 };
		if (key === 'ArrowRight') return { x: step, y: 0 };
		if (key === 'ArrowUp') return { x: 0, y: -step };
		return { x: 0, y: step };
	}

	private describeBounds(): string {
		const rect = this.selectedRect;
		if (!rect) return '';
		const percent = (value: number): string => `${Math.round(value * 100)}%`;
		return `当前选区：左 ${percent(rect.x)}，上 ${percent(rect.y)}，宽 ${percent(rect.width)}，高 ${percent(rect.height)}。`;
	}

	private scheduleKeyboardPreview(): void {
		this.clearKeyboardPreviewTimer();
		this.keyboardPreviewTimer = window.setTimeout(() => {
			this.keyboardPreviewTimer = null;
			void this.prepareSelectedCrop();
		}, KEYBOARD_PREVIEW_DELAY_MS);
	}

	private clearKeyboardPreviewTimer(): void {
		if (this.keyboardPreviewTimer !== null) {
			window.clearTimeout(this.keyboardPreviewTimer);
			this.keyboardPreviewTimer = null;
		}
	}

	private async createCrop(): Promise<void> {
		if (!this.selectedRect || this.state === 'loading' || this.state === 'disabled') return;
		if (!this.prepared) await this.prepareSelectedCrop();
		if (!this.prepared) return;
		this.setState('loading', '正在创建真实裁剪对象。');
		try {
			await this.options.host.commitPreparedCrop(this.prepared.dragToken);
			this.consumePreparedCrop();
			this.clearSelection('裁剪对象已创建。', false);
		} catch (error) {
			this.setState('error', `无法创建裁剪对象${cropFailureHint(error)}。请检查目标与存储配置后重试。`);
		}
	}

	private async prepareSelectedCrop(): Promise<void> {
		if (!this.selectedRect || this.state === 'disabled' || this.destroyed) return;
		const payload = this.cropPayload();
		this.setState('loading', '正在生成真实裁剪预览，尚未写入文件。');
		try {
			const prepared = await this.options.host.prepareCrop(payload);
			if (this.destroyed || !this.matchesCurrentSelection(payload)) {
				void this.options.host.discardPreparedCrop?.(prepared.dragToken);
				return;
			}
			if (!prepared.dragToken.trim()) throw new Error('裁剪预览没有返回可提交的拖放标识。');
			this.prepared = prepared;
			this.renderDragPreview(prepared);
			this.setState('ready', prepared.previewUrl
				? '真实裁剪预览已就绪。可拖到 Canvas，或按创建裁剪对象。'
				: '真实裁剪数据已就绪。可拖到 Canvas，或按创建裁剪对象。');
		} catch (error) {
			if (this.destroyed) return;
			this.setState('error', `无法生成真实裁剪预览${cropFailureHint(error)}。请检查 PDF 页面后重试。`);
		}
	}

	private beginCropDrag(event: DragEvent): void {
		if (!event.dataTransfer || !this.prepared || !this.selectedRect || this.targetInput.value !== 'canvas') {
			event.preventDefault();
			return;
		}
		writeCropDragPayload(event.dataTransfer, this.cropDragPayload());
		const preview = this.dragHandle.querySelector<HTMLImageElement>('img');
		if (preview) event.dataTransfer.setDragImage(preview, preview.width / 2, preview.height / 2);
		this.status.textContent = '正在拖动真实裁剪预览到 Canvas 目标。';
	}

	private renderDragPreview(prepared: PreparedCropDrag): void {
		this.dragHandle.replaceChildren();
		if (prepared.previewUrl) {
			const image = document.createElement('img');
			image.className = 'rd-crop-drag-preview';
			image.src = prepared.previewUrl;
			image.alt = '已生成的 PDF 裁剪预览';
			this.dragHandle.append(image);
		} else {
			this.dragHandle.textContent = '拖到 Canvas';
		}
	}

	private cancel(): void {
		this.options.host.onCancel?.();
		this.destroy();
	}

	private clearSelection(message: string, discardPrepared = true): void {
		if (discardPrepared) this.discardPreparedCrop();
		this.selectedRect = null;
		this.selection.classList.remove(SELECTION_ACTIVE_CLASS);
		this.setState('ready', message);
	}

	private updateDraft(current: CropPoint): void {
		if (this.startPoint) this.renderSelection(normalizeCropRect(this.startPoint, current, this.pageBounds()));
	}

	private renderSelection(rect: NormalizedPdfRect): void {
		const rendered = denormalizeCropRect(rect, this.localPageBounds());
		this.selection.classList.add(SELECTION_ACTIVE_CLASS);
		// Live geometry only: the border, background and pointer behavior come
		// from styles.css through the active modifier class.
		this.selection.style.left = `${rendered.left}px`;
		this.selection.style.top = `${rendered.top}px`;
		this.selection.style.width = `${rendered.width}px`;
		this.selection.style.height = `${rendered.height}px`;
	}

	private cropPayload(): CropSelectionPayload {
		return { page: this.options.page, rect: this.selectedRect ?? { x: 0, y: 0, width: 0, height: 0 }, target: this.targetInput.value as CropTargetKind };
	}

	private cropDragPayload(): CropDragPayload {
		return createCropDragPayload(
			this.prepared?.dragToken ?? '', this.options.page,
			this.selectedRect ?? { x: 0, y: 0, width: 0, height: 0 }, this.targetInput.value as CropTargetKind, this.prepared?.mimeType
		);
	}

	private matchesCurrentSelection(payload: CropSelectionPayload): boolean {
		return payload.target === this.targetInput.value && payload.rect === this.selectedRect;
	}

	private discardPreparedCrop(): void {
		const prepared = this.prepared;
		this.prepared = null;
		this.dragHandle?.replaceChildren();
		void cancelPreparedCrop(prepared?.dragToken, this.options.host.discardPreparedCrop);
	}

	private consumePreparedCrop(): void {
		this.prepared = null;
		this.dragHandle.replaceChildren();
	}

	private pageBounds(): CropPageBounds {
		return this.options.getPageBounds?.() ?? this.pageHost.getBoundingClientRect();
	}

	private localPageBounds(): CropPageBounds {
		const bounds = this.pageBounds();
		return { left: 0, top: 0, width: bounds.width, height: bounds.height };
	}

	private releasePointer(pointerId: number): void {
		if (this.root.hasPointerCapture(pointerId)) this.root.releasePointerCapture(pointerId);
		this.activePointerId = null;
	}

	private canSelect(): boolean {
		return this.state === 'ready' || this.state === 'error';
	}

	private isControlTarget(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && target.closest('[data-crop-control]') !== null;
	}

	private defaultMessage(state: CropOverlayState): string {
		if (state === 'loading') return '正在准备裁剪。';
		if (state === 'disabled') return '裁剪当前不可用。请先打开可渲染的 PDF 页面。';
		if (state === 'error') return '裁剪发生错误。请调整选区后重试。';
		return '在 PDF 页面上拖拽框选要裁剪的区域；也可按 Tab 聚焦后用方向键框选。';
	}
}

/**
 * Maps an internal failure to a short, user meaningful hint. The raw
 * exception text is never shown; only permission and path problems survive,
 * because those are the details a reader can actually act on.
 */
function cropFailureHint(error: unknown): string {
	const raw = error instanceof Error ? error.message : '';
	if (/EACCES|EPERM|permission denied/i.test(raw)) return '（存储位置没有写入权限）';
	if (/ENOENT|no such file|not found/i.test(raw)) return '（存储位置不存在或已被移动）';
	return '';
}

function element(tagName: string, className?: string): HTMLElement {
	const value = document.createElement(tagName);
	if (className) value.className = className;
	return value;
}

function option(value: string, label: string): HTMLOptionElement {
	const item = document.createElement('option');
	item.value = value;
	item.textContent = label;
	return item;
}
