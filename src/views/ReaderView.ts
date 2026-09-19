import { ItemView, Menu, Notice, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { AnnotationStore } from '../annotations/AnnotationStore';
import type { PdfHighlight, TargetType } from '../types/contracts';
import { createId } from '../utils/ids';
import { normalizeClientRect } from '../reader/PdfSelectionGeometry';
import { PdfRenderer, scaleToFitWidth, type PdfOutlineEntry } from '../reader/PdfRenderer';
import { TargetService, type CanvasOutlineEntry } from '../targets';
import { CommentPopover } from '../ui/comments/CommentPopover';
import { HighlightList } from '../ui/comments/HighlightList';
import { CropSelectionOverlay, type CropSelectionPayload } from '../ui/crop/CropSelectionOverlay';
import { handleCropDrop, type PreparedCropDrag } from '../ui/crop/CropDragTransport';
import { ExcerptTargetPanel, type ExcerptCard } from '../ui/targets/ExcerptTargetPanel';
import { ReaderSessionState } from '../reader/ReaderSessionState';
import { anchorBelowToolbar, trackToolbarHeight } from '../reader/ReaderChromeMetrics';

export const READER_VIEW_TYPE = 'reading-desk-reader';

export interface ReaderHost {
	createPdfRenderer(): PdfRenderer;
	annotations: AnnotationStore;
	targets: TargetService;
	openFile(path: string): Promise<void>;
	createTarget(type: TargetType): Promise<{ type: TargetType; path: string }>;
	updateProgress(path: string, progress: number): Promise<void>;
	showTarget(path: string, objectId?: string): Promise<void>;
	listTargets(type: TargetType): Promise<Array<{ path: string; label: string }>>;
	prepareCropDrag(input: { pdfPath: string; page: number; rect: PdfHighlight['rects'][number]; target: 'canvas' | 'image'; image: Blob }): Promise<PreparedCropDrag>;
	commitPreparedCrop(dragToken: string, targetPath?: string): Promise<void>;
	discardPreparedCrop(dragToken: string): Promise<void>;
	getReaderLayout(): Promise<'focus' | 'split'>;
	setReaderLayout(layout: 'focus' | 'split'): Promise<void>;
	readExcerptCards(pdfPath: string): Promise<ExcerptCard[]>;
	updateExcerptCard(highlightId: string, patch: { title?: string; folded?: boolean }): Promise<void>;
	openTargetInSplit(path: string, objectId?: string): Promise<void>;
}

export class ReaderView extends ItemView {
	private readonly pdf: PdfRenderer;
	private readonly session = new ReaderSessionState();
	private page = 1;
	private pages = 0;
	private selectedTarget: TargetType = 'canvas';
	private selectedTargetPath = '';
	private layout: 'focus' | 'split' = 'split';
	private outline: PdfOutlineEntry[] = [];
	private pageEl: HTMLElement | null = null;
	private drawer: HTMLElement | null = null;
	private drawerToggle: HTMLButtonElement | null = null;
	private drawerOpen = false;
	private readonly drawerId = createId('rd-highlight-drawer');
	private excerptContainer: HTMLElement | null = null;
	private sourceMissing = false;
	private crop: CropSelectionOverlay | null = null;
	private fitWidthLocked = true;
	private fitObserver: ResizeObserver | null = null;
	private stopToolbarTracking: (() => void) | null = null;
	private pendingFitFrame: number | null = null;
	private lastFittedColumnWidth = 0;
	/** Target paths already populated from the current PDF outline. */
	private readonly outlineSyncedTargets = new Set<string>();
	private readonly comments: CommentPopover;
	private readonly highlightList: HighlightList;
	private readonly excerptPanel: ExcerptTargetPanel;

	constructor(leaf: WorkspaceLeaf, private readonly host: ReaderHost) {
		super(leaf);
		this.pdf = host.createPdfRenderer();
		this.comments = new CommentPopover(this.commentHost());
		this.highlightList = new HighlightList(this.highlightHost());
		this.excerptPanel = new ExcerptTargetPanel({
			readExcerptCards: path => this.host.readExcerptCards(path),
			updateExcerptCard: (id, patch) => this.host.updateExcerptCard(id, patch),
			jumpToExcerpt: highlight => highlight.target
				? this.host.openTargetInSplit(highlight.target.path, highlight.target.objectId)
				: this.focusHighlight(highlight),
			openComment: highlight => this.openCommentForHighlight(highlight)
		});
	}

	getViewType(): string { return READER_VIEW_TYPE; }
	getDisplayText(): string { return this.readerTitle(); }
	getState(): Record<string, unknown> { return { ...this.session.serialize() }; }

	async setState(state: unknown, _result: ViewStateResult): Promise<void> {
		this.session.restore(state);
	}

	async onClose(): Promise<void> {
		this.stopFitWidthObserver();
		this.stopToolbarTracking?.();
		this.stopToolbarTracking = null;
		this.crop?.destroy();
		await this.pdf.close();
	}

	async openPdf(path: string, page = 1): Promise<void> {
		this.session.open(path, page);
		this.sourceMissing = false;
		this.layout = await this.host.getReaderLayout();
		this.pages = await this.pdf.open(path);
		this.outline = await this.pdf.getOutline();
		this.outlineSyncedTargets.clear();
		this.page = Math.min(this.pages, this.session.pageNumber());
		this.session.setPage(this.page);
		await this.render();
	}

	async openPdfAtHighlight(path: string, highlightId: string): Promise<void> {
		await this.openPdf(path);
		const highlight = this.host.annotations.get(highlightId);
		if (highlight) await this.focusHighlight(highlight, false);
	}

	async onOpen(): Promise<void> {
		if (this.activePath() && this.pages === 0) await this.openPdf(this.activePath(), this.session.pageNumber());
		else await this.render();
	}

	/** Updates marks, drawer and target cards without reopening the PDF document. */
	async refreshAnnotations(): Promise<void> {
		const path = this.activePath();
		if (!path || this.sourceMissing) return;
		const highlights = this.host.annotations.list(path);
		if (this.pageEl) {
			this.pdf.updateHighlights(this.pageEl, highlights);
			this.exposeHighlightKeys();
		}
		this.renderDrawer();
		if (this.excerptContainer) await this.excerptPanel.render(this.excerptContainer, path);
	}

	/** Called by the vault rename observer; preserves rendered bytes and current page. */
	async handleSourceRename(oldPath: string, newPath: string): Promise<boolean> {
		const changed = this.session.rename(oldPath, newPath);
		if (changed) await this.refreshAnnotations();
		return changed;
	}

	/** Stops a deleted source from accepting later excerpts against its stale path. */
	async handleSourceDelete(path: string): Promise<boolean> {
		const deleted = this.session.delete(path);
		if (!deleted) return false;
		this.sourceMissing = true;
		this.crop?.destroy();
		this.crop = null;
		this.pages = 0;
		this.page = 1;
		this.outline = [];
		this.outlineSyncedTargets.clear();
		await this.pdf.close();
		await this.render();
		return true;
	}

	private async render(): Promise<void> {
		this.stopFitWidthObserver();
		const root = this.containerEl.children[1] as HTMLElement;
		this.excerptContainer = null;
		// containerEl's children can be replaced between renders, so replaceChildren may miss the previous drawer and leave a stale duplicate sharing the toggle's id.
		this.drawer?.remove();
		this.drawer = null;
		this.drawerToggle = null;
		root.replaceChildren();
		root.className = 'rd-reader';
		if (!this.activePath()) {
			const missing = this.sourceMissing;
			root.createEl('p', { cls: missing ? 'rd-error' : 'rd-empty', text: missing ? '源 PDF 已删除，无法继续摘录。请从书架重新选择文件。' : '从书架选择一本 PDF 开始阅读。', attr: { role: missing ? 'alert' : 'status' } });
			return;
		}
		root.createEl('h1', { cls: 'rd-reader-title rd-visually-hidden', text: this.readerTitle() });
		const toolbar = root.createDiv({ cls: 'rd-reader-toolbar' });
		this.button(toolbar, '缩小', () => this.changeScale(-0.15));
		this.button(toolbar, '放大', () => this.changeScale(0.15));
		this.button(toolbar, '适应宽度', () => this.fitWidth());
		this.drawerToggle = this.button(toolbar, '高亮列表', () => this.toggleDrawer());
		this.drawerToggle.setAttribute('aria-controls', this.drawerId);
		this.drawerToggle.setAttribute('aria-expanded', String(this.drawerOpen));
		this.button(toolbar, '裁剪', () => this.enterCropMode());
		this.button(toolbar, this.layout === 'split' ? '专注阅读' : '分栏目标', () => void this.toggleLayout());
		const target = toolbar.createEl('select', { attr: { 'aria-label': '摘录目标类型' } });
		for (const type of ['canvas', 'excalidraw', 'markdown'] as TargetType[]) target.createEl('option', { value: type, text: targetName(type) });
		target.value = this.selectedTarget;
		target.addEventListener('change', () => { this.selectedTarget = target.value as TargetType; this.selectedTargetPath = ''; void this.render(); });
		this.createColorPalette(toolbar);
		const previous = this.button(toolbar, '上一页', () => void this.goTo(this.page - 1));
		previous.disabled = this.page <= 1;
		const input = toolbar.createEl('input', { type: 'number', value: String(this.page), attr: { min: '1', max: String(Math.max(this.pages, 1)), 'aria-label': '页码' } });
		input.disabled = this.pages === 0;
		input.addEventListener('change', () => void this.goTo(input.value.trim() === '' ? this.page : Number(input.value)));
		toolbar.createEl('span', { cls: 'rd-page-count', text: `/ ${this.pages}` });
		const next = this.button(toolbar, '下一页', () => void this.goTo(this.page + 1));
		next.disabled = this.page >= Math.max(this.pages, 1);
		this.stopToolbarTracking?.();
		this.stopToolbarTracking = trackToolbarHeight(root, toolbar);

		const body = root.createDiv({ cls: ['rd-reader-body', `rd-reader-body--${this.layout}`] });
		this.pageEl = body.createDiv({ cls: 'rd-pdf-page-host', attr: { role: 'region', tabindex: '0', 'aria-label': `PDF 第 ${this.page} 页` } });
		this.pageEl.addEventListener('contextmenu', event => this.openSelectionMenu(event));
		this.pageEl.addEventListener('keydown', event => this.handlePageHostKeys(event));
		this.pageEl.addEventListener('dblclick', event => this.jumpFromHighlight(event));
		this.pageEl.addEventListener('click', event => this.openComment(event));
		this.pageEl.addEventListener('dragstart', event => this.beginExcerptDrag(event));
		// The panel must be present before the first PDF measurement. Otherwise a
		// one-column render is retained after the grid shrinks to split mode.
		if (this.layout === 'split') body.append(this.createTargetPanel());
		const highlights = this.host.annotations.list(this.activePath());
		this.pageEl.createEl('p', { cls: 'rd-loading', text: '正在渲染页面…', attr: { role: 'status' } });
		try {
			await this.pdf.renderPage(this.page, this.pageEl, highlights);
			await this.fitRenderedPageToHost(highlights);
			this.exposeHighlightKeys();
			await this.host.updateProgress(this.activePath(), this.pages ? this.page / this.pages : 0);
		} catch (error) {
			console.error('[Reading Desk] PDF 页面渲染失败', error);
			this.pageEl.replaceChildren();
			this.pageEl.createEl('p', { cls: 'rd-error', text: 'PDF 页面载入失败。请回到书架重新打开该文件，或重新扫描书库后再试。', attr: { role: 'alert' } });
		}
		this.startFitWidthObserver(body);
		this.drawer = root.createDiv({ cls: 'rd-highlight-drawer', attr: { id: this.drawerId } });
		this.renderDrawer();
		this.syncDrawerState();
	}

	private button(parent: HTMLElement, label: string, action: () => void): HTMLButtonElement {
		const button = parent.createEl('button', { text: label, cls: 'rd-button' });
		button.type = 'button';
		button.addEventListener('click', action);
		return button;
	}

	private createColorPalette(parent: HTMLElement): void {
		const group = document.createElement('div');
		group.className = 'rd-toolbar-palette';
		group.setAttribute('role', 'group');
		group.setAttribute('aria-label', '摘录颜色');
		for (const [color, label] of [['moss', '苔'], ['amber', '琥'], ['brick', '砖'], ['indigo', '靛'], ['plum', '梅']] as Array<[PdfHighlight['color'], string]>) {
			const button = this.button(group, label, () => void this.createExcerptFromSelection(color));
			button.addEventListener('mousedown', event => event.preventDefault());
			button.classList.add(`rd-swatch--${color}`);
			button.title = `以${label}色摘录选中文本`;
			button.setAttribute('aria-label', `以${label}色摘录选中文本`);
		}
		parent.append(group);
	}

	private async goTo(page: number): Promise<void> {
		const requested = Number.isFinite(page) ? Math.round(page) : this.page;
		const bounded = Math.max(1, Math.min(Math.max(this.pages, 1), requested));
		if (requested !== bounded) new Notice(`页码超出范围，已改为第 ${bounded} 页。`);
		this.page = bounded;
		this.session.setPage(this.page);
		await this.render();
	}

	private async changeScale(delta: number): Promise<void> {
		this.fitWidthLocked = false;
		this.pdf.setScale(this.pdf.getScale() + delta);
		await this.render();
	}

	private async fitWidth(): Promise<void> {
		this.fitWidthLocked = true;
		await this.fitRenderedPageToHost(this.host.annotations.list(this.activePath()), true);
	}

	private async fitRenderedPageToHost(highlights: PdfHighlight[], force = false): Promise<void> {
		const pageEl = this.pageEl;
		if (!this.fitWidthLocked || !pageEl) return;
		await afterLayout(pageEl);
		const availableWidth = pageEl.clientWidth;
		const renderedWidth = Math.max(pageEl.scrollWidth, this.pdf.getRenderedViewport()?.width ?? 0);
		if (availableWidth <= 0 || renderedWidth <= 0) return;
		const nextScale = scaleToFitWidth(this.pdf.getScale(), renderedWidth, availableWidth);
		if (!force && Math.abs(nextScale - this.pdf.getScale()) < 0.005) {
			this.lastFittedColumnWidth = availableWidth;
			return;
		}
		this.pdf.setScale(nextScale);
		await this.pdf.renderPage(this.page, this.pageEl, highlights);
		this.exposeHighlightKeys();
		await afterLayout(pageEl);
		this.lastFittedColumnWidth = pageEl.clientWidth;
	}

	private startFitWidthObserver(body: HTMLElement): void {
		if (typeof ResizeObserver === 'undefined') return;
		this.fitObserver = new ResizeObserver(() => {
			if (!this.fitWidthLocked || !this.pageEl || Math.abs(this.pageEl.clientWidth - this.lastFittedColumnWidth) < 1) return;
			this.scheduleFitWidth();
		});
		this.fitObserver.observe(body);
	}

	private scheduleFitWidth(): void {
		if (this.pendingFitFrame !== null || !this.pageEl) return;
		const view = this.pageEl.ownerDocument.defaultView;
		if (!view) return;
		this.pendingFitFrame = view.requestAnimationFrame(() => {
			this.pendingFitFrame = null;
			void this.fitRenderedPageToHost(this.host.annotations.list(this.activePath()));
		});
	}

	private stopFitWidthObserver(): void {
		this.fitObserver?.disconnect();
		this.fitObserver = null;
		if (this.pendingFitFrame !== null) {
			this.pageEl?.ownerDocument.defaultView?.cancelAnimationFrame(this.pendingFitFrame);
			this.pendingFitFrame = null;
		}
		this.lastFittedColumnWidth = 0;
	}
	private toggleDrawer(): void {
		this.drawerOpen = !this.drawerOpen;
		this.syncDrawerState();
	}

	private syncDrawerState(): void {
		if (!this.drawer || !this.drawerToggle) return;
		this.drawer.classList.toggle('is-hidden', !this.drawerOpen);
		this.drawerToggle.setAttribute('aria-expanded', String(this.drawerOpen));
		const toolbar = this.containerEl.children[1]?.querySelector<HTMLElement>('.rd-reader-toolbar');
		if (toolbar) anchorBelowToolbar(this.drawer, toolbar);
	}

	private enterCropMode(): void {
		if (!this.pageEl) return;
		this.crop?.destroy();
		this.crop = new CropSelectionOverlay(this.pageEl, {
			page: this.page - 1,
			host: {
				prepareCrop: payload => this.prepareCropDrag(payload),
				commitPreparedCrop: token => this.host.commitPreparedCrop(token),
				discardPreparedCrop: token => this.host.discardPreparedCrop(token),
				onCancel: () => { this.crop = null; }
			}
		});
	}

	private renderDrawer(): void {
		if (!this.drawer) return;
		this.highlightList.render(this.drawer, { highlights: this.host.annotations.list(this.activePath()) });
	}

	private openSelectionMenu(event?: MouseEvent): void {
		const selection = window.getSelection()?.toString().trim() ?? '';
		if (!selection) {
			if (event) return;
			new Notice('请先选择 PDF 原文，再按 Enter 打开摘录菜单。');
			return;
		}
		event?.preventDefault();
		const menu = new Menu();
		for (const type of ['canvas', 'markdown', 'excalidraw'] as TargetType[]) {
			menu.addItem(item => item.setTitle(`添加到${targetName(type)}`).onClick(() => this.createExcerpt(selection, type)));
		}
		if (event) menu.showAtMouseEvent(event);
		else if (this.pageEl) {
			const bounds = this.pageEl.getBoundingClientRect();
			menu.showAtPosition({ x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + bounds.height / 2) });
		}
	}

	/** Keyboard path for the page host: Enter mirrors the right-click excerpt menu. */
	private handlePageHostKeys(event: KeyboardEvent): void {
		if (event.key !== 'Enter') return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, a, input, select, textarea')) return;
		event.preventDefault();
		this.openSelectionMenu();
	}

	private async createExcerpt(text: string, type = this.selectedTarget, color: PdfHighlight['color'] = 'moss', frozenRects?: PdfHighlight['rects']): Promise<void> {
		if (!this.pageEl) return;
		const selection = window.getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		if (!range && !frozenRects) return;
		const viewport = await this.pageViewport();
		if (!viewport) return;
		const bounds = this.pageEl.getBoundingClientRect();
		const rects = frozenRects ?? Array.from(range?.getClientRects() ?? []).map(rect => normalizeClientRect(rect, bounds, viewport));
		if (!rects.length) return;
		const highlight: PdfHighlight = {
			id: createId('highlight'), pdfPath: this.activePath(), page: this.page - 1, rotation: viewport.rotation, rects, text,
			color, chapterPath: this.chapterForPage(this.page - 1), tags: [], createdAt: Date.now(), updatedAt: Date.now()
		};
		const target = this.selectedTargetPath && type === this.selectedTarget
			? { type, path: this.selectedTargetPath }
			: await this.host.createTarget(type);
		if (target.type === 'canvas') await this.syncOutlineForTarget(target.path);
		const written = await this.host.targets.writeExcerpt(target, highlight);
		highlight.target = written.target;
		if (type === this.selectedTarget) this.selectedTargetPath = target.path;
		await this.host.annotations.save(highlight);
		selection?.removeAllRanges();
		await this.render();
	}

	private async createExcerptFromSelection(color: PdfHighlight['color']): Promise<void> {
		const text = window.getSelection()?.toString().trim() ?? '';
		if (!text) { new Notice('请先选择 PDF 原文。'); return; }
		try {
			await this.createExcerpt(text, this.selectedTarget, color);
		} catch (error) {
			console.error('[Reading Desk] 创建摘录失败', error);
			new Notice('创建摘录失败。请确认目标文档可用，然后重试一次。');
		}
	}

	private async prepareCropDrag(payload: CropSelectionPayload): Promise<PreparedCropDrag> {
		const pdfPath = this.activePath();
		if (!pdfPath) throw new Error('没有可裁剪的 PDF。');
		const image = await this.pdf.renderCrop(payload.rect);
		return this.host.prepareCropDrag({ pdfPath, page: payload.page, rect: payload.rect, target: payload.target, image });
	}

	private async toggleLayout(): Promise<void> {
		this.layout = this.layout === 'split' ? 'focus' : 'split';
		await this.host.setReaderLayout(this.layout);
		await this.render();
	}

	private createTargetPanel(): HTMLElement {
		const panel = document.createElement('aside');
		panel.className = 'rd-target-panel';
		panel.setAttribute('aria-label', '摘录目标面板');
		const heading = document.createElement('h2');
		heading.textContent = '摘录目标';
		panel.append(heading);
		const select = document.createElement('select');
		select.setAttribute('aria-label', '选择已有目标文档');
		select.append(new Option('正在加载已有目标…', ''));
		const openTarget = this.button(panel, '打开实际目标', () => {
			if (this.selectedTargetPath) void this.host.openTargetInSplit(this.selectedTargetPath);
		});
		openTarget.disabled = !this.selectedTargetPath;
		select.addEventListener('change', () => {
			openTarget.disabled = !select.value;
			void this.selectTargetPath(select.value);
		});
		void this.host.listTargets(this.selectedTarget).then(targets => {
			select.replaceChildren();
			if (targets.length === 0) select.append(new Option('暂无已有目标，创建摘录时会自动生成', ''));
			else {
				select.append(new Option('选择已有目标…', ''));
				for (const target of targets) select.append(new Option(target.label, target.path));
			}
			select.value = this.selectedTargetPath;
			openTarget.disabled = !this.selectedTargetPath;
		}).catch(() => {
			select.replaceChildren();
			select.append(new Option('目标列表加载失败，仍可直接创建摘录', ''));
			openTarget.disabled = true;
		});
		panel.append(select);
		panel.append(openTarget);
		const description = document.createElement('p');
		description.textContent = '将选中文本拖到此处，或使用右键和色盘创建摘录。';
		panel.append(description);
		const excerpts = document.createElement('section');
		excerpts.setAttribute('aria-label', 'Reading Desk 摘录卡片');
		panel.append(excerpts);
		this.excerptContainer = excerpts;
		void this.excerptPanel.render(excerpts, this.activePath());
		panel.addEventListener('dragover', event => event.preventDefault());
		panel.addEventListener('drop', event => void this.dropOnTargetPanel(event));
		return panel;
	}

	private async dropOnTargetPanel(event: DragEvent): Promise<void> {
		const canvasTargetPath = this.selectedTarget === 'canvas' ? this.selectedTargetPath || undefined : undefined;
		if (await handleCropDrop(event, canvasTargetPath, (token, path) => this.host.commitPreparedCrop(token, path))) return;
		event.preventDefault();
		const text = event.dataTransfer?.getData('text/plain').trim() ?? '';
		const rects = parseDraggedRects(event.dataTransfer?.getData('application/x-reading-desk-rects') ?? '');
		if (text && rects) await this.createExcerpt(text, this.selectedTarget, 'moss', rects);
	}

	/** Selects a concrete target and eagerly creates its complete Canvas outline. */
	private async selectTargetPath(path: string): Promise<void> {
		this.selectedTargetPath = path;
		if (!path || this.selectedTarget !== 'canvas') return;
		try {
			await this.syncOutlineForTarget(path);
		} catch (error) {
			new Notice(error instanceof Error ? `无法同步 Canvas 目录：${error.message}` : '无法同步 Canvas 目录。');
		}
	}

	/**
	 * Canvas chapters are target-scoped and source-scoped.  Caching here avoids
	 * a second transform when selection is followed by excerpt creation; the
	 * TargetService remains the authoritative idempotency guard.
	 */
	private async syncOutlineForTarget(targetPath: string): Promise<void> {
		const pdfPath = this.activePath();
		if (!pdfPath || !this.outline.length) return;
		const key = `${pdfPath}\u0000${targetPath}`;
		if (this.outlineSyncedTargets.has(key)) return;
		await this.host.targets.syncOutline(targetPath, pdfPath, this.outline as readonly CanvasOutlineEntry[]);
		this.outlineSyncedTargets.add(key);
		console.info('[Reading Desk] Canvas outline synchronized', { pdfPath, targetPath, chapterCount: this.outline.length });
	}

	private beginExcerptDrag(event: DragEvent): void {
		const text = window.getSelection()?.toString().trim() ?? '';
		if (!text || !event.dataTransfer) return;
		const range = window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0) : null;
		const viewport = this.pdf.getRenderedViewport();
		const bounds = this.pageEl?.getBoundingClientRect();
		if (!range || !viewport || !bounds) return;
		const rects = Array.from(range.getClientRects()).map(rect => normalizeClientRect(rect, bounds, viewport));
		event.dataTransfer.setData('text/plain', text);
		event.dataTransfer.setData('application/x-reading-desk-rects', JSON.stringify(rects));
		event.dataTransfer.effectAllowed = 'copy';
	}

	private async pageViewport(): Promise<{ width: number; height: number; viewBox: number[]; rotation: number; convertToPdfPoint(x: number, y: number): number[]; convertToViewportPoint(x: number, y: number): number[] } | null> {
		return this.pdf.getRenderedViewport();
	}

	private async focusHighlight(highlight: PdfHighlight, openTarget = true): Promise<void> {
		await this.goTo(highlight.page + 1);
		const reduced = this.pageEl?.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
		this.pageEl?.querySelector<HTMLElement>(`[data-highlight-id="${highlight.id}"]`)?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
		if (openTarget && highlight.target) await this.host.showTarget(highlight.target.path, highlight.target.objectId);
	}

	private async jumpFromHighlight(event: MouseEvent): Promise<void> {
		const mark = (event.target as HTMLElement).closest<HTMLElement>('[data-highlight-id]');
		if (!mark) return;
		await this.jumpToHighlightTarget(mark.dataset.highlightId ?? '');
	}

	private async jumpToHighlightTarget(id: string): Promise<void> {
		const highlight = this.host.annotations.get(id);
		if (highlight?.target) await this.host.showTarget(highlight.target.path, highlight.target.objectId);
	}

	/** Makes rendered highlight marks focusable and gives Enter and Space the double-click jump path. */
	private exposeHighlightKeys(): void {
		const pageEl = this.pageEl;
		if (!pageEl) return;
		for (const mark of Array.from(pageEl.querySelectorAll<HTMLElement>('[data-highlight-id]'))) {
			mark.tabIndex = 0;
			if (mark.dataset.rdKeysBound === 'true') continue;
			mark.dataset.rdKeysBound = 'true';
			mark.addEventListener('keydown', event => {
				if (event.target !== mark || (event.key !== 'Enter' && event.key !== ' ')) return;
				event.preventDefault();
				event.stopPropagation();
				void this.jumpToHighlightTarget(mark.dataset.highlightId ?? '');
			});
		}
	}

	private openComment(event: MouseEvent): void {
		const button = (event.target as HTMLElement).closest<HTMLElement>('.rd-highlight-comment-button');
		if (!button) return;
		const highlight = this.host.annotations.get(button.dataset.highlightId ?? '');
		if (!highlight) return;
		void this.openCommentForHighlight(highlight, button, false);
	}

	/** Opens the shared comment state from either a PDF mark or a target card. */
	private async openCommentForHighlight(highlight: PdfHighlight, anchor?: HTMLElement, jumpToPage = true): Promise<void> {
		if (jumpToPage && highlight.page !== this.page - 1) await this.goTo(highlight.page + 1);
		const commentAnchor = anchor
			?? this.pageEl?.querySelector<HTMLElement>(`[data-highlight-id="${highlight.id}"]`)
			?? this.pageEl;
		if (!commentAnchor) return;
		const ownerDocument = commentAnchor.ownerDocument;
		const view = ownerDocument.defaultView;
		if (!view) return;
		const host = ownerDocument.createElement('div');
		host.className = 'rd-comment-popover-host reading-desk-shell';
		if (ownerDocument.body.classList.contains('theme-dark') || ownerDocument.documentElement.classList.contains('theme-dark')) host.classList.add('theme-dark');
		ownerDocument.body.append(host);		this.drawerOpen = false;
		this.syncDrawerState();
		this.comments.open(host, {
			highlight,
			onClose: () => { host.remove(); commentAnchor.focus(); }
		});
		const anchorBounds = commentAnchor.getBoundingClientRect();
		const popoverBounds = host.getBoundingClientRect();
		const margin = 16;
		const left = Math.max(margin, Math.min(anchorBounds.right + 8, view.innerWidth - popoverBounds.width - margin));
		const top = Math.max(margin, Math.min(anchorBounds.top, view.innerHeight - popoverBounds.height - margin));
		Object.assign(host.style, { left: `${left}px`, top: `${top}px` });
		host.querySelector<HTMLElement>('.rd-comment-popover')?.focus();
	}

	private commentHost() {
		return {
			comments: (id: string) => this.host.annotations.comments(id),
			allTags: () => this.host.annotations.allTags(),
			addComment: async (id: string, content: string) => { await this.host.annotations.addComment(id, content, 'pdf'); },
			deleteComment: async (id: string, commentId: string) => { await this.host.annotations.deleteComment(id, commentId); },
			setTags: async (id: string, tags: string[]) => { await this.host.annotations.setTags(id, tags); },
			...this.excerptHostActions()
		};
	}

	private highlightHost() { return this.excerptHostActions(); }

	private excerptHostActions() {
		return {
			recolorHighlight: async (id: string, color: PdfHighlight['color']) => { await this.recolorHighlight(id, color); },
			deleteHighlight: async (id: string) => { const highlight = this.host.annotations.get(id); if (highlight?.target) await this.host.targets.deleteExcerpt(highlight.target, id); await this.host.annotations.remove(id); await this.render(); },
			jumpToHighlight: (highlight: PdfHighlight) => this.focusHighlight(highlight)
		};
	}

	private activePath(): string { return this.session.path(); }

	private readerTitle(): string { const path = this.activePath(); return path ? `阅读：${path.split('/').pop()}` : 'Reading Desk 阅读器'; }

	private async recolorHighlight(id: string, color: PdfHighlight['color']): Promise<void> {
		const highlight = this.host.annotations.get(id);
		if (!highlight) return;
		await this.host.annotations.recolor(id, color);
		const updated = this.host.annotations.get(id);
		if (updated?.target) await this.host.targets.writeExcerpt(updated.target, updated);
		await this.render();
	}

	private chapterForPage(page: number): string[] {
		const candidates = this.outline.filter(entry => entry.page <= page).sort((left, right) => right.page - left.page || right.path.length - left.path.length);
		return candidates[0]?.path ?? [];
	}
}

function targetName(type: TargetType): string { return type === 'canvas' ? 'Canvas' : type === 'excalidraw' ? 'Excalidraw' : 'Markdown'; }

function parseDraggedRects(value: string): PdfHighlight['rects'] | null {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every(rect => typeof rect?.x === 'number' && typeof rect?.y === 'number' && typeof rect?.width === 'number' && typeof rect?.height === 'number') ? parsed : null;
	} catch { return null; }
}

function afterLayout(element: HTMLElement): Promise<void> {
	return new Promise(resolve => {
		const view = element.ownerDocument.defaultView;
		if (view) view.requestAnimationFrame(() => resolve());
		else resolve();
	});
}
