import { addIcon, MarkdownView, Notice, Plugin, setIcon, TFile, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import { AnnotationStore } from './annotations/AnnotationStore';
import { ReadingDeskRepository } from './data/ReadingDeskRepository';
import { LibraryIndex, type LibraryFile } from './library/LibraryIndex';
import { MetadataExtractor } from './library/MetadataExtractor';
import { PdfRenderer } from './reader/PdfRenderer';
import { AiIntegrationService, type AiBridge } from './ai/AiIntegrationService';
import { exportBookshelf, importLegacyBookshelf, type BookshelfImportResult } from './portability/BookshelfPortabilityService';
import { ClipboardImageError, MarkdownImagePasteService } from './storage/MarkdownImagePasteService';
import { ObjectStorageConfigurationError, ObjectStorageRequestError, ObjectStorageService } from './storage/ObjectStorageService';
import { ReadingDeskSettingTab } from './settings/ReadingDeskSettingTab';
import { TargetService } from './targets';
import type { ObjectStorageSettings, PdfHighlight, TargetType, ViewerSettings } from './types/contracts';
import { ReaderView, READER_VIEW_TYPE } from './views/ReaderView';
import { CropImageService } from './storage/CropImageService';
import { ProgressFlusher } from './library/ProgressFlusher';
import { PdfNavigationView, PDF_NAVIGATION_VIEW_TYPE } from './views/PdfNavigationView';
import { ShelfItemView, SHELF_VIEW_TYPE } from './views/ShelfItemView';
import { createHighlightLink, createPageLink, writeReadingDeskLink } from './reader/ReadingDeskLinks';
import { canCopyReaderPage, executeCopyReaderPage } from './reader/ReaderCopyCommand';
import { routeReadingDeskLink } from './reader/ReadingDeskLinkRouter';
import { hostThemeDark, marginAnchorIconId, READING_DESK_MARGIN_ANCHOR_DAY, READING_DESK_MARGIN_ANCHOR_NIGHT } from './ui/icons/ReadingDeskIcons';

const LEGACY_DATA_PATHS = ['.obsidian/plugins/obsidian-bookshelf/data.json', '.obsidian/plugins/obsidian-bookshelf/metadata.json'];
const LEGACY_METADATA_FOLDER = '.obsidian/plugins/bookshelf/metadata';
const AI_CONTEXT_FOLDER = 'Reading Desk/AI Context';

type PluginRegistry = { enabledPlugins: Set<string>; getPlugin(id: string): unknown; };
export default class ReadingDeskPlugin extends Plugin {
	repository!: ReadingDeskRepository;
	ai!: AiIntegrationService;
	private annotations!: AnnotationStore;
	private library!: LibraryIndex;
	private targets!: TargetService;
	private crops!: CropImageService;
	private progressFlusher!: ProgressFlusher;
	private settingsTabHint: string | null = null;

	async onload(): Promise<void> {
		this.repository = new ReadingDeskRepository({ load: () => this.loadData(), save: data => this.saveData(data) });
		await this.repository.initialize();
		this.annotations = new AnnotationStore(this.repository);
		this.library = new LibraryIndex(this.repository, new MetadataExtractor({
			readBinary: path => this.app.vault.adapter.readBinary(path),
			writeBinary: (path, value) => this.writeBinary(path, value)
		}, { load: data => this.loadPdfMetadata(data) }));
		this.targets = new TargetService({
			atomicTransform: (path, transform) => this.atomicTransform(path, transform)
		});
		this.crops = new CropImageService({ app: this.app, ensureFile: (path, content) => this.ensureFile(path, content), atomicTransform: (path, transform) => this.atomicTransform(path, transform), writeBinary: (path, value) => this.writeBinary(path, value) }, () => this.repository.readSettings().storage);
		this.progressFlusher = new ProgressFlusher({ write: async ({ path, progress }) => {
			const book = this.library.getByPath(path);
			if (book) {
				await this.library.updateProgress(book.id, progress);
				await this.refreshShelves();
			}
		} });
		this.ai = new AiIntegrationService(this.pluginRegistry(), { opencodian: plugin => this.createOpenCodianBridge(plugin) });
		this.registerView(READER_VIEW_TYPE, leaf => new ReaderView(leaf, {
			createPdfRenderer: () => this.createPdfRenderer(),
			annotations: this.annotations,
			targets: this.targets,
			openFile: path => this.openReader(path),
			createTarget: type => this.createTarget(type),
			listTargets: type => this.listTargets(type),
			prepareCropDrag: async input => {
				const prepared = this.crops.prepare({ pdfPath: input.pdfPath, page: input.page, rect: input.rect, target: input.target, image: input.image });
				return { dragToken: prepared.dragToken, previewUrl: prepared.previewUrl, mimeType: prepared.mimeType };
			},
			commitPreparedCrop: (token, targetPath) => this.crops.commit(token, targetPath),
			discardPreparedCrop: token => this.crops.discard(token),
			recordProgress: (path, progress) => this.progressFlusher.record(path, progress),
			viewerSettings: () => this.repository.readSettings().viewer,
			updateViewerSettings: patch => this.updateViewerSettings(patch),
			openSettings: () => this.openPluginSettings('reader'),
			showTarget: (path, objectId) => this.showTarget(path, objectId),
			openTargetInSplit: (path, objectId) => this.openTargetInSplit(path, objectId),
			readExcerptCards: path => this.readExcerptCards(path),
			updateExcerptCard: (highlightId, patch) => this.updateExcerptCard(highlightId, patch),
			copyPageLink: (path, page) => this.copyPageLink(path, page),
			copyHighlightLink: highlight => this.copyHighlightLink(highlight),
			openNavigation: () => this.openPdfNavigation()
		}));
		this.registerView(PDF_NAVIGATION_VIEW_TYPE, leaf => new PdfNavigationView(leaf, () => {
			const current = this.app.workspace.getActiveViewOfType(ReaderView);
			return current ?? this.app.workspace.getLeavesOfType(READER_VIEW_TYPE).map(item => item.view).find(view => view instanceof ReaderView && !!view.getState().pdfPath) as ReaderView | undefined ?? null;
		}));
		this.registerView(SHELF_VIEW_TYPE, leaf => new ShelfItemView(leaf, this.library, {
			open: path => this.openReader(path),
			scan: () => this.scanLibrary(),
			resourceUrl: path => this.app.vault.adapter.getResourcePath(path),
			openSettings: () => this.openPluginSettings('library')
		}));
		this.app.workspace.onLayoutReady(() => { if (this.app.workspace.getLeavesOfType(READER_VIEW_TYPE).some(leaf => !!leaf.view.getState().pdfPath)) void this.openPdfNavigation(false); });
		addIcon('reading-desk-margin-day', READING_DESK_MARGIN_ANCHOR_DAY);
		addIcon('reading-desk-margin-night', READING_DESK_MARGIN_ANCHOR_NIGHT);
		const ribbon = this.addRibbonIcon('reading-desk-margin-day', '打开 Reading Desk 书架', () => this.openShelf());
		const syncRibbonIcon = (): void => {
			const doc = ribbon.ownerDocument;
			setIcon(ribbon, marginAnchorIconId(hostThemeDark(doc)));
		};
		syncRibbonIcon();
		this.registerEvent(this.app.workspace.on('css-change', syncRibbonIcon));
		// css-change covers real theme/snippet switches; the body-class observer also
		// covers popout windows and hosts that flip the class without the event.
		const themeObserver = new MutationObserver(syncRibbonIcon);
		themeObserver.observe(ribbon.ownerDocument.body, { attributes: true, attributeFilter: ['class'] });
		this.register(() => themeObserver.disconnect());
		this.addCommand({ id: 'open-reading-desk', name: '打开 Reading Desk 书架', callback: () => this.openShelf() });
		this.addCommand({ id: 'scan-library', name: '扫描 Reading Desk 书库', callback: () => this.scanLibrary() });
		this.addCommand({ id: 'open-reader-in-focus-layout', name: '打开 Reading Desk 阅读器（兼容命令）', callback: () => this.openReaderFromActiveFile() });
		this.addCommand({ id: 'import-legacy-bookshelf', name: '导入旧 Bookshelf 数据（一次性）', callback: () => this.importLegacyBookshelf() });
		this.addCommand({ id: 'export-library-markdown', name: '导出 Reading Desk 书架为 Markdown（写入仓库）', callback: () => this.exportToVault('markdown') });
		this.addCommand({ id: 'export-library-json', name: '导出 Reading Desk 书架为 JSON（写入仓库）', callback: () => this.exportToVault('json') });
		this.addCommand({ id: 'ask-ai-about-selection', name: '将当前 Reading Desk 选区交给 AI', checkCallback: checking => this.askAiAboutCurrentSelection(checking) });
		this.addCommand({ id: 'copy-current-reader-page-link', name: '复制 Reading Desk 当前页链接', checkCallback: checking => this.copyActiveReaderPage(checking) });
		this.addCommand({ id: 'open-settings', name: '打开 Reading Desk 设置', callback: () => void this.openPluginSettings() });
		this.addCommand({ id: 'copy-selected-reader-text', name: '复制 Reading Desk 选中文本', checkCallback: checking => this.copyActiveReaderSelection(checking) });
		this.addCommand({ id: 'undo-last-excerpt', name: '撤销 Reading Desk 上一条摘录', checkCallback: checking => this.undoActiveReaderExcerpt(checking) });
		this.addSettingTab(new ReadingDeskSettingTab(this));
		this.registerObsidianProtocolHandler('reading-desk-highlight', params => void this.openReaderHighlight(params));
		this.registerEvent(this.app.vault.on('create', file => void this.onVaultCreateOrModify(file)));
		this.registerEvent(this.app.vault.on('modify', file => void this.onVaultCreateOrModify(file)));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => void this.onVaultRename(file, oldPath)));
		this.registerEvent(this.app.vault.on('delete', file => void this.onVaultDelete(file)));
		this.registerDomEvent(document, 'paste', event => void this.onMarkdownImagePaste(event));
		console.info(`[Reading Desk] Margin v${__APP_VERSION__} build ${__BUILD_ID__}`);
	}

	onunload(): void {
		void this.progressFlusher.flush().catch(() => undefined);
		this.progressFlusher.dispose();
		this.crops.revokeAll();
	}

	notice(message: string): void { new Notice(message); }

	/** Opens the host settings surface directly on this plugin's page. */
	async openPluginSettings(initialTab?: string): Promise<void> {
		if (initialTab) this.settingsTabHint = initialTab;
		const settings = (this.app as unknown as { setting?: { open(): unknown; openTabById(id: string): unknown } }).setting;
		if (!settings) {
			this.notice('当前宿主不支持直接打开插件设置；请从设置面板手动进入 Reading Desk。');
			return;
		}
		settings.open();
		await settings.openTabById(this.manifest.id);
	}

	/** Hands a context tab (阅读器/书架 entry) to the next settings render. */
	consumeSettingsTabHint(): string | null {
		const hint = this.settingsTabHint;
		this.settingsTabHint = null;
		return hint;
	}

	async updateViewerSettings(patch: Partial<ViewerSettings>): Promise<void> {
		await this.repository.updateSettings({ viewer: { ...this.repository.readSettings().viewer, ...patch } });
	}

	async updateStorageSettings(patch: Partial<ObjectStorageSettings>): Promise<void> {
		await this.repository.updateSettings({ storage: { ...this.repository.readSettings().storage, ...patch } });
	}

	async testStorageConnection(): Promise<{ status: number; endpoint: string }> {
		const result = await new ObjectStorageService(this.repository.readSettings().storage).testConnection();
		return { status: result.status, endpoint: result.endpoint };
	}

	async scanLibrary(showNotice = true): Promise<void> {
		const folders = this.repository.readSettings().libraryFolders;
		const files = this.app.vault.getFiles().map(file => toLibraryFile(file));
		await this.library.scan(files, folders, showNotice);
		await this.refreshShelves();
		if (showNotice) this.notice(`书库已更新：${this.library.list().length} 本。`);
	}

	async importLegacyBookshelf(): Promise<BookshelfImportResult> {
		const legacy = await this.readLegacyBookshelfData();
		if (!legacy) throw new Error('未找到可导入的旧 Bookshelf 元数据；不会消耗一次性导入资格。');
		const result = importLegacyBookshelf(legacy, this.repository.snapshot());
		if (!result.alreadyImported) await this.replaceRepositoryData(result.data);
		await this.refreshShelves();
		if (!result.alreadyImported) this.notice(`已导入 ${result.importedBookCount} 本旧书目；原 Bookshelf 数据未被修改。`);
		return result;
	}

	exportMarkdown(): string { return exportBookshelf(this.repository.snapshot()).markdown; }
	exportJson(): string { return exportBookshelf(this.repository.snapshot()).json; }
	portabilityStatus(): { importedBookshelf: boolean } { return { importedBookshelf: this.repository.readSettings().importedBookshelf }; }
	async askAiWithSelection(text: string, sourcePath: string): Promise<void> { await this.ai.ask(text, sourcePath); }

	private async openShelf(): Promise<void> {
		await this.scanLibrary(false);
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: SHELF_VIEW_TYPE, state: {}, active: true });
	}

	private async openReader(path: string, page?: number): Promise<void> {
		const leaf = this.readerLeafFor(path) ?? this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: READER_VIEW_TYPE, state: {}, active: true });
		const reader = leaf.view instanceof ReaderView ? leaf.view : null;
		if (reader) { await reader.openPdf(path, page ?? 1); await this.openPdfNavigation(false); }
	}

	/** Reuses the reader leaf already showing this PDF so links never stack duplicate tabs. */
	private readerLeafFor(path: string): WorkspaceLeaf | null {
		for (const leaf of this.app.workspace.getLeavesOfType(READER_VIEW_TYPE)) {
			if (leaf.view.getState().pdfPath === path) return leaf;
		}
		return null;
	}

	private async openReaderHighlight(params: Record<string, string>): Promise<void> {
		await routeReadingDeskLink(params, {
			annotations: this.annotations, library: this.library,
			fileExists: path => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
			notice: message => this.notice(message),
			openHighlight: (path, id) => this.openLinkedReader(path, id),
			openPage: (path, page) => this.openLinkedReader(path, undefined, page)
		});
	}

	private async openLinkedReader(path: string, highlightId?: string, page?: number): Promise<void> {
		const leaf = this.readerLeafFor(path) ?? this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: READER_VIEW_TYPE, state: {}, active: true });
		if (!(leaf.view instanceof ReaderView)) return;
		if (highlightId) await leaf.view.openPdfAtHighlight(path, highlightId);
		else await leaf.view.openPdf(path, page);
		await this.openPdfNavigation(false);
	}

	private copyActiveReaderPage(checking: boolean): boolean | void {
		const reader = this.app.workspace.getActiveViewOfType(ReaderView);
		if (checking) return canCopyReaderPage(reader);
		if (reader && canCopyReaderPage(reader)) void executeCopyReaderPage(reader, message => this.notice(message));
	}

	private copyActiveReaderSelection(checking: boolean): boolean | void {
		const reader = this.app.workspace.getActiveViewOfType(ReaderView);
		if (checking) return reader?.canCopySelection() === true;
		if (reader?.canCopySelection()) void reader.copySelectedText();
	}

	private undoActiveReaderExcerpt(checking: boolean): boolean | void {
		const reader = this.app.workspace.getActiveViewOfType(ReaderView);
		if (checking) return reader?.canUndoLastExcerpt() === true;
		if (reader?.canUndoLastExcerpt()) void reader.undoLastExcerpt();
	}

	private async copyPageLink(path: string, page: number): Promise<void> {
		const link = createPageLink({ file: path, page, bookId: this.library.getByPath(path)?.id });
		await this.copyLink(link, `已复制第 ${page} 页链接。`);
	}

	private async copyHighlightLink(highlight: PdfHighlight): Promise<void> {
		await this.copyLink(createHighlightLink(highlight), '已复制原文链接。');
	}

	private async copyLink(link: string, successMessage: string): Promise<void> {
		try {
			if (!navigator.clipboard) throw new Error('clipboard unavailable');
			await writeReadingDeskLink(navigator.clipboard, link);
			this.notice(successMessage);
		} catch (_error) {
			throw new Error('无法写入剪贴板，请检查系统权限后重试');
		}
	}

	private async openReaderFromActiveFile(): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		const path = active?.extension.toLowerCase() === 'pdf' ? active.path : this.library.list().find(book => book.format === 'pdf')?.path;
		if (!path) throw new Error('没有可打开的 PDF。请先扫描书库或打开一个 PDF。');
		await this.openReader(path);
	}
	private async openPdfNavigation(focus = true): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(PDF_NAVIGATION_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = this.app.workspace.getLeftLeaf(true) ?? undefined;
			if (!leaf) return;
			await leaf.setViewState({ type: PDF_NAVIGATION_VIEW_TYPE, state: {}, active: focus });
		}
		if (leaf.view instanceof PdfNavigationView) leaf.view.refresh();
		if (focus) await this.app.workspace.revealLeaf(leaf);
	}
	private createPdfRenderer(): PdfRenderer {
		return new PdfRenderer({
			readBinary: path => this.app.vault.adapter.readBinary(path),
			resourceUrl: path => this.resourceUrl(path)
		});
	}

	private async loadPdfMetadata(data: ArrayBuffer): Promise<import('./library/MetadataExtractor').PdfDocumentLike> {
		const pdfjs = await import('pdfjs-dist');
		const workerSrc = this.resourceUrl('pdf.worker.mjs');
		if (!workerSrc) throw new Error('无法解析 Reading Desk 本地 PDF worker 资源；请重新部署 pdf.worker.mjs。');
		pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
		return pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, useWorkerFetch: false }).promise;
	}

	private async listTargets(type: TargetType): Promise<Array<{ path: string; label: string }>> {
		return this.app.vault.getFiles()
			.filter(file => targetMatches(file, type))
			.map(file => ({ path: file.path, label: file.basename }))
			.sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
	}

	private async readExcerptCards(pdfPath: string): Promise<Array<{ highlight: import('./types/contracts').PdfHighlight; title?: string; folded?: boolean }>> {
		return this.annotations.list(pdfPath).map(highlight => ({ highlight, ...this.repository.readExcerptCards()[highlight.id] }));
	}

	private async updateExcerptCard(highlightId: string, patch: { title?: string; folded?: boolean }): Promise<void> {
		const highlight = this.annotations.get(highlightId);
		if (!highlight?.target) throw new Error('该高亮还没有可更新的摘录卡片。');
		const next = { ...this.repository.readExcerptCards()[highlightId], ...patch };
		await this.targets.writeExcerpt(highlight.target, highlight, next);
		await this.repository.commit(() => { this.repository.readExcerptCards()[highlightId] = next; });
	}

	private async showTarget(path: string, objectId?: string): Promise<void> {
		await this.openTargetInSplit(path, objectId);
	}

	private async openTargetInSplit(path: string, objectId?: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(`未找到摘录目标：${path}`);
		if (path.endsWith('.excalidraw.md')) {
			const excalidraw = this.excalidrawPlugin();
			if (!excalidraw) throw new Error('未安装 Excalidraw 插件，无法在原生目标面板打开该摘录。');
			await excalidraw.openDrawing(file, 'new-pane', true);
			if (objectId) this.scheduleNativeFocus(objectId);
			return;
		}
		const leaf = this.app.workspace.getLeaf('split');
		await leaf.openFile(file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		if (objectId) this.scheduleNativeFocus(objectId, leaf.view);
	}

	private scheduleNativeFocus(objectId: string, preferredView?: unknown): void {
		window.setTimeout(() => {
			const view = preferredView ?? this.app.workspace.getMostRecentLeaf()?.view;
			if (!this.focusNativeTarget(view, objectId)) this.notice('目标已打开；该宿主视图不支持按对象定位。');
		}, 160);
	}

	private focusNativeTarget(view: unknown, objectId: string): boolean {
		const reduceMotion = prefersReducedMotion();
		const canvas = (view as { canvas?: { nodes?: Map<string, unknown>; selectOnly?(node: unknown): void; zoomToSelection?(): void } }).canvas;
		const node = canvas?.nodes?.get(objectId);
		if (canvas && node && typeof canvas.selectOnly === 'function') {
			canvas.selectOnly(node);
			if (!reduceMotion) canvas.zoomToSelection?.();
			return true;
		}
		const excalidraw = view as {
			zoomToElementId?(id: string, group?: boolean): Promise<void> | void;
			excalidrawAPI?: { getSceneElements?(): Array<{ id: string; customData?: Record<string, unknown> }> };
		};
		if (typeof excalidraw.zoomToElementId !== 'function') return false;
		const highlightId = this.highlightIdForTargetObject(objectId);
		const elementId = highlightId
			? excalidraw.excalidrawAPI?.getSceneElements?.().find(element => readingDeskHighlightId(element) === highlightId)?.id ?? objectId
			: objectId;
		if (!reduceMotion) void excalidraw.zoomToElementId(elementId, false);
		return true;
	}

	private highlightIdForTargetObject(objectId: string): string | undefined {
		return this.annotations.listAll().find(highlight => highlight.target?.objectId === objectId)?.id;
	}

	private excalidrawPlugin(): { openDrawing(file: TFile, location: 'new-pane', active: boolean): Promise<void> | void } | null {
		const registry = this.pluginRegistry();
		if (!registry.enabledPlugins.has('obsidian-excalidraw-plugin')) return null;
		const plugin = registry.getPlugin('obsidian-excalidraw-plugin') as { openDrawing?(file: TFile, location: 'new-pane', active: boolean): Promise<void> | void } | undefined;
		return plugin?.openDrawing ? plugin as { openDrawing(file: TFile, location: 'new-pane', active: boolean): Promise<void> | void } : null;
	}

	private async createTarget(type: TargetType): Promise<{ type: TargetType; path: string }> {
		const base = `Reading Desk/摘录-${Date.now()}`;
		const path = type === 'canvas' ? `${base}.canvas` : type === 'excalidraw' ? `${base}.excalidraw.md` : `${base}.md`;
		const content = type === 'canvas' ? '{\n  "nodes": [],\n  "edges": []\n}' : type === 'excalidraw'
			? createExcalidrawDocument() : '';
		await this.ensureFile(path, content);
		return { type, path };
	}

	private async onVaultCreateOrModify(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) return;
		if (isLibraryPath(file.path)) await this.scanLibrary(false);
		if (isTargetPath(file.path)) await this.syncTargetDeletion(file.path);
	}

	private async onVaultRename(file: TAbstractFile, oldPath: string): Promise<void> {
		if (!(file instanceof TFile)) return;
		const renamedHighlights = this.annotations.listAll().filter(highlight => highlight.pdfPath === oldPath && !!highlight.target);
		await this.repository.commit(() => {
			const book = this.library.getByPath(oldPath);
			if (book && isLibraryPath(file.path)) book.path = file.path;
			for (const highlight of this.annotations.listAll()) {
				if (highlight.pdfPath === oldPath) highlight.pdfPath = file.path;
				if (highlight.target?.path === oldPath) highlight.target.path = file.path;
			}
		});
		for (const beforeRename of renamedHighlights) {
			const current = this.annotations.get(beforeRename.id);
			if (current?.target) await this.targets.writeExcerpt(current.target, current);
		}
		if (isLibraryPath(file.path) || isLibraryPath(oldPath)) await this.refreshReaderSourceRename(oldPath, file.path);
		if (isLibraryPath(file.path) || isLibraryPath(oldPath)) await this.scanLibrary(false);
		if (isTargetPath(file.path) || isTargetPath(oldPath)) await this.syncTargetDeletion(file.path);
		await this.refreshShelves();
	}

	private async onVaultDelete(file: TAbstractFile): Promise<void> {
		const path = file.path;
		if (!isLibraryPath(path) && !isTargetPath(path)) return;
		const removedBooks = Object.values(this.repository.readBooks()).filter(book => book.path === path).length;
		const removedHighlights = this.annotations.listAll().filter(highlight => highlight.pdfPath === path || highlight.target?.path === path).length;
		await this.repository.commit(() => {
			for (const [id, book] of Object.entries(this.repository.readBooks())) if (book.path === path) delete this.repository.readBooks()[id];
			for (const highlight of this.annotations.listAll()) {
				if (highlight.pdfPath === path || highlight.target?.path === path) {
					delete this.repository.readHighlights()[highlight.id];
					delete this.repository.readComments()[highlight.id];
					delete this.repository.readExcerptCards()[highlight.id];
				}
			}
		});
		if (isLibraryPath(path)) await this.refreshReaderSourceDelete(path);
		await this.refreshShelves();
		if (removedBooks > 0 || removedHighlights > 0) {
			this.notice(`文件 ${path} 已删除，Reading Desk 已同步清理 ${removedBooks} 本书目与 ${removedHighlights} 条高亮及其评论、摘录卡片。`);
		}
	}

	private async syncTargetDeletion(path: string): Promise<void> {
		let changed = false;
		for (const type of ['canvas', 'excalidraw', 'markdown'] as TargetType[]) {
			try {
				const removed = await this.targets.removeMissingTargetHighlights({ type, path }, this.annotations.listAll().filter(highlight => highlight.target?.path === path), this.annotations);
				changed ||= removed.length > 0;
			} catch { /* User file may not be a supported target format. */ }
		}
		if (changed) await this.refreshReaderAnnotations();
	}

	private async onMarkdownImagePaste(event: ClipboardEvent): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const items = event.clipboardData?.items;
		const storage = this.repository.readSettings().storage;
		if (!view || !items || !storage.enabled || !storage.imageHostEnabled || !Array.from(items).some(item => item.type.toLowerCase().startsWith('image/'))) return;
		event.preventDefault();
		try {
			const uploaded = await new MarkdownImagePasteService(storage, new ObjectStorageService(storage)).uploadFirstClipboardImage(Array.from(items));
			view.editor.replaceSelection(uploaded.markdown);
			this.notice('图片已上传并插入 Markdown 外链。');
		} catch (error) {
			this.notice(describeImageUploadFailure(error));
		}
	}

	private askAiAboutCurrentSelection(checking: boolean): boolean | void {
		const text = window.getSelection()?.toString().trim() ?? '';
		if (!text || !this.ai.availability().available) return false;
		if (checking) return true;
		const source = this.app.workspace.getActiveFile()?.path ?? 'Reading Desk PDF 选区';
		void this.askAiWithSelection(text, source)
			.then(() => this.notice('已把选区作为上下文交给兼容 AI 插件。'))
			.catch(() => this.notice(this.ai.availability().available
				? 'AI 调用失败：兼容 AI 插件已检测到，但这次调用没有完成。请确认该插件正在运行后重试。'
				: 'AI 集成不可用：未检测到兼容的 AI 插件。请先安装并启用受支持的 AI 插件，再使用该命令。'));
	}

	private pluginRegistry(): PluginRegistry { return (this.app as unknown as { plugins: PluginRegistry }).plugins; }

	private createOpenCodianBridge(plugin: unknown): AiBridge | null {
		const commands = this.commandRegistry();
		if (!plugin || !commands.commands['opencodian:add-current-note-to-context'] || !commands.commands['opencodian:open-view']) return null;
		return { openWithSelection: (text, sourcePath) => this.openOpenCodianWithSelection(text, sourcePath) };
	}

	private async openOpenCodianWithSelection(text: string, sourcePath: string): Promise<void> {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const path = `${AI_CONTEXT_FOLDER}/选区-${id}.md`;
		await this.ensureFile(path, `# Reading Desk AI 上下文\n\n来源：${sourcePath}\n\n${text}\n`);
		await this.app.workspace.openLinkText(path, '', false);
		await this.commandRegistry().executeCommandById('opencodian:add-current-note-to-context');
		await this.commandRegistry().executeCommandById('opencodian:open-view');
	}

	private async exportToVault(format: 'markdown' | 'json'): Promise<void> {
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const path = `Reading Desk/exports/reading-desk-${stamp}.${format === 'markdown' ? 'md' : 'json'}`;
		await this.ensureFile(path, format === 'markdown' ? this.exportMarkdown() : this.exportJson());
		await this.app.workspace.openLinkText(path, '', false);
		const label = format === 'markdown' ? 'Markdown' : 'JSON';
		this.notice(`书架已导出为 ${label}，已写入新文件 ${path}；导出只新建文件，不会覆盖已有内容。`);
	}

	private async readLegacyBookshelfData(): Promise<unknown | null> {
		const records = await this.readLegacyMetadataRecords();
		const settings = await this.readLegacySettings();
		if (records.length > 0) return { books: records, settings };
		for (const path of LEGACY_DATA_PATHS) {
			if (!await this.app.vault.adapter.exists(path)) continue;
			try { return JSON.parse(await this.app.vault.adapter.read(path)); } catch { throw new Error(`旧 Bookshelf 数据无法解析：${path}`); }
		}
		return null;
	}

	private async readLegacyMetadataRecords(): Promise<unknown[]> {
		if (!await this.app.vault.adapter.exists(LEGACY_METADATA_FOLDER)) return [];
		const listing = await this.app.vault.adapter.list(LEGACY_METADATA_FOLDER);
		const records: unknown[] = [];
		for (const path of listing.files) {
			if (!path.endsWith('.json') || path.includes('/covers/')) continue;
			try { records.push(JSON.parse(await this.app.vault.adapter.read(path))); } catch { this.notice(`跳过无法解析的旧元数据：${path}`); }
		}
		return records;
	}

	private async readLegacySettings(): Promise<unknown> {
		const path = '.obsidian/plugins/obsidian-bookshelf/data.json';
		if (!await this.app.vault.adapter.exists(path)) return {};
		try { return JSON.parse(await this.app.vault.adapter.read(path)); } catch { return {}; }
	}

	private async replaceRepositoryData(next: ReturnType<ReadingDeskRepository['snapshot']>): Promise<void> {
		await this.repository.commit(() => {
			Object.assign(this.repository.readBooks(), next.books);
			this.repository.readCategories().splice(0, this.repository.readCategories().length, ...next.categories);
			Object.assign(this.repository.readHighlights(), next.highlights);
			Object.assign(this.repository.readComments(), next.comments);
			Object.assign(this.repository.readExcerptCards(), next.excerptCards);
			Object.assign(this.repository.readSettings(), next.settings);
		});
	}

	private async refreshShelves(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(SHELF_VIEW_TYPE)) if (leaf.view instanceof ShelfItemView) await leaf.view.onOpen();
	}

	private async refreshReaderAnnotations(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(READER_VIEW_TYPE)) if (leaf.view instanceof ReaderView) await leaf.view.refreshAnnotations();
	}

	private async refreshReaderSourceRename(oldPath: string, newPath: string): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(READER_VIEW_TYPE)) if (leaf.view instanceof ReaderView) await leaf.view.handleSourceRename(oldPath, newPath);
	}

	private async refreshReaderSourceDelete(path: string): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(READER_VIEW_TYPE)) if (leaf.view instanceof ReaderView) await leaf.view.handleSourceDelete(path);
	}

	private commandRegistry(): { commands: Record<string, unknown>; executeCommandById(id: string): Promise<void> } {
		return (this.app as unknown as { commands: { commands: Record<string, unknown>; executeCommandById(id: string): Promise<void> } }).commands;
	}

	private resourceUrl(path: string): string | null {
		const adapter = this.app.vault.adapter;
		const pluginPath = `${this.manifest.dir}/${path}`;
		return adapter.getResourcePath?.(pluginPath) ?? null;
	}

	private async atomicTransform(path: string, transform: (current: string) => string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.process(existing, current => transform(current));
			return;
		}
		await this.ensureFile(path, await transform(''));
	}

	private async ensureFile(path: string, content: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return;
		await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
		await this.app.vault.create(path, content);
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = path.split('/').filter(Boolean);
		for (let index = 1; index <= parts.length; index += 1) {
			const partial = parts.slice(0, index).join('/');
			if (this.app.vault.getAbstractFileByPath(partial)) continue;
			try {
				await this.app.vault.createFolder(partial);
			} catch (error) {
				if (!isAlreadyExistingFolderError(error)) throw error;
			}
		}
	}

	private async writeBinary(path: string, value: ArrayBuffer): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, value);
		else {
			await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
			await this.app.vault.createBinary(path, value);
		}
	}
}

function toLibraryFile(file: TFile): LibraryFile {
	return { path: file.path, extension: file.extension, stat: { mtime: file.stat.mtime, size: file.stat.size } };
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function describeImageUploadFailure(error: unknown): string {
	if (error instanceof ObjectStorageConfigurationError) {
		return '图片上传失败：对象存储配置不完整。请到 Reading Desk 设置的“对象存储与图床”中补全 Endpoint、Bucket 与密钥。';
	}
	if (error instanceof ObjectStorageRequestError) {
		if (error.status === 401 || error.status === 403) return `图片上传失败：图床返回 HTTP ${error.status}，通常是 Access Key 或 Secret Key 不正确。请核对密钥后重试。`;
		return `图片上传失败：图床返回 HTTP ${error.status}。请检查 Endpoint 与 Bucket 设置后重试，图片仍保留在剪贴板中。`;
	}
	if (error instanceof ClipboardImageError) {
		return '图片上传失败：剪贴板中没有可上传的图片。';
	}
	return '图片上传失败：无法连接图床。请检查网络与对象存储设置后重试，图片仍保留在剪贴板中。';
}

function isLibraryPath(path: string): boolean { return /\.(pdf|epub)$/i.test(path); }
function isTargetPath(path: string): boolean { return /\.canvas$/i.test(path) || /\.excalidraw\.md$/i.test(path) || /\.md$/i.test(path); }
function targetMatches(file: TFile, type: TargetType): boolean {
	return type === 'canvas' ? file.extension === 'canvas' : type === 'excalidraw' ? file.path.endsWith('.excalidraw.md') : file.extension === 'md' && !file.path.endsWith('.excalidraw.md');
}

function isAlreadyExistingFolderError(error: unknown): boolean {
	return error instanceof Error && /folder already exists|already exists/i.test(error.message);
}

function readingDeskHighlightId(element: { customData?: Record<string, unknown> }): string | undefined {
	const readingDesk = element.customData?.readingDesk;
	if (typeof readingDesk !== 'object' || readingDesk === null) return undefined;
	const highlightId = (readingDesk as { highlightId?: unknown }).highlightId;
	return typeof highlightId === 'string' ? highlightId : undefined;
}

function createExcalidrawDocument(): string {
	const scene = { type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements: [] as unknown[], appState: {}, files: {} };
	return `---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n# Excalidraw Data\n\n## Text Elements\n%%\n## Drawing\n\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\`\n%%\n`;
}
