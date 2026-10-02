import { ItemView, Notice, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type { PdfHighlight, TargetType, ViewerSettings, ReaderSavedPosition, SourceFingerprint } from '../types/contracts';
import { createId } from '../utils/ids';
import { PdfRenderer, type PdfOutlineEntry } from '../reader/PdfRenderer';
import { type CanvasOutlineEntry } from '../targets';
import { ReaderCommentBridge } from '../reader/ReaderCommentBridge';
import { type CropSelectionPayload } from '../ui/crop/CropSelectionOverlay';
import { ReaderCropController, type PdfCropRequest } from '../crop/ReaderCropController';
import { handleCropDrop, type PreparedCropDrag } from '../ui/crop/CropDragTransport';
import { ExcerptTargetPanel } from '../ui/targets/ExcerptTargetPanel';
import { ReaderSessionState } from '../reader/ReaderSessionState';
import { anchorBelowToolbar, trackToolbarHeight } from '../reader/ReaderChromeMetrics';
import { parseDraggedExcerptSelection } from '../reader/ReaderDragTransport';
import { executeCopyReaderPage } from '../reader/ReaderCopyCommand';
import { ReaderHighlightCoordinator } from '../reader/ReaderHighlightCoordinator';
import { boundVisiblePage } from '../reader/ReaderPageNavigation';
import { ReaderNavigation, type OutlineLoadState, type ReaderNavigationMode } from '../reader/ReaderNavigation';
import { observeReaderDensity } from '../reader/ReaderResponsive';
import { ReaderTargetPanelController } from '../ui/targets/ReaderTargetPanelController';
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
import type { FrozenExcerptSelection } from '../reader/ReaderExcerptWriter';
import { ReaderExcerptController, recolorReaderExcerpt } from '../reader/ReaderExcerptController';
import { ReaderPositionController } from '../reader/ReaderPositionController';
import { isReaderAbort } from '../reader/ReaderCancellation';
import { chapterPathForPage } from '../reader/ReaderOutlineModel';

import type { ReaderHost } from '../reader/ReaderHost';
import { ReaderPersistenceController } from '../reader/ReaderPersistenceController';
import { ReaderPageLabels } from '../reader/ReaderPageLabels';
import { renderReaderBookmarks } from '../reader/ReaderBookmarksPanel';
import { diagnoseSourceAnchors } from '../annotations/SourceAnchorDiagnostics';
import { SourceAnchorDiagnosticsPanel } from '../ui/annotations/SourceAnchorDiagnosticsPanel';

export const READER_VIEW_TYPE = 'reading-desk-reader';
export type { ReaderHost } from '../reader/ReaderHost';

export class ReaderView extends ItemView {
	private pdf: PdfRenderer;
	private readonly persistence: ReaderPersistenceController;
	private readonly anchorDiagnostics = new SourceAnchorDiagnosticsPanel();
	private labels = new ReaderPageLabels();
	private sourceFingerprint?: SourceFingerprint;
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
	private cropLauncher = new ReaderCropController();
	private readonly positions: ReaderPositionController;
	private readonly excerptWriter: ReaderExcerptController;
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
		this.positions = new ReaderPositionController({
			surface: () => this.surface, pdf: () => this.pdf, page: () => this.page, pageCount: () => this.pages,
			setPage: page => { this.page = page; this.session.setPage(page); }, history: this.history,
			changed: page => this.handlePageChanged(page), showTarget: (path, id) => this.host.showTarget(path, id), onError: message => new Notice(message)
		});
		this.persistence = new ReaderPersistenceController({ port: host.readerState, capture: () => {
			const location = this.positions.capture(); if (!this.surface || !this.activePath()) return null;
			return { page: location.page - 1, x: location.x ?? 0, y: location.y ?? 0, rotation: this.pdf.getRotation() as ReaderSavedPosition['rotation'], scale: this.pdf.getScale(), fitMode: this.fitController.getMode() };
		}, restore: position => this.restorePosition(position, true), error: message => new Notice(message) });
		this.excerptWriter = new ReaderExcerptController({
			input: (text, type, color) => this.surface && this.activePath() && !this.sourceMissing ? {
				text, type, color, sourceFingerprint: this.sourceFingerprint, surface: this.surface, fallbackPage: this.page, pdfPath: this.activePath(), viewportFallback: null,
				continuous: this.surface.mode === 'continuous', createTarget: candidate => this.host.createTarget(candidate),
				selectedTarget: this.selectedTarget, selectedTargetPath: this.selectedTargetPath,
				targets: this.host.targets, annotations: this.host.annotations, chapterPathFor: page => this.chapterForPage(page), pageLabelFor: page => this.labels.label(page),
				syncOutline: path => this.syncOutlineForTarget(path), onTargetResolved: (resolvedType, path) => { if (resolvedType === this.selectedTarget) this.selectedTargetPath = path; }
			} : null,
			setColor: color => { this.lastColor = color; }, refresh: () => this.refreshAnnotations(),
			openTargetInSplit: (path, id) => this.host.openTargetInSplit(path, id)
		});
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
			goToPage: async (page, signal) => { await this.positions.goTo(page, { smooth: false, jump: true, signal }); },
			ensurePageRendered: (page, signal) => this.surface?.ensurePageRendered(page, signal) ?? Promise.resolve(null),
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
				const frozen = parseDraggedExcerptSelection(event.dataTransfer?.getData('application/x-reading-desk-selection') ?? '');
				return text && frozen ? this.createExcerpt(text, this.selectedTarget, this.lastColor, frozen) : Promise.resolve();
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
		await this.lifecycle.onState(this.session.serialize(), (path, page) => this.openPdf(path, page, true));
	}
	async onClose(): Promise<void> {
		const saved = this.persistence?.leave();
		this.lifecycle.close(); this.anchorDiagnostics.destroy();
		this.tools.resetForDocument(); this.positions.cancel();
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
		await this.pdf.close(); await saved;
	}
	async openPdf(path: string, page?: number, workspaceRestore = false): Promise<void> {
		const request = this.openRequests.begin(path);
		const leaving = this.persistence?.leave();
		if (leaving) await leaving;
		if (!this.openRequests.isCurrent(request)) return;
		this.tools.resetForDocument(); this.positions?.cancel(); this.cropLauncher?.destroy();
		this.outlineLoader.invalidate();
		const sourceBefore = this.host.sourceFingerprint?.(path);
		const opened = await openReaderDocument(path, this.host.createPdfRenderer(), this.pdf, () => this.openRequests.isCurrent(request));
		if (!opened) return;
		this.pdf = opened.renderer;
		const sourceAfter = this.host.sourceFingerprint?.(path);
		this.sourceFingerprint = sourceBefore && sourceAfter && sourceBefore.mtime === sourceAfter.mtime && sourceBefore.size === sourceAfter.size ? { ...sourceBefore } : undefined;
		const saved = this.persistence?.begin(request.path);
		const restore = page === undefined || workspaceRestore ? saved : undefined;
		const labels = await this.pdf.pageLabels().catch(() => []);
		if (!this.openRequests.isCurrent(request)) return;
		this.labels = new ReaderPageLabels(labels);
		if (restore) { this.display.restoreRotation(restore.rotation); this.fitController.restore(restore.fitMode, restore.scale); } else this.display?.restoreRotation(0);
		this.session.open(request.path, restore ? restore.page + 1 : page ?? 1);
		this.lifecycle.markLoaded(request.path, page ?? this.session.pageNumber());
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
		if (!this.openRequests.isCurrent(request)) return;
		if (restore) await this.positions.goTo(this.page, { smooth: false, location: { page: this.page, x: restore.x, y: restore.y } });
		if (this.surface) { this.persistence?.activate(this.surface.stage); if (!workspaceRestore) this.persistence?.changed(); }
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
		await this.openPdf(path, 1);
		const highlight = this.host.annotations.get(highlightId);
		if (highlight) await this.focusHighlight(highlight, false);
	}

	async onOpen(): Promise<void> {
		await this.lifecycle.onOpen(this.session.serialize(), (path, page) => this.openPdf(path, page, true));
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
		if (changed) { this.persistence?.rename(oldPath, newPath); await this.refreshAnnotations(); }
		return changed;
	}

	/** Stops a deleted source from accepting later excerpts against its stale path. */
	async handleSourceDelete(path: string): Promise<boolean> {
		const deleted = this.session.delete(path);
		if (!deleted) return false;
		this.openRequests.invalidate();
		this.outlineLoader.invalidate();
		await this.persistence?.leave();
		this.sourceMissing = true;
		this.tools.resetForDocument(); this.positions.cancel();
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
		this.positions.cancel(); this.cropLauncher.destroy();
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
			pages: () => this.pages, pageLabel: page => this.labels.label(page),
			resolvePage: value => { const result = this.labels.resolve(value, this.pages); if (result.message) new Notice(result.message); return result.page ?? null; },
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
		this.positions.bindLinks(surface.stage);
		try {
			await surface.render();
			await this.fitController.refit(true);
			const opened = this.activePath();
			if (!this.host.readerState && opened && this.pages) this.host.recordProgress(opened, this.page / this.pages);
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
		this.bindHighlightPreview(); this.persistence?.observe(surface.stage);
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
				onTextSignal: (page, selectable) => this.handleTextSignal(page, selectable),
				onPageRendered: () => { this.tools.applySearchMarks(); this.bindHighlightPreview(); }
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
		}, this.host.viewerSettings().outlineStyle, { label: page => this.labels.label(page), bookmarks: parent => renderReaderBookmarks(parent, this.persistence, page => this.labels.description(page)) });
		this.readerNavigation.setOutline(this.outline, this.outlineState, this.outlineError);
		this.readerNavigation.render(container);
		this.readerNavigation.revealPage(this.page);
	}
	detachNavigation(container: HTMLElement): void {
		if (this.navigationContainer !== container) return;
		this.navigationMode = this.readerNavigation?.getMode() ?? this.navigationMode;
		this.pdf.releaseTarget(container);
		this.readerNavigation?.destroy();
		this.readerNavigation = this.navigationContainer = null;
	}
	setPreferredNavigationMode(mode: ReaderNavigationMode): void {
		if (this.navigationMode === mode) return;
		this.navigationMode = mode; this.readerNavigation?.destroy(); this.readerNavigation = null;
		if (this.navigationContainer) this.attachNavigation(this.navigationContainer);
	}
	/** Applies an outline-style change to the open navigation without reopening the PDF. */
	applyOutlineStyle(style: ViewerSettings['outlineStyle']): void { this.readerNavigation?.setOutlineStyle(style); }
	async copyCurrentPageLink(): Promise<void> {
		const path = this.activePath();
		if (!path || this.pages === 0) throw new Error('当前没有可复制的 PDF 页面。');
		await this.host.copyPageLink(path, this.page, this.labels.label(this.page));
	}
	canCopyCurrentPage(): boolean { return !!this.activePath() && this.pages > 0; }
	canCopySelection(): boolean { return this.tools.canCopySelection(); }
	async copySelectedText(): Promise<void> { await this.tools.copySelectedText(); }
	canUndoLastExcerpt(): boolean { return this.tools.canUndoLastExcerpt(); }
	async undoLastExcerpt(): Promise<void> { await this.tools.undoLastExcerpt(); }
	private async goTo(page: number, options?: { jump?: boolean; smooth?: boolean }): Promise<void> {
		const bounded = boundVisiblePage(Number.isFinite(page) ? page : this.page, this.pages);
		if (bounded.notice) new Notice(bounded.notice);
		this.cropLauncher.destroy();
		try { await this.positions.goTo(bounded.page, options); }
		catch (error) { if (!isReaderAbort(error)) { console.error('[Reading Desk] 页面跳转失败', error); new Notice('页面跳转失败，请重试。'); } }
	}

	private handlePageChanged(page: number): void {
		if (page !== this.page) {
			this.page = page;
			this.session.setPage(page);
		}
		this.positions.recordPageChanged(); this.persistence?.changed();
		this.controls?.pageControl.update(this.page, this.pages);
		this.controls?.updateHistory(this.history.canBack(), this.history.canForward());
		this.readerNavigation?.revealPage(this.page);
		const path = this.activePath();
		if (!this.host.readerState && path && this.pages) this.host.recordProgress(path, this.page / this.pages);
	}

	private handleTextSignal(page: number, selectable: boolean): void {
		if (selectable || this.scannedNoticeShown) return;
		this.scannedNoticeShown = true;
		new Notice(`第 ${page} 页没有可选文本，可能是扫描版。可以使用工具栏「裁剪」把图表摘录为图片。`);
	}

	private async applyScale(nextScale: number): Promise<void> {
		this.positions.cancel(); this.cropLauncher.destroy();
		this.fitController.setManualScale(nextScale);
		this.surface?.relayoutPending();
		await this.surface?.render();
	}

	private async fitTo(mode: ReaderFitMode): Promise<void> {
		await this.fitController.fitTo(mode, true);
	}

	private async rebuildSurface(): Promise<void> {
		this.positions.cancel(); this.cropLauncher.destroy();
		this.surface?.destroy();
		this.surface = null;
		if (!this.readerBody) return;
		const surface = this.createSurface();
		this.readerBody.replaceChildren(surface.stage);
		bindReaderPageEvents(surface.stage, this.pageEventDeps());
		this.positions.bindLinks(surface.stage);
		await surface.render();
		this.persistence?.observe(surface.stage); this.persistence?.changed();
	}

	private async restorePosition(position: ReaderSavedPosition, jump = false): Promise<void> {
		const pdf = this.pdf; this.persistence.pause();
		if (jump) { this.history.replace(this.positions.capture()); this.history.push({ page: position.page + 1, x: position.x, y: position.y }); }
		this.positions.cancel(); this.cropLauncher.destroy();
		this.display.restoreRotation(position.rotation); this.fitController.restore(position.fitMode, position.scale);
		this.page = Math.max(1, Math.min(this.pages, position.page + 1));
		let restored = false;
		try {
			await this.rebuildSurface(); if (pdf !== this.pdf) return;
			if (position.fitMode !== 'manual') await this.fitController.refit(true);
			if (pdf !== this.pdf) return;
			await this.positions.goTo(this.page, { smooth: false, location: { page: this.page, x: position.x, y: position.y } }); restored = true;
		} finally { if (pdf === this.pdf && this.surface) { this.persistence.activate(this.surface.stage); if (restored) this.persistence.changed(); } }
	}

	private async navigateHistory(direction: -1 | 1): Promise<void> {
		try { await this.positions.history(direction); } catch (error) { if (!isReaderAbort(error)) new Notice('历史位置无法载入，请重试。'); }
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
		const path = this.activePath(); const surface = this.surface;
		if (!path || !this.pages || !surface) return;
		try {
			await this.cropLauncher.enter({ surface, page: this.page,
				prepare: (payload, request) => this.prepareCropDrag(payload, request),
				commit: token => this.host.commitPreparedCrop(token, this.selectedTarget === 'markdown' ? this.selectedTargetPath || undefined : undefined),
				discard: token => this.host.discardPreparedCrop(token)
			});
		} catch (error) { if (!isReaderAbort(error)) new Notice('当前页裁剪无法载入，请重试。'); }
	}

	private renderDrawer(): void {
		if (!this.drawer) return;
		const highlights = this.host.annotations.list(this.activePath());
		this.bridge.renderList(this.drawer, highlights, this.page - 1, this.highlightCoordinator.getScope());
		this.anchorDiagnostics.render(this.drawer, diagnoseSourceAnchors(highlights, this.host.sourceFingerprint?.(this.activePath())), query => this.tools.searchFor(query));
	}

	private bindHighlightPreview(): void { this.highlightCoordinator.bind(this.surface?.hostForPage(this.page) ?? null, this.drawer); }
	private openSelectionMenu(event?: MouseEvent): void {
		this.tools.openSelectionMenu(event, this.surface?.stage.getBoundingClientRect());
	}

	private async createExcerpt(text: string, type: TargetType, color: PdfHighlight['color'], frozenSelection?: FrozenExcerptSelection): Promise<void> {
		await this.excerptWriter.create(text, type, color, frozenSelection);
	}

	private async createExcerptFromSelection(color: PdfHighlight['color']): Promise<void> {
		const text = window.getSelection()?.toString().trim() ?? '';
		if (!text) { new Notice('请先选择 PDF 原文。'); return; }
		await this.createExcerpt(text, this.selectedTarget, color);
	}

	private async prepareCropDrag(payload: CropSelectionPayload, request: PdfCropRequest): Promise<PreparedCropDrag> {
		const pdfPath = this.activePath();
		if (!pdfPath) throw new Error('没有可裁剪的 PDF。');
		const image = await this.pdf.renderCrop(request);
		if (this.activePath() !== pdfPath) throw new Error('PDF 已切换，请重新裁剪。');
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

	private beginExcerptDrag(event: DragEvent): void { this.excerptWriter.beginDrag(event, this.surface, this.activePath(), this.sourceFingerprint); }
	private async focusHighlight(highlight: PdfHighlight, openTarget = true): Promise<void> {
		try { await this.positions.focusHighlight(highlight, openTarget); }
		catch (error) { if (!isReaderAbort(error)) new Notice('高亮位置无法载入，请重试。'); }
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
		try { await recolorReaderExcerpt(this.host.annotations, this.host.targets, id, color); await this.refreshAnnotations(); }
		catch (error) { console.error('[Reading Desk] 改色失败', error); new Notice('改色尚未保存，可在设置中重试待写入记录。'); }
	}

	private chapterForPage(page: number): string[] { return chapterPathForPage(this.outline, page); }
}
