import type { PdfHighlight } from '../../types/contracts';
import {
	colorLabel,
	createButton,
	createConfirmDelete,
	errorMessage,
	HIGHLIGHT_COLORS,
	HighlightListHost,
	setBusy,
	targetLabel,
	watchSwatchContrast
} from './CommentUiTypes';

export interface HighlightListState {
	highlights: readonly PdfHighlight[];
	currentPage: number;
	scope: HighlightListScope;
	loading?: boolean;
	error?: string;
}

export type HighlightListScope = 'book' | 'page';

export function filterHighlights(highlights: readonly PdfHighlight[], scope: HighlightListScope, currentPage: number): PdfHighlight[] {
	return scope === 'page' ? highlights.filter(highlight => highlight.page === currentPage) : [...highlights];
}

const FAILURE_NEXT_STEP = '请重试；若持续失败，请重新打开阅读视图。';

/** A reusable, host-driven highlighter drawer with explicit empty/loading/error states. */
export class HighlightList {
	private container: HTMLElement | null = null;
	private state: HighlightListState = { highlights: [], currentPage: 0, scope: 'book' };
	private actionError = '';
	private stopSwatchWatcher: (() => void) | null = null;
	private liveRegion: HTMLParagraphElement | null = null;

	constructor(private readonly host: HighlightListHost) { }

	render(container: HTMLElement, state: HighlightListState): void {
		this.container = container;
		this.state = { ...state, highlights: [...state.highlights] };
		this.actionError = '';
		this.renderCurrent();
	}

	private renderCurrent(): void {
		if (!this.container) return;
		this.stopSwatchWatcher?.();
		this.stopSwatchWatcher = null;
		const root = document.createElement('section');
		root.className = 'rd-highlight-list';
		root.setAttribute('aria-label', '高亮列表');
		const heading = document.createElement('h3');
		heading.textContent = '高亮列表';
		root.append(heading);
		if (!this.state.error) {
			if (this.state.loading) {
				root.append(this.renderMessage('rd-loading', '正在加载高亮…', 'status'));
			} else {
				const visible = filterHighlights(this.state.highlights, this.state.scope, this.state.currentPage);
				root.append(this.renderScopeControls(visible.length));
				if (!this.state.highlights.length) {
					root.append(this.renderMessage('rd-empty', '本书还没有高亮。选中 PDF 正文并创建高亮后，它会显示在这里。', 'status'));
				} else if (!visible.length) {
					const empty = this.renderMessage('rd-empty rd-highlight-list__page-empty', `第 ${this.state.currentPage + 1} 页没有高亮。`, 'status');
					empty.append(createButton('查看本书全部', 'rd-link', () => this.host.setScope('book')));
					root.append(empty);
				} else {
				const list = document.createElement('ol');
				list.className = 'rd-highlight-list__items';
				for (const highlight of visible) list.append(this.renderRow(highlight));
				root.append(list);
				}
			}
		}
		root.append(this.liveMessageNode());
		this.container.replaceChildren(root);
		this.setLiveMessage(this.failureText());
		this.stopSwatchWatcher = watchSwatchContrast(root);
	}

	private renderScopeControls(visibleCount: number): HTMLElement {
		const controls = document.createElement('div');
		controls.className = 'rd-highlight-list__scope';
		const group = document.createElement('div');
		group.className = 'rd-highlight-list__scope-buttons';
		group.setAttribute('role', 'group');
		group.setAttribute('aria-label', '高亮显示范围');
		for (const [scope, label] of [['book', '本书全部'], ['page', '当前页']] as const) {
			const button = createButton(label, 'rd-button', () => this.host.setScope(scope));
			button.setAttribute('aria-pressed', String(this.state.scope === scope));
			group.append(button);
		}
		const count = document.createElement('span');
		count.className = 'rd-highlight-list__count';
		count.setAttribute('role', 'status');
		count.setAttribute('aria-live', 'polite');
		count.textContent = `当前显示 ${visibleCount} / ${this.state.highlights.length} 条`;
		controls.append(group, count);
		return controls;
	}

	/**
	 * The alert node survives renders and is mutated in place: replacing a
	 * live-region node on every state change often silences announcements.
	 */
	private liveMessageNode(): HTMLParagraphElement {
		if (!this.liveRegion) {
			this.liveRegion = document.createElement('p');
			this.liveRegion.className = 'rd-error';
			this.liveRegion.setAttribute('role', 'alert');
		}
		return this.liveRegion;
	}

	private failureText(): string {
		if (this.actionError) return `操作失败：${this.actionError}。${FAILURE_NEXT_STEP}`;
		if (this.state.error) return `高亮加载失败：${this.state.error}。${FAILURE_NEXT_STEP}`;
		return '';
	}

	private setLiveMessage(text: string): void {
		if (this.liveRegion && this.liveRegion.textContent !== text) this.liveRegion.textContent = text;
	}

	private renderRow(highlight: PdfHighlight): HTMLElement {
		const row = document.createElement('li');
		row.className = 'rd-highlight-row';
		row.dataset.highlightId = highlight.id;
		const color = document.createElement('span');
		color.className = `rd-color-dot rd-color-${highlight.color}`;
		color.setAttribute('role', 'img');
		color.setAttribute('aria-label', `颜色：${colorLabel(highlight.color)}`);
		row.append(color);
		const target = document.createElement('span');
		target.className = 'rd-highlight-row__target';
		target.textContent = targetLabel(highlight);
		row.append(target);
		const jump = createButton(highlight.text || '未命名高亮', 'rd-link rd-highlight-row__jump', async () => {
			await this.run(() => this.host.jumpToHighlight(highlight), [jump]);
		});
		jump.setAttribute('aria-label', `跳转到高亮：${highlight.text || '未命名高亮'}`);
		row.append(jump);
		const tags = document.createElement('span');
		tags.className = 'rd-highlight-row__tags';
		for (const tag of highlight.tags) {
			const tagEl = document.createElement('span');
			tagEl.className = 'rd-tag';
			tagEl.textContent = tag;
			tags.append(tagEl);
		}
		row.append(tags);
		const copy = createButton('复制原文链接', 'rd-button rd-highlight-row__copy', async () => {
			await this.run(() => this.host.copyHighlightLink(highlight), [copy]);
		});
		row.append(copy);
		const swatchButtons: HTMLButtonElement[] = [];
		const swatches = document.createElement('div');
		swatches.className = 'rd-swatch-group';
		swatches.setAttribute('role', 'group');
		swatches.setAttribute('aria-label', '更改高亮颜色');
		for (const option of HIGHLIGHT_COLORS) {
			const button = createButton(`选择${option.label}高亮色`, `rd-swatch rd-swatch--${option.value}`, async () => {
				await this.run(() => this.host.recolorHighlight(highlight.id, option.value), swatchButtons);
			});
			// Visible short colour label; the full action stays the accessible name.
			button.textContent = option.label;
			// Recomputed on every repaint so the pressed state tracks the applied colour.
			button.setAttribute('aria-pressed', String(option.value === highlight.color));
			button.dataset.color = option.value;
			swatches.append(button);
			swatchButtons.push(button);
		}
		row.append(swatches);
		// Deleting a highlight also deletes its linked target excerpt.
		const deletion = createConfirmDelete('删除此高亮', 'rd-button rd-highlight-row__delete', '确认删除此高亮', async () => {
			await this.run(() => this.host.deleteHighlight(highlight.id));
		});
		row.append(deletion.confirm, deletion.cancel);
		return row;
	}

	private renderMessage(className: string, text: string, role: string): HTMLElement {
		const message = document.createElement('p');
		message.className = className;
		message.setAttribute('role', role);
		message.textContent = text;
		return message;
	}

	private async run(operation: () => Promise<void> | void, controls: HTMLButtonElement[] = []): Promise<void> {
		for (const control of controls) setBusy(control, true);
		try {
			this.actionError = '';
			await operation();
			this.renderCurrent();
		} catch (error) {
			// Mutate the mounted alert instead of re-rendering so the live
			// region is not replaced while the failure is being announced.
			this.actionError = errorMessage(error);
			this.setLiveMessage(this.failureText());
		} finally {
			for (const control of controls) setBusy(control, false);
		}
	}
}
