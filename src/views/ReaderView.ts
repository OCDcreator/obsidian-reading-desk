import { ItemView, Notice, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { AnnotationStore } from '../annotations/AnnotationStore';
import type { PdfHighlight, TargetType, ViewerSettings } from '../types/contracts';
import { createId } from '../utils/ids';
import { PdfRenderer, type PdfOutlineEntry } from '../reader/PdfRenderer';
import { TargetService, type CanvasOutlineEntry } from '../targets';
import { ReaderCommentBridge } from '../reader/ReaderCommentBridge';
import { type CropSelectionPayload } from '../ui/crop/CropSelectionOverlay';
import { CropLauncher } from '../ui/crop/CropLauncher';
import { handleCropDrop, type PreparedCropDrag } from '../ui/crop/CropDragTransport';
import { ExcerptTargetPanel, type ExcerptCard } from '../ui/targets/ExcerptTargetPanel';
import { ReaderSessionState } from '../reader/ReaderSessionState';
import { anchorBelowToolbar, trackToolbarHeight } from '../reader/ReaderChromeMetrics';
import { parseDraggedHighlightRects } from '../reader/ReaderDragTransport';
import { executeCopyReaderPage } from '../reader/ReaderCopyCommand';
import { ReaderHighlightCoordinator } from '../reader/ReaderHighlightCoordinator';
import { boundVisiblePage } from '../reader/ReaderPageNavigation';
import { ReaderNavigation, type OutlineLoadState, type ReaderNavigationMode } from '../reader/ReaderNavigation';
import { observeReaderDensity } from '../reader/ReaderResponsive';
import { ReaderTargetPanelController } from '../ui/targets/ReaderTargetPanelController';
import { revealCreatedCanvasTarget } from '../reader/ReaderTargetHandoff';
import { type ReaderFitMode } from '../reader/ReaderFit';
import { ReaderFitController } from '../reader/ReaderFitController';
import { TargetPanelDisclosure } from '../ui/targets/TargetPanelDisclosure';
import { ReaderOutlineLoader } from '../reader/ReaderOutlineLoader';
import { type ReaderToolbarControls } from '../reader/ReaderToolbar';
import { bindReaderToolbar } from '../reader/ReaderToolbarBindings';
import { ReaderOpenRequests } from '../reader/ReaderOpenRequests';
import { openReaderDocument } from '../reader/ReaderDocumentOpen';
import { ReaderViewLifecycle } from '../reader/ReaderViewLifecycle';
import { ContinuousPageSurface } from '../reader/ReaderPageDeck';
import { SinglePageSurface, type PageSurface, type PageSurfaceIO } from '../reader/PageSurface';
import { bindReaderPageEvents, type ReaderPageEventDeps } from '../reader/ReaderPageEvents';
import { ReaderDisplayOptions } from '../reader/ReaderDisplayOptions';
import { ReaderHistory } from '../reader/ReaderHistory';
import { ReaderToolsController } from '../reader/ReaderToolsController';
import { selectionRects, writeReaderExcerpt } from '../reader/ReaderExcerptWriter';

export const READER_VIEW_TYPE = 'reading-desk-reader';
export interface ReaderHost {
	createPdfRenderer(): PdfRenderer;
	annotations: AnnotationStore;
	targets: TargetService;
	openFile(path: string): Promise<void>;
	createTarget(type: TargetType): Promise<{ type: TargetType; path: string }>;
	recordProgress(path: string, progress: number): void;
	showTarget(path: string, objectId?: string): Promise<void>;
	listTargets(type: TargetType): Promise<Array<{ path: string; label: string }>>;
	prepareCropDrag(input: { pdfPath: string; page: number; rect: PdfHighlight['rects'][number]; target: 'canvas' | 'image' | 'markdown'; image: Blob }): Promise<PreparedCropDrag>;
	commitPreparedCrop(dragToken: string, targetPath?: string): Promise<void>;
	discardPreparedCrop(dragToken: string): Promise<void>;
	readExcerptCards(pdfPath: string): Promise<ExcerptCard[]>;
	updateExcerptCard(highlightId: string, patch: { title?: string; folded?: boolean }): Promise<void>;
	openTargetInSplit(path: string, objectId?: string): Promise<void>;
	copyPageLink(path: string, page: number): Promise<void>;
	copyHighlightLink(highlight: PdfHighlight): Promise<void>;
	openNavigation(): Promise<void>;
	viewerSettings(): ViewerSettings;
	updateViewerSettings(patch: Partial<ViewerSettings>): Promise<void>;
	openSettings(): Promise<void>;
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
	private surface: PageSurface | null = null;
	private readerBody: HTMLElement | null = null;
	private readerNavigation: ReaderNavigation | null = null;
	private navigationMode: ReaderNavigationMode = 'thumbnails';
	private navigationContainer: HTMLElement | null = null;
	private drawer: HTMLElement | null = null;
	private drawerToggle: HTMLButtonElement | null = null;
	private drawerOpen = false;
	private readonly drawerId = createId('rd-highlight-drawer');

	private sourceMissing = false;
	private cropLauncher = new CropLauncher();
	private fitController: ReaderFitController;
	private stopDensityObserver: (() => void) | null = null;
	private stopToolbarTracking: (() => void) | null = null;
	private targetPanelController: ReaderTargetPanelController;
	private targetDisclosure: TargetPanelDisclosure | null = null;
	private readonly targetPanelId = createId('rd-target-panel');
	private readonly outlineSyncedTargets = new Set<string>();
	private readonly outlineLoader = new ReaderOutlineLoader();
	private readonly openRequests = new ReaderOpenRequests();
	private readonly lifecycle = new ReaderViewLifecycle();
	private readonly bridge: ReaderCommentBridge;
	private readonly excerptPanel: ExcerptTargetPanel;
	private readonly highlightCoordinator: ReaderHighlightCoordinator;
	private readonly history = new ReaderHistory();
	private readonly tools: ReaderToolsController;
	private readonly display: ReaderDisplayOptions;
	private lastColor: PdfHighlight['color'] = 'moss';
	private controls: ReaderToolbarControls | null = null;
	private scannedNoticeShown = false;
	constructor(leaf: WorkspaceLeaf, private readonly host: ReaderHost) {
		super(leaf);
		this.pdf = host.createPdfRenderer();
		this.highlightCoordinator = new ReaderHighlightCoordinator(id => this.jumpToHighlightTarget(id));
		this.bridge = new ReaderCommentBridge({
			annotations: () => this.host.annotations,
			deleteExcerptFor: async id => { const highlight = this.host.annotations.get(id); if (highlight?.target) await this.host.targets.deleteExcerpt(highlight.target, id); await this.host.annotations.remove(id); await this.refreshAnnotations(); },
			recolor: (id, color) => this.recolorHighlight(id, color),
			focusHighlight: highlight => this.focusHighlight(highlight),
			copyHighlightLink: highlight => this.host.copyHighlightLink(highlight),
			onScopeChanged: () => { const scope = this.bridge.drainPendingScope(); if (scope) this.highlightCoordinator.setScope(scope); this.renderDrawer(); this.bindHighlightPreview(); },
			goToPage: page => this.goTo(page, { jump: true }),
			hostForPage: page => this.surface?.hostForPage(page) ?? null,
			collapseDrawer: () => { this.drawerOpen = false; this.syncDrawerState(); }
		});
		this.tools = new ReaderToolsController({
			pdf: () => this.pdf,
			pageCount: () => this.pages,
			goToPage: async page => { await this.goTo(page, { smooth: false }); },
			hostForPage: page => this.surface?.hostForPage(page) ?? null,
			currentPage: () => this.page,
			annotations: () => this.host.annotations,
			activePath: () => this.activePath(),
			refreshAnnotations: () => this.refreshAnnotations(),
			deleteExcerptFor: async highlight => { if (highlight.target) await this.host.targets.deleteExcerpt(highlight.target, highlight.id); },
			removeHighlight: id => this.host.annotations.remove(id),
			createExcerpt: (text, type, color) => this.createExcerpt(text, type, color),
			lastColor: () => this.lastColor,
			selectionText: () => window.getSelection()?.toString().trim() ?? '',
			writeClipboard: text => navigator.clipboard.writeText(text)
		});
		this.excerptPanel = new ExcerptTargetPanel({
			readExcerptCards: path => this.host.readExcerptCards(path),
			updateExcerptCard: (id, patch) => this.host.updateExcerptCard(id, patch),
			jumpToExcerpt: highlight => highlight.target
				? this.host.openTargetInSplit(highlight.target.path, highlight.target.objectId)
				: this.focusHighlight(highlight),
			openComment: highlight => this.bridge.openFor(highlight, undefined, true)
		});
		this.targetPanelController = new ReaderTargetPanelController({
			panelId: this.targetPanelId,
			root: () => this.containerEl.children[1] as HTMLElement,
			disclosure: () => this.targetDisclosure,
			selectedTarget: () => this.selectedTarget,
			selectedTargetPath: () => this.selectedTargetPath,
			onSelectPath: path => { this.selectedTargetPath = path; },
			listTargets: () => this.host.listTargets(this.selectedTarget),
			openTargetInSplit: path => this.host.openTargetInSplit(path),
			commitCropDrop: (event, canvasTargetPath) => handleCropDrop(event, canvasTargetPath, (token, path) => this.host.commitPreparedCrop(token, path)),
			dropExcerpt: event => {
				const text = event.dataTransfer?.getData('text/plain').trim() ?? '';
				const rects = parseDraggedHighlightRects(event.dataTransfer?.getData('application/x-reading-desk-rects') ?? '');
				return text && rects ? this.createExcerpt(text, this.selectedTarget, this.lastColor, rects) : Promise.resolve();
			},
			renderExcerpts: container => this.excerptPanel.render(container, this.activePath()),
			syncOutlineForCanvas: targetPath => this.syncOutlineForTarget(targetPath),
			onNotice: message => new Notice(message)
		});
		this.display = new ReaderDisplayOptions({
			root: () => this.containerEl.children[1] as HTMLElement,
			pdf: () => this.pdf,
			rebuildSurface: () => this.rebuildSurface(),
			updateViewerSettings: patch => this.host.updateViewerSettings(patch)
		});
		this.display.restoreFrom(host.viewerSettings());
		this.fitController = new ReaderFitController({
			pdf: () => this.pdf,
			surface: () => this.surface,
			body: () => this.readerBody,
			page: () => this.page,
			rebindPreviews: () => this.bindHighlightPreview(),
			onScaleChanged: scale => this.controls?.zoomControl.update(scale)
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
		this.fitController.stop();
		this.display.stop();
		this.stopToolbarTracking?.();
		this.stopToolbarTracking = null;
		this.stopDensityObserver?.();
		this.stopDensityObserver = null;
		this.cropLauncher.destroy();
		this.surface?.destroy();
		this.surface = null;
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
		this.tools.resetForDocument();
		this.history.reset();
		this.scannedNoticeShown = false;
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
		// Obsidian may deliver the serialized leaf state right after onOpen; deferring
		// the empty-state paint by one macrotask lets that restore win without flashing.
		if (!this.activePath()) {
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			if (!this.activePath()) await this.render();
		}
	}

	/** Updates marks, drawer and target cards without reopening the PDF document. */
	async refreshAnnotations(): Promise<void> {
		const path = this.activePath();
		if (!path || this.sourceMissing) return;
		this.surface?.repaintHighlights();
		this.renderDrawer();
		this.bindHighlightPreview();
		const excerpts = this.targetPanelController.excerptsContainer();
		if (excerpts) await this.excerptPanel.render(excerpts, path);
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
		this.cropLauncher.destroy();
		this.pages = 0;
		this.page = 1;
		this.outline = [];
		this.outlineSyncedTargets.clear();
		await this.pdf.close();
		await this.render();
		return true;
	}

	private async render(): Promise<void> {
		this.fitController.stop();
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.readerNavigation?.destroy();
		this.readerNavigation = null;
		this.highlightCoordinator.close();
		const root = this.containerEl.children[1] as HTMLElement;
		this.targetPanelController.reset();
		this.targetDisclosure = null;
		this.controls = null;
		// containerEl's children can be replaced between renders, so replaceChildren may miss the previous drawer and leave a stale duplicate sharing the toggle's id.
		this.drawer?.remove();
		this.drawer = null;
		this.drawerToggle = null;
		root.replaceChildren();
		root.className = 'rd-reader';
		this.display.applyInvert();
		this.display.startThemeTracking();
		this.stopDensityObserver?.();
		this.stopDensityObserver = observeReaderDensity(root);
		if (!this.activePath()) {
			const missing = this.sourceMissing;
			root.createEl('p', { cls: missing ? 'rd-error' : 'rd-empty', text: missing ? '源 PDF 已删除，无法继续摘录。请从书架重新选择文件。' : '从书架选择一本 PDF 开始阅读。', attr: { role: missing ? 'alert' : 'status' } });
			return;
		}
		root.createEl('h1', { cls: 'rd-reader-title rd-visually-hidden', text: this.readerTitle() });
		const toolbar = root.createDiv({ cls: 'rd-reader-toolbar' });
		this.controls = bindReaderToolbar(toolbar, {
			page: () => this.page,
			pages: () => this.pages,
			scale: () => this.pdf.getScale(),
			selectedTarget: () => this.selectedTarget,
			scrollMode: () => this.display.scrollMode(),
			invert: () => this.display.invertSetting(),
			canBack: () => this.history.canBack(),
			canForward: () => this.history.canForward(),
			onTargetChange: target => { this.selectedTarget = target; this.selectedTargetPath = ''; void this.render(); },
			applyScale: scale => void this.applyScale(scale),
			zoomStep: delta => void this.applyScale(this.pdf.getScale() + delta),
			fitTo: mode => void this.fitTo(mode),
			rotate: delta => void this.display.rotate(delta),
			changeScrollMode: mode => void this.display.changeScrollMode(mode),
			changeInvert: mode => void this.display.changeInvert(mode),
			navigateHistory: direction => void this.navigateHistory(direction),
			toggleSearch: () => this.tools.toggleSearch(),
			toggleDrawer: () => { this.drawerOpen = !this.drawerOpen; this.syncDrawerState(); },
			enterCropMode: () => void this.enterCropMode(),
			toggleTargetPanel: () => this.targetPanelController.toggle(),
			applyPalette: color => void this.createExcerptFromSelection(color),
			goToPage: page => void this.goTo(page),
			copyPageLink: () => void executeCopyReaderPage(this, message => new Notice(message)),
			copySelectedText: () => void this.copySelectedText(),
			openNavigation: () => void this.host.openNavigation(),
			openSettings: () => void this.host.openSettings()
		});
		this.drawerToggle = this.controls.drawerToggle;
		this.drawerToggle.setAttribute('aria-controls', this.drawerId);
		this.drawerToggle.setAttribute('aria-expanded', String(this.drawerOpen));
		this.targetDisclosure = new TargetPanelDisclosure(this.controls.targetPanelToggle, this.targetPanelId);
		this.controls.copyPage.disabled = this.pages === 0;
		const aux = root.createDiv({ cls: 'rd-reader-aux' });
		this.tools.searchPanel.mount(aux);
		this.stopToolbarTracking?.();
		this.stopToolbarTracking = trackToolbarHeight(root, toolbar);

		const body = root.createDiv({ cls: 'rd-reader-body' });
		this.readerBody = body;
		const surface = this.createSurface();
		body.append(surface.stage);
		bindReaderPageEvents(surface.stage, this.pageEventDeps());
		try {
			await surface.render();
			await this.fitController.refit(true);
			const opened = this.activePath();
			if (opened && this.pages) this.host.recordProgress(opened, this.page / this.pages);
		} catch (error) {
			console.error('[Reading Desk] PDF 页面渲染失败', error);
			body.replaceChildren();
			body.createEl('p', { cls: 'rd-error', text: 'PDF 页面载入失败。请回到书架重新打开该文件，或重新扫描书库后再试。', attr: { role: 'alert' } });
		}
		this.fitController.startObserver();
		if (this.navigationContainer) this.attachNavigation(this.navigationContainer);
		this.drawer = root.createDiv({ cls: 'rd-highlight-drawer', attr: { id: this.drawerId } });
		this.renderDrawer();
		this.syncDrawerState();
		this.bindHighlightPreview();
	}

	private createSurface(): PageSurface {
		this.surface?.destroy();
		const io: PageSurfaceIO = {
			pdf: this.pdf,
			pageCount: this.pages,
			initialPage: this.page,
			callbacks: {
				getHighlights: () => this.host.annotations.list(this.activePath()),
				onPageChange: page => this.handlePageChanged(page),
				onTextSignal: (page, selectable) => this.handleTextSignal(page, selectable)
			}
		};
		this.surface = this.display.scrollMode() === 'continuous' ? new ContinuousPageSurface(io) : new SinglePageSurface(io);
		return this.surface;
	}

	private pageEventDeps(): ReaderPageEventDeps {
		return {
			getHighlight: (id: string) => this.host.annotations.get(id),
			openComment: (highlight: PdfHighlight, anchor: HTMLElement) => void this.bridge.openFor(highlight, anchor, false),
			selectionText: () => window.getSelection()?.toString().trim() ?? '',
			jumpToTarget: (id: string) => void this.jumpToHighlightTarget(id),
			page: (delta: -1 | 1) => void this.goTo(this.page + delta),
			zoom: (delta: number) => void this.applyScale(this.pdf.getScale() + delta),
			fit: (mode: 'width' | 'height' | 'page') => void this.fitTo(mode),
			rotate: (delta: 90 | -90) => void this.display.rotate(delta),
			back: () => void this.navigateHistory(-1),
			forward: () => void this.navigateHistory(1),
			openSearch: () => { this.tools.searchPanel.show(); this.tools.applySearchMarks(); },
			applyZoomFactor: (factor: number) => void this.applyScale(this.pdf.getScale() * factor),
			beginDrag: (event: DragEvent) => this.beginExcerptDrag(event),
			openSelectionMenu: (event: MouseEvent) => this.openSelectionMenu(event)
		};
	}

	attachNavigation(container: HTMLElement): void {
		this.navigationContainer = container;
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.readerNavigation?.destroy();
		this.readerNavigation = new ReaderNavigation(this.pdf, this.pages, () => this.page, page => this.goTo(page, { jump: true }), this.navigationMode, mode => {
			this.navigationMode = mode;
			try { window.localStorage.setItem('reading-desk-nav-mode', mode); } catch { /* Storage can be unavailable in private windows. */ }
		});
		this.readerNavigation.setOutline(this.outline, this.outlineState, this.outlineError);
		this.readerNavigation.render(container);
		this.readerNavigation.revealPage(this.page);
	}
	detachNavigation(container: HTMLElement): void {
		if (this.navigationContainer !== container) return;
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.readerNavigation?.destroy();
		this.readerNavigation = this.navigationContainer = null;
	}
	setPreferredNavigationMode(mode: ReaderNavigationMode): void {
		if (this.navigationMode === mode) return;
		this.navigationMode = mode;
		if (this.navigationContainer) this.attachNavigation(this.navigationContainer);
	}
	async copyCurrentPageLink(): Promise<void> {
		const path = this.activePath();
		if (!path || this.pages === 0) throw new Error('当前没有可复制的 PDF 页面。');
		await this.host.copyPageLink(path, this.page);
	}
	canCopyCurrentPage(): boolean { return !!this.activePath() && this.pages > 0; }
	canCopySelection(): boolean { return this.tools.canCopySelection(); }
	async copySelectedText(): Promise<void> { await this.tools.copySelectedText(); }
	canUndoLastExcerpt(): boolean { return this.tools.canUndoLastExcerpt(); }
	async undoLastExcerpt(): Promise<void> { await this.tools.undoLastExcerpt(); }
	private async goTo(page: number, options?: { jump?: boolean; smooth?: boolean }): Promise<void> {
		const bounded = boundVisiblePage(Number.isFinite(page) ? page : this.page, this.pages);
		if (bounded.notice) new Notice(bounded.notice);
		if (options?.jump) this.history.push({ page: bounded.page });
		this.page = bounded.page;
		this.session.setPage(this.page);
		await this.surface?.goToPage(bounded.page, { smooth: options?.smooth });
		this.handlePageChanged(bounded.page);
	}

	private handlePageChanged(page: number): void {
		if (page !== this.page) {
			this.page = page;
			this.session.setPage(page);
		}
		this.history.replace({ page: this.page });
		this.controls?.pageControl.update(this.page, this.pages);
		this.controls?.updateHistory(this.history.canBack(), this.history.canForward());
		this.readerNavigation?.revealPage(this.page);
		const path = this.activePath();
		if (path && this.pages) this.host.recordProgress(path, this.page / this.pages);
	}

	private handleTextSignal(page: number, selectable: boolean): void {
		if (selectable || this.scannedNoticeShown) return;
		this.scannedNoticeShown = true;
		new Notice(`第 ${page} 页没有可选文本，可能是扫描版。可以使用工具栏「裁剪」把图表摘录为图片。`);
	}

	private async applyScale(nextScale: number): Promise<void> {
		this.fitController.setManualScale(nextScale);
		this.surface?.relayoutPending();
		await this.surface?.render();
	}

	private async fitTo(mode: ReaderFitMode): Promise<void> {
		await this.fitController.fitTo(mode, true);
	}

	private async rebuildSurface(): Promise<void> {
		this.surface?.destroy();
		this.surface = null;
		if (!this.readerBody) return;
		const surface = this.createSurface();
		this.readerBody.replaceChildren(surface.stage);
		bindReaderPageEvents(surface.stage, this.pageEventDeps());
		await surface.render();
	}

	private async navigateHistory(direction: -1 | 1): Promise<void> {
		const location = direction === -1 ? this.history.back() : this.history.forward();
		if (!location) return;
		await this.goTo(location.page, { smooth: false });
	}


	private syncDrawerState(): void {
		if (!this.drawer || !this.drawerToggle) return;
		this.drawer.classList.toggle('is-hidden', !this.drawerOpen);
		this.drawerToggle.setAttribute('aria-expanded', String(this.drawerOpen));
		if (!this.drawerOpen) this.highlightCoordinator.clear();
		const toolbar = this.containerEl.children[1]?.querySelector<HTMLElement>('.rd-reader-toolbar');
		if (toolbar) anchorBelowToolbar(this.drawer, toolbar);
	}
	private async enterCropMode(): Promise<void> {
		const path = this.activePath();
		const surface = this.surface;
		if (!path || !this.pages || !surface) return;
		const page = this.page;
		await this.cropLauncher.enter({
			ensureRenderedHost: async () => {
				const host = surface.hostForPage(page);
				if (host) return host;
				await surface.goToPage(page);
				return surface.hostForPage(page);
			},
			prepareCrop: (payload: CropSelectionPayload) => this.prepareCropDrag(payload),
			commit: (token: string) => this.host.commitPreparedCrop(token, this.selectedTarget === 'markdown' ? this.selectedTargetPath || undefined : undefined),
			discard: (token: string) => this.host.discardPreparedCrop(token)
		});
	}

	private renderDrawer(): void {
		if (!this.drawer) return;
		this.bridge.renderList(this.drawer, this.host.annotations.list(this.activePath()), this.page - 1, this.highlightCoordinator.getScope());
	}

	private bindHighlightPreview(): void { this.highlightCoordinator.bind(this.surface?.hostForPage(this.page) ?? null, this.drawer); }
	private openSelectionMenu(event?: MouseEvent): void {
		this.tools.openSelectionMenu(event, this.surface?.stage.getBoundingClientRect());
	}

	private async createExcerpt(text: string, type = this.selectedTarget, color: PdfHighlight['color'] = this.lastColor, frozenRects?: PdfHighlight['rects']): Promise<void> {
		if (!this.surface) return;
		const selection = window.getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		if (!range && !frozenRects) return;
		this.lastColor = color;
		try {
			const written = await writeReaderExcerpt({
				text, type, color, frozenRects,
				surface: this.surface, fallbackPage: this.page,
				pdfPath: this.activePath() ?? '', viewportFallback: this.pdf.getRenderedViewport(),
				continuous: this.surface.mode === 'continuous',
				createTarget: candidate => this.host.createTarget(candidate),
				selectedTarget: this.selectedTarget, selectedTargetPath: this.selectedTargetPath,
				targets: this.host.targets, annotations: this.host.annotations,
				chapterPathFor: page => this.chapterForPage(page),
				syncOutline: targetPath => this.syncOutlineForTarget(targetPath),
				onTargetResolved: (resolvedType, path) => { if (resolvedType === this.selectedTarget) this.selectedTargetPath = path; }
			}, range);
			if (!written) return;
			selection?.removeAllRanges();
			await this.refreshAnnotations();
			const target = written.highlight.target;
			const reveal = target ? await revealCreatedCanvasTarget(target, this.host) : 'created' as const;
			if (reveal === 'opened') new Notice('已创建 Canvas 卡片。');
			else if (reveal === 'open-failed') new Notice('Canvas 卡片已创建，但无法自动打开；可从“摘录管理”手动打开。');
		} catch (error) {
			console.error('[Reading Desk] 创建摘录失败', error);
			new Notice('创建摘录失败。请确认目标文档可用，然后重试一次。');
		}
	}

	private async createExcerptFromSelection(color: PdfHighlight['color']): Promise<void> {
		const text = window.getSelection()?.toString().trim() ?? '';
		if (!text) { new Notice('请先选择 PDF 原文。'); return; }
		await this.createExcerpt(text, this.selectedTarget, color);
	}

	private async prepareCropDrag(payload: CropSelectionPayload): Promise<PreparedCropDrag> {
		const pdfPath = this.activePath();
		if (!pdfPath) throw new Error('没有可裁剪的 PDF。');
		const image = await this.pdf.renderCrop(payload.rect);
		return this.host.prepareCropDrag({ pdfPath, page: payload.page, rect: payload.rect, target: payload.target, image });
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
		if (!text || !event.dataTransfer || !this.surface) return;
		const selection = window.getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		const anchorElement = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement ?? null;
		const host = anchorElement?.closest<HTMLElement>('.rd-pdf-page-host');
		if (!host || !range) return;
		const page = Number(host.dataset.page ?? this.page);
		const rects = selectionRects(range, host, this.surface.viewportForPage(page), false);
		if (!rects.length) return;
		event.dataTransfer.setData('text/plain', text);
		event.dataTransfer.setData('application/x-reading-desk-rects', JSON.stringify(rects));
		event.dataTransfer.effectAllowed = 'copy';
	}

	private async focusHighlight(highlight: PdfHighlight, openTarget = true): Promise<void> {
		await this.goTo(highlight.page + 1, { jump: true });
		const scrolled = this.surface?.scrollToHighlight(highlight.id) ?? false;
		if (scrolled) {
			const reduced = this.readerBody?.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
			const mark = this.surface?.hostForPage(this.page)?.querySelector<HTMLElement>(`[data-highlight-id="${highlight.id}"]`);
			mark?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
		}
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

	private activePath(): string { return this.session.path(); }
	private readerTitle(): string { const path = this.activePath(); return path ? `阅读：${path.split('/').pop()}` : 'Reading Desk 阅读器'; }

	private async recolorHighlight(id: string, color: PdfHighlight['color']): Promise<void> {
		const highlight = this.host.annotations.get(id);
		if (!highlight) return;
		await this.host.annotations.recolor(id, color);
		const updated = this.host.annotations.get(id);
		if (updated?.target) await this.host.targets.writeExcerpt(updated.target, updated);
		await this.refreshAnnotations();
	}

	private chapterForPage(page: number): string[] {
		const candidates = this.outline.filter(entry => entry.page <= page).sort((left, right) => right.page - left.page || right.path.length - left.path.length);
		return candidates[0]?.path ?? [];
	}
}
