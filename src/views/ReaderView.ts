import { ItemView, Menu, Notice, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { AnnotationStore } from '../annotations/AnnotationStore';
import type { PdfHighlight, TargetType } from '../types/contracts';
import { createId } from '../utils/ids';
import { normalizeClientRect } from '../reader/PdfSelectionGeometry';
import { PdfRenderer, type PdfOutlineEntry } from '../reader/PdfRenderer';
import { TargetService, type CanvasOutlineEntry } from '../targets';
import { CommentPopover } from '../ui/comments/CommentPopover';
import { HighlightList } from '../ui/comments/HighlightList';
import { CropSelectionOverlay, type CropSelectionPayload } from '../ui/crop/CropSelectionOverlay';
import { handleCropDrop, type PreparedCropDrag } from '../ui/crop/CropDragTransport';
import { ExcerptTargetPanel, type ExcerptCard } from '../ui/targets/ExcerptTargetPanel';
import { ReaderSessionState } from '../reader/ReaderSessionState';
import { afterLayout, anchorBelowToolbar, trackToolbarHeight } from '../reader/ReaderChromeMetrics';
import { targetTypeLabel } from '../ui/targets/TargetUiTypes';
import { parseDraggedHighlightRects } from '../reader/ReaderDragTransport';
import { executeCopyReaderPage } from '../reader/ReaderCopyCommand';
import { ReaderHighlightCoordinator, type HighlightScope } from '../reader/ReaderHighlightCoordinator';
import { boundVisiblePage } from '../reader/ReaderPageNavigation';
import { ReaderNavigation, type OutlineLoadState, type ReaderNavigationMode } from '../reader/ReaderNavigation';
import { observeReaderDensity } from '../reader/ReaderResponsive';
import { closeReaderTargetPanel, toggleReaderTargetPanel } from '../ui/targets/ReaderTargetDisclosure';
import { revealCreatedCanvasTarget } from '../reader/ReaderTargetHandoff';
import { availableFitExtent, FitFrameScheduler, fitInsets, fitScale, observeReaderFit, type ReaderFitMode } from '../reader/ReaderFit';
import { TargetPanelDisclosure } from '../ui/targets/TargetPanelDisclosure';
import { ReaderOutlineLoader } from '../reader/ReaderOutlineLoader';
import { createReaderToolbar } from '../reader/ReaderToolbar';
import { ReaderOpenRequests } from '../reader/ReaderOpenRequests';
import { openReaderDocument } from '../reader/ReaderDocumentOpen';
import { ReaderViewLifecycle } from '../reader/ReaderViewLifecycle';

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
	readExcerptCards(pdfPath: string): Promise<ExcerptCard[]>;
	updateExcerptCard(highlightId: string, patch: { title?: string; folded?: boolean }): Promise<void>;
	openTargetInSplit(path: string, objectId?: string): Promise<void>;
	copyPageLink(path: string, page: number): Promise<void>;
	copyHighlightLink(highlight: PdfHighlight): Promise<void>;
	openNavigation(): Promise<void>;
}

export class ReaderView extends ItemView {
	private pdf: PdfRenderer;
	private readonly session = new ReaderSessionState();
	private page = 1;
	private pages = 0;
	private selectedTarget: TargetType = 'canvas';
	private selectedTargetPath = '';
	private outline: PdfOutlineEntry[] = [];
	private outlineState: OutlineLoadState = 'ready';
	private outlineError = '';
	private pageEl: HTMLElement | null = null;
	private pdfStage: HTMLElement | null = null;
	private readerBody: HTMLElement | null = null;
	private readerNavigation: ReaderNavigation | null = null;
	private navigationMode: ReaderNavigationMode = 'thumbnails';
	private navigationContainer: HTMLElement | null = null;
	private drawer: HTMLElement | null = null;
	private drawerToggle: HTMLButtonElement | null = null;
	private drawerOpen = false;
	private readonly drawerId = createId('rd-highlight-drawer');
	private excerptContainer: HTMLElement | null = null;
	private sourceMissing = false;
	private crop: CropSelectionOverlay | null = null;
	private fitMode: ReaderFitMode = 'width';
	private stopFitTracking: (() => void) | null = null;
	private stopDensityObserver: (() => void) | null = null;
	private stopToolbarTracking: (() => void) | null = null;
	private fitScheduler: FitFrameScheduler | null = null;
	private lastFittedHostSize = 0;
	private targetPanel: HTMLElement | null = null;
	private targetDisclosure: TargetPanelDisclosure | null = null;
	private readonly targetPanelId = createId('rd-target-panel');
	private readonly outlineSyncedTargets = new Set<string>();
	private readonly outlineLoader = new ReaderOutlineLoader();
	private readonly openRequests = new ReaderOpenRequests();
	private readonly lifecycle = new ReaderViewLifecycle();
	private readonly comments: CommentPopover;
	private readonly highlightList: HighlightList;
	private readonly excerptPanel: ExcerptTargetPanel;
	private readonly highlightCoordinator: ReaderHighlightCoordinator;
	constructor(leaf: WorkspaceLeaf, private readonly host: ReaderHost) {
		super(leaf);
		this.pdf = host.createPdfRenderer();
		this.highlightCoordinator = new ReaderHighlightCoordinator(id => this.jumpToHighlightTarget(id));
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
		await this.lifecycle.onState(this.session.serialize(), (path, page) => this.openPdf(path, page));
	}
	async onClose(): Promise<void> {
		this.lifecycle.close();
		this.openRequests.invalidate();
		this.outlineLoader.invalidate();
		this.highlightCoordinator.close();
		this.readerNavigation?.destroy();
		this.readerNavigation = null;
		this.navigationContainer = null;
		this.stopFitWidthObserver();
		this.stopToolbarTracking?.();
		this.stopToolbarTracking = null;
		this.stopDensityObserver?.();
		this.stopDensityObserver = null;
		this.crop?.destroy();
		await this.pdf.close();
	}
	async openPdf(path: string, page = 1): Promise<void> {
		const request = this.openRequests.begin(path);
		this.outlineLoader.invalidate();
		const opened = await openReaderDocument(path, this.host.createPdfRenderer(), this.pdf, () => this.openRequests.isCurrent(request));
		if (!opened) return;
		this.pdf = opened.renderer;
		this.session.open(request.path, page);
		this.lifecycle.markLoaded(request.path, page);
		this.sourceMissing = false;
		this.pages = opened.pages;
		this.outline = [];
		this.outlineState = 'loading';
		this.outlineError = '';
		const outline = this.outlineLoader.load(this.pdf.getOutline());
		this.outlineSyncedTargets.clear();
		const bounded = boundVisiblePage(this.session.pageNumber(), this.pages);
		this.page = bounded.page;
		if (bounded.notice) new Notice(bounded.notice);
		this.session.setPage(this.page);
		await this.render();
		const loadedOutline = await outline;
		if (!loadedOutline) return;
		if (!loadedOutline.error) {
			this.outline = loadedOutline.entries;
			this.outlineState = 'ready';
		} else {
			console.error('[Reading Desk] PDF 目录载入失败', loadedOutline.error);
			this.outlineState = 'error';
			this.outlineError = 'PDF 目录载入失败，可切换到缩略图继续导航。';
		}
		this.readerNavigation?.setOutline(this.outline, this.outlineState, this.outlineError);
	}

	async openPdfAtHighlight(path: string, highlightId: string): Promise<void> {
		await this.openPdf(path);
		const highlight = this.host.annotations.get(highlightId);
		if (highlight) await this.focusHighlight(highlight, false);
	}

	async onOpen(): Promise<void> {
		await this.lifecycle.onOpen(this.session.serialize(), (path, page) => this.openPdf(path, page));
		if (!this.activePath()) await this.render();
	}

	/** Updates marks, drawer and target cards without reopening the PDF document. */
	async refreshAnnotations(): Promise<void> {
		const path = this.activePath();
		if (!path || this.sourceMissing) return;
		const highlights = this.host.annotations.list(path);
		if (this.pageEl) {
			this.pdf.updateHighlights(this.pageEl, highlights);
		}
		this.renderDrawer();
		this.bindHighlightPreview();
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
		this.openRequests.invalidate();
		this.outlineLoader.invalidate();
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
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.readerNavigation?.destroy();
		this.readerNavigation = null;
		this.highlightCoordinator.close();
		const root = this.containerEl.children[1] as HTMLElement;
		this.excerptContainer = null;
		this.targetPanel = null;
		this.targetDisclosure = null;
		// containerEl's children can be replaced between renders, so replaceChildren may miss the previous drawer and leave a stale duplicate sharing the toggle's id.
		this.drawer?.remove();
		this.drawer = null;
		this.drawerToggle = null;
		root.replaceChildren();
		root.className = 'rd-reader';
		this.stopDensityObserver?.();
		this.stopDensityObserver = observeReaderDensity(root);
		if (!this.activePath()) {
			const missing = this.sourceMissing;
			root.createEl('p', { cls: missing ? 'rd-error' : 'rd-empty', text: missing ? '源 PDF 已删除，无法继续摘录。请从书架重新选择文件。' : '从书架选择一本 PDF 开始阅读。', attr: { role: missing ? 'alert' : 'status' } });
			return;
		}
		root.createEl('h1', { cls: 'rd-reader-title rd-visually-hidden', text: this.readerTitle() });
		const toolbar = root.createDiv({ cls: 'rd-reader-toolbar' });
		const controls = createReaderToolbar(toolbar, {
			page: this.page, pages: this.pages, selectedTarget: this.selectedTarget,
			onTargetChange: target => { this.selectedTarget = target; this.selectedTargetPath = ''; void this.render(); },
			onZoomOut: () => void this.changeScale(-0.15), onZoomIn: () => void this.changeScale(0.15),
			onFitWidth: () => void this.fitWidth(), onFitHeight: () => void this.fitHeight(),
			onToggleHighlights: () => this.toggleDrawer(), onCrop: () => this.enterCropMode(),
			onToggleTargetPanel: () => this.toggleTargetPanel(root),
			onColor: color => void this.createExcerptFromSelection(color), onGoToPage: page => this.goTo(page),
			onCopyPage: () => void executeCopyReaderPage(this, message => new Notice(message)),
			onOpenNavigation: () => void this.host.openNavigation()
		});
		this.drawerToggle = controls.drawerToggle;
		this.drawerToggle.setAttribute('aria-controls', this.drawerId);
		this.drawerToggle.setAttribute('aria-expanded', String(this.drawerOpen));
		this.targetDisclosure = new TargetPanelDisclosure(controls.targetPanelToggle, this.targetPanelId);
		controls.copyPage.disabled = this.pages === 0;
		this.stopToolbarTracking?.();
		this.stopToolbarTracking = trackToolbarHeight(root, toolbar);

		const body = root.createDiv({ cls: 'rd-reader-body' });
		this.readerBody = body;
		this.pdfStage = body.createDiv({ cls: 'rd-pdf-stage' });
		this.pageEl = this.pdfStage.createDiv({ cls: 'rd-pdf-page-host', attr: { role: 'region', tabindex: '0', 'aria-label': `PDF 第 ${this.page} 页` } });
		this.pageEl.addEventListener('contextmenu', event => this.openSelectionMenu(event));
		this.pageEl.addEventListener('keydown', event => this.handlePageHostKeys(event));
		this.pageEl.addEventListener('dblclick', event => this.jumpFromHighlight(event));
		this.pageEl.addEventListener('click', event => this.openComment(event));
		this.pageEl.addEventListener('dragstart', event => this.beginExcerptDrag(event));
		const highlights = this.host.annotations.list(this.activePath());
		this.pageEl.createEl('p', { cls: 'rd-loading', text: '正在渲染页面…', attr: { role: 'status' } });
		try {
			await this.pdf.renderPage(this.page, this.pageEl, highlights);
			await this.fitRenderedPageToHost(highlights);
			await this.host.updateProgress(this.activePath(), this.pages ? this.page / this.pages : 0);
		} catch (error) {
			console.error('[Reading Desk] PDF 页面渲染失败', error);
			this.pageEl.replaceChildren();
			this.pageEl.createEl('p', { cls: 'rd-error', text: 'PDF 页面载入失败。请回到书架重新打开该文件，或重新扫描书库后再试。', attr: { role: 'alert' } });
		}
		this.startFitObserver(body);
		if (this.navigationContainer) this.attachNavigation(this.navigationContainer);
		this.drawer = root.createDiv({ cls: 'rd-highlight-drawer', attr: { id: this.drawerId } });
		this.renderDrawer();
		this.syncDrawerState();
		this.bindHighlightPreview();
	}
	attachNavigation(container: HTMLElement): void {
		this.navigationContainer = container;
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.readerNavigation?.destroy();
		this.readerNavigation = new ReaderNavigation(this.pdf, this.pages, () => this.page, page => this.goTo(page), this.navigationMode);
		this.readerNavigation.setOutline(this.outline, this.outlineState, this.outlineError);
		this.readerNavigation.render(container);
	}
	detachNavigation(container: HTMLElement): void {
		if (this.navigationContainer !== container) return;
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.readerNavigation?.destroy();
		this.readerNavigation = this.navigationContainer = null;
	}
	async copyCurrentPageLink(): Promise<void> {
		const path = this.activePath();
		if (!path || this.pages === 0) throw new Error('当前没有可复制的 PDF 页面。');
		await this.host.copyPageLink(path, this.page);
	}
	canCopyCurrentPage(): boolean { return !!this.activePath() && this.pages > 0; }
	private async goTo(page: number): Promise<void> {
		const bounded = boundVisiblePage(Number.isFinite(page) ? page : this.page, this.pages);
		if (bounded.notice) new Notice(bounded.notice);
		this.page = bounded.page;
		this.session.setPage(this.page);
		await this.render();
	}
	private async changeScale(delta: number): Promise<void> {
		this.fitMode = 'manual';
		this.pdf.setScale(this.pdf.getScale() + delta);
		await this.render();
	}
	private async fitWidth(): Promise<void> {
		this.fitMode = 'width';
		await this.fitRenderedPageToHost(this.host.annotations.list(this.activePath()), true);
	}
	private async fitHeight(): Promise<void> {
		this.fitMode = 'height';
		await this.fitRenderedPageToHost(this.host.annotations.list(this.activePath()), true);
	}
	private async fitRenderedPageToHost(highlights: PdfHighlight[], force = false): Promise<void> {
		const pageEl = this.pageEl;
		const stage = this.pdfStage;
		const body = this.readerBody;
		if (this.fitMode === 'manual' || !pageEl || !stage || !body) return;
		await afterLayout(pageEl);
		const viewport = this.pdf.getRenderedViewport();
		if (!viewport) return;
		const insets = fitInsets(stage);
		const available = availableFitExtent(this.fitMode, stage, body, insets);
		const nextScale = fitScale(this.fitMode, this.pdf.getScale(), viewport, stage, body, insets);
		if (!force && Math.abs(nextScale - this.pdf.getScale()) < 0.005) {
			this.lastFittedHostSize = available;
			return;
		}
		this.pdf.setScale(nextScale);
		await this.pdf.renderPage(this.page, this.pageEl, highlights);
		this.bindHighlightPreview();
		await afterLayout(pageEl);
		this.lastFittedHostSize = availableFitExtent(this.fitMode, stage, body, fitInsets(stage));
	}

	private startFitObserver(body: HTMLElement): void {
		this.stopFitTracking = observeReaderFit(body, () => {
			if (this.fitMode === 'manual' || !this.pdfStage || !this.readerBody) return 0;
			return availableFitExtent(this.fitMode, this.pdfStage, this.readerBody, fitInsets(this.pdfStage));
		}, () => {
			const view = this.pageEl?.ownerDocument.defaultView;
			if (view) (this.fitScheduler ??= new FitFrameScheduler(view)).schedule(() => void this.fitRenderedPageToHost(this.host.annotations.list(this.activePath())));
		});
	}

	private stopFitWidthObserver(): void {
		this.stopFitTracking?.();
		this.stopFitTracking = null;
		this.fitScheduler?.stop();
		this.fitScheduler = null;
		this.lastFittedHostSize = 0;
	}
	private toggleDrawer(): void {
		this.drawerOpen = !this.drawerOpen;
		this.syncDrawerState();
	}

	private syncDrawerState(): void {
		if (!this.drawer || !this.drawerToggle) return;
		this.drawer.classList.toggle('is-hidden', !this.drawerOpen);
		this.drawerToggle.setAttribute('aria-expanded', String(this.drawerOpen));
		if (!this.drawerOpen) this.highlightCoordinator.clear();
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
		this.highlightList.render(this.drawer, {
			highlights: this.host.annotations.list(this.activePath()),
			currentPage: this.page - 1,
			scope: this.highlightCoordinator.getScope()
		});
	}

	private bindHighlightPreview(): void {
		this.highlightCoordinator.bind(this.pageEl, this.drawer);
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
			menu.addItem(item => item.setTitle(`添加到${targetTypeLabel(type)}`).onClick(() => this.createExcerpt(selection, type)));
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
		const viewport = this.pdf.getRenderedViewport();
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
		const reveal = await revealCreatedCanvasTarget(written.target, this.host);
		if (reveal === 'opened') {
			new Notice('已创建 Canvas 卡片。');
		} else if (reveal === 'open-failed') {
			new Notice('Canvas 卡片已创建，但无法自动打开；可从“摘录管理”手动打开。');
		}
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

	private toggleTargetPanel(root: HTMLElement): void {
		const disclosure = this.targetDisclosure;
		if (!disclosure) return;
		toggleReaderTargetPanel(root, disclosure, {
			id: this.targetPanelId,
			selectedPath: this.selectedTargetPath,
			close: () => this.closeTargetPanel(),
			listTargets: () => this.host.listTargets(this.selectedTarget),
			selectPath: path => this.selectTargetPath(path),
			openTarget: () => this.selectedTargetPath ? this.host.openTargetInSplit(this.selectedTargetPath) : Promise.resolve(),
			drop: event => this.dropOnTargetPanel(event),
			renderExcerpts: container => this.excerptPanel.render(container, this.activePath())
		}, (panel, excerpts) => { this.targetPanel = panel; this.excerptContainer = excerpts; }, () => {
			this.targetPanel = null;
			this.excerptContainer = null;
		});
	}

	private closeTargetPanel(): void {
		closeReaderTargetPanel(this.targetDisclosure, this.targetPanel, () => {
			this.targetPanel = null;
			this.excerptContainer = null;
		});
	}

	private async dropOnTargetPanel(event: DragEvent): Promise<void> {
		const canvasTargetPath = this.selectedTarget === 'canvas' ? this.selectedTargetPath || undefined : undefined;
		if (await handleCropDrop(event, canvasTargetPath, (token, path) => this.host.commitPreparedCrop(token, path))) return;
		event.preventDefault();
		const text = event.dataTransfer?.getData('text/plain').trim() ?? '';
		const rects = parseDraggedHighlightRects(event.dataTransfer?.getData('application/x-reading-desk-rects') ?? '');
		if (text && rects) await this.createExcerpt(text, this.selectedTarget, 'moss', rects);
	}

	private async selectTargetPath(path: string): Promise<void> {
		this.selectedTargetPath = path;
		if (!path || this.selectedTarget !== 'canvas') return;
		try {
			await this.syncOutlineForTarget(path);
		} catch (error) {
			new Notice(error instanceof Error ? `无法同步 Canvas 目录：${error.message}` : '无法同步 Canvas 目录。');
		}
	}

	/** Target-scoped cache avoids a second transform; TargetService guards idempotency. */
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

	private highlightHost() {
		return {
			...this.excerptHostActions(),
			copyHighlightLink: (highlight: PdfHighlight) => this.host.copyHighlightLink(highlight),
			setScope: (scope: HighlightScope) => {
				this.highlightCoordinator.setScope(scope);
				this.renderDrawer();
				this.bindHighlightPreview();
			}
		};
	}

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
