import { addIcon, MarkdownView, Notice, Plugin, setIcon, TFile, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import { AnnotationStore } from './annotations/AnnotationStore';
import { ReadingDeskRepository } from './data/ReadingDeskRepository';
import { LibraryIndex, type LibraryFile } from './library/LibraryIndex';
import { MetadataExtractor } from './library/MetadataExtractor';
import { PdfRenderer } from './reader/PdfRenderer';
import { AiIntegrationService, type AiBridge } from './ai/AiIntegrationService';
import { exportBookshelf, importLegacyBookshelf, type BookshelfImportResult } from './portability/BookshelfPortabilityService';
import { MarkdownImagePasteService } from './storage/MarkdownImagePasteService';
import { readLegacyBookshelfSource } from './portability/LegacyBookshelfSourceReader';
import { createExcalidrawDocument, describeImageUploadFailure, isAlreadyExistingFolderError, prefersReducedMotion, readingDeskHighlightId, targetMatches } from './host/HostUtilities';
import { VaultChangeBatch } from './host/VaultChangeBatch';
import { remapAnnotationPaths } from './host/SourcePathRemap';
import { RecoverySnapshotFiles } from './host/RecoverySnapshotFiles';
import { RecoverySnapshotService } from './portability/RecoverySnapshotService';
import { presentBackupPreview } from './host/DataPanelPresentation';
import { ReadingDeskDataManagement } from './portability/ReadingDeskDataManagement';
import type { BackupRestorePreview } from './portability/ReadingDeskBackupService';
import type { ImportExportPanelHost } from './ui/portability/ImportExportPanel';
import { AnnotationSearchService } from './annotations/AnnotationSearchService';
import { ObjectStorageService } from './storage/ObjectStorageService';
import { ReadingDeskSettingTab } from './settings/ReadingDeskSettingTab';
import { TargetService } from './targets';
import type { ObjectStorageSettings, PdfHighlight, TargetType, ViewerSettings } from './types/contracts';
import { ReaderView, READER_VIEW_TYPE } from './views/ReaderView';
import { CropImageService } from './storage/CropImageService';
import { ProgressFlusher } from './library/ProgressFlusher';
import { detachDuplicateNavigationLeaves, PdfNavigationView, PDF_NAVIGATION_VIEW_TYPE } from './views/PdfNavigationView';
import { ShelfItemView, SHELF_VIEW_TYPE } from './views/ShelfItemView';
import { createHighlightLink, createPageCitation, writeReadingDeskLink } from './reader/ReadingDeskLinks';
import { canCopyReaderPage, executeCopyReaderPage } from './reader/ReaderCopyCommand';
import { routeReadingDeskLink } from './reader/ReadingDeskLinkRouter';
import { hostThemeDark, marginAnchorIconId, READING_DESK_MARGIN_ANCHOR_DAY, READING_DESK_MARGIN_ANCHOR_NIGHT } from './ui/icons/ReadingDeskIcons';

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
	private vaultChanges!: VaultChangeBatch;
	private recoveryFiles!: RecoverySnapshotFiles;
	private recoverySnapshots!: RecoverySnapshotService;
	private dataManagement!: ReadingDeskDataManagement;
	private annotationSearch!: AnnotationSearchService;
	async onload(): Promise<void> {
		this.recoveryFiles = new RecoverySnapshotFiles(this.app.vault.adapter, `${this.manifest.dir}/recovery`);
		this.recoverySnapshots = new RecoverySnapshotService(this.recoveryFiles);
		this.repository = new ReadingDeskRepository({ load: () => this.loadData(), save: data => this.saveData(data) }, {
			beforeOverwrite: (value, context) => this.preserveDataSnapshot(value, context.reason)
		});
		await this.repository.initialize();
		this.annotations = new AnnotationStore(this.repository);
		this.library = new LibraryIndex(this.repository, new MetadataExtractor({
			readBinary: path => this.app.vault.adapter.readBinary(path),
			writeBinary: (path, value) => this.writeBinary(path, value)
		}, { load: data => this.loadPdfMetadata(data) }));
		this.targets = new TargetService({
			atomicTransform: (path, transform) => this.atomicTransform(path, transform),
			read: path => this.app.vault.getAbstractFileByPath(path) instanceof TFile ? this.app.vault.adapter.read(path) : Promise.resolve(undefined)
		}, { template: () => this.repository.readSettings().excerptTemplate });
		this.annotationSearch = new AnnotationSearchService(this.annotations, this.library);
		this.dataManagement = new ReadingDeskDataManagement(this.repository, this.library, this.annotations, this.targets, {
			availableFiles: () => this.app.vault.getFiles().filter(file => isLibraryPath(file.path)).map(file => ({ path: file.path, stat: { mtime: file.stat.mtime, size: file.stat.size } })),
			allPaths: () => this.app.vault.getFiles().map(file => file.path), backupBeforeRestore: backup => this.preserveDataSnapshot(backup, 'before-restore'),
			refresh: async () => { await this.refreshShelves(); await this.refreshReaderAnnotations(); }
		});
		this.vaultChanges = new VaultChangeBatch(paths => this.applyVaultChanges(paths), error => this.notice(`书库更新失败：${error instanceof Error ? error.message : String(error)}`));
		this.register(() => this.vaultChanges.dispose());
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
			readerState: {
				read: path => this.library.readReaderState(path), savePosition: (id, position) => this.library.saveReaderPosition(id, position),
				saveBookmark: (id, bookmark) => this.library.saveBookmark(id, bookmark), removeBookmark: (id, bookmarkId) => this.library.removeBookmark(id, bookmarkId)
			},
			sourceFingerprint: path => { const file = this.app.vault.getAbstractFileByPath(path); return file instanceof TFile ? { mtime: file.stat.mtime, size: file.stat.size } : undefined; },
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
			copyPageLink: (path, page, label) => this.copyPageLink(path, page, label),
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
			openSettings: tab => this.openPluginSettings(tab ?? 'library'),
			countHighlights: () => this.annotations.listAll().length, lastReadPage: id => { const book = this.library.get(id); const p = book && this.library.readReaderState(book.path)?.position; return p ? p.page + 1 : undefined; },
			readShelfState: () => structuredClone(this.repository.readSettings().shelf), saveShelfState: shelf => this.repository.updateSettings({ shelf }),
			searchAnnotations: query => this.annotationSearch.search(query), openHighlight: (path, id) => this.openLinkedReader(path, id),
			listSourcePaths: () => this.app.vault.getFiles().filter(file => isLibraryPath(file.path)).map(file => file.path),
			candidateFiles: () => this.app.vault.getFiles().filter(file => isLibraryPath(file.path)).map(toLibraryFile), relinkBook: (id, path) => this.relinkBook(id, path)
		}));
		this.app.workspace.onLayoutReady(() => {
			if (this.app.workspace.getLeavesOfType(READER_VIEW_TYPE).some(leaf => !!leaf.view.getState().pdfPath)) void this.openPdfNavigation(false);
			for (const path of new Set(this.annotations.listAll().map(item => item.target?.path).filter((path): path is string => !!path))) this.vaultChanges.add(path);
		});
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
		this.register(this.repository.subscribe(status => {
			if (status.phase === 'blocked' || status.phase === 'conflict' || status.phase === 'pending') this.notice(`Reading Desk：${status.error?.message ?? '存在未保存数据'}。请打开设置中的数据恢复。`);
		}));
		this.addSettingTab(new ReadingDeskSettingTab(this));
		this.registerObsidianProtocolHandler('reading-desk-highlight', params => void this.openReaderHighlight(params));
		this.registerEvent(this.app.vault.on('create', file => void this.onVaultCreateOrModify(file)));
		this.registerEvent(this.app.vault.on('modify', file => void this.onVaultCreateOrModify(file)));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => void this.onVaultRename(file, oldPath).catch(error => this.notice(`重命名同步失败：${String(error)}`))));
		this.registerEvent(this.app.vault.on('delete', file => void this.onVaultDelete(file).catch(error => this.notice(`文件缺失处理失败：${String(error)}`))));
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
		if (patch.outlineStyle) for (const leaf of this.app.workspace.getLeavesOfType(READER_VIEW_TYPE)) if (leaf.view instanceof ReaderView) leaf.view.applyOutlineStyle(patch.outlineStyle);
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

	dataPanelHost(): ImportExportPanelHost {
		const service = this.dataManagement;
		return {
			recoverySnapshots: () => this.recoverySnapshots.inventory(), previewSnapshotCleanup: policy => this.recoverySnapshots.previewCleanup(policy),
			cleanupSnapshots: preview => this.recoverySnapshots.cleanup(preview), loadRecoverySnapshot: entry => this.recoverySnapshots.backupText(entry),
			importLegacy: () => this.importLegacyBookshelf(), exportMarkdown: () => this.exportMarkdown(), exportJson: () => this.exportJson(), status: () => this.portabilityStatus(),
			prepareBibliographicImport: (provider, text, paths) => service.prepareBibliographicImport(provider, text, paths), applyBibliographicImport: (plan, selectedKeys) => service.applyBibliographicImport(plan, selectedKeys),
			exportBackup: () => service.exportBackup(), previewBackup: (text, mappings, options) => presentBackupPreview(service.previewBackup(text, mappings, options), mappings),
			restoreBackup: preview => service.restoreBackup(preview.plan as BackupRestorePreview),
			repositoryStatus: () => this.repository.status(), retryRepository: () => service.retryRepository(), reloadRepository: () => service.reloadRepository(),
			recoveryStatus: () => ({ pendingTargets: this.annotations.listPendingTargetWrites().map(item => ({ id: item.id, label: item.text.slice(0, 80), detail: item.target?.path })), deletedAnnotations: this.annotations.listDeleted().map(item => ({ id: item.highlight.id, label: item.highlight.text.slice(0, 80), detail: item.reason })), repairs: this.targets.listPendingRepairs().map(item => ({ id: item.target.path, label: item.target.path, detail: item.message })) }),
			retryTargetWrite: id => service.retryTargetWrite(id), restoreDeletedAnnotation: id => service.restoreDeletedAnnotation(id), recheckTarget: path => this.syncTargetDeletion(path),
			excerptTemplate: () => service.excerptTemplate(), previewExcerptTemplate: template => service.previewExcerptTemplate(template), saveExcerptTemplate: template => service.saveExcerptTemplate(template)
		};
	}

	private async openShelf(): Promise<void> {
		await this.scanLibrary(false);
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: SHELF_VIEW_TYPE, state: {}, active: true });
	}

	private async openReader(path: string, page?: number): Promise<void> {
		const leaf = this.readerLeafFor(path) ?? this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: READER_VIEW_TYPE, state: {}, active: true });
		const reader = leaf.view instanceof ReaderView ? leaf.view : null;
		if (reader) { await reader.openPdf(path, page); await this.openPdfNavigation(false); }
	}

	/** Reuses the reader leaf already showing this PDF so links never stack duplicate tabs. */
	private readerLeafFor(path: string): WorkspaceLeaf | null {
		return this.app.workspace.getLeavesOfType(READER_VIEW_TYPE).find(leaf => leaf.view.getState().pdfPath === path) ?? null;
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

	private async copyPageLink(path: string, page: number, pageLabel?: string): Promise<void> {
		const link = createPageCitation({ file: path, page, pageLabel, bookId: this.library.getByPath(path)?.id });
		await this.copyLink(link, `已复制第 ${pageLabel || page} 页链接。`);
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
		const existing = this.app.workspace.getLeavesOfType(PDF_NAVIGATION_VIEW_TYPE);
		let leaf = existing.find(item => item.view instanceof PdfNavigationView) ?? existing[0];
		if (!leaf) {
			leaf = this.app.workspace.getLeftLeaf(true) ?? undefined;
			if (!leaf) return;
			await leaf.setViewState({ type: PDF_NAVIGATION_VIEW_TYPE, state: {}, active: focus });
		}
		detachDuplicateNavigationLeaves(this.app.workspace, PDF_NAVIGATION_VIEW_TYPE, leaf);
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
		await this.targets.writeAndSaveExcerpt(highlight.target, highlight, this.annotations, next);
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

	private preserveDataSnapshot(value: unknown, reason: string): Promise<void> { return this.recoveryFiles.preserve(value, reason); }

	private async applyVaultChanges(paths: string[]): Promise<void> {
		const files = paths.filter(isLibraryPath).map(path => this.app.vault.getAbstractFileByPath(path)).filter((file): file is TFile => file instanceof TFile);
		if (files.length) {
			await this.library.scanFiles(files.map(toLibraryFile), this.repository.readSettings().libraryFolders);
			await this.refreshShelves();
		}
		for (const path of paths.filter(isTargetPath)) await this.syncTargetDeletion(path);
	}

	private async onVaultCreateOrModify(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) return;
		if (isLibraryPath(file.path) || isTargetPath(file.path)) this.vaultChanges.add(file.path);
	}

	private remapAnnotations(oldPath: string, newPath: string): string[] {
		const pending = this.repository.readPendingTargetWrites();
		const ids = remapAnnotationPaths({ highlights: this.repository.readHighlights(), pendingTargetWrites: pending, deletedAnnotations: this.repository.readDeletedAnnotations() }, oldPath, newPath);
		for (const id of ids) { const highlight = this.annotations.get(id); if (highlight?.target) pending[id] = structuredClone(highlight); }
		return ids;
	}

	private async relinkBook(id: string, path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile) || !isLibraryPath(path)) throw new Error('请确认当前库内的 PDF 或 EPUB 文件。');
		const result = await this.library.relink(id, toLibraryFile(file), { confirmed: true, mutateRelated: (oldPath, newPath) => { this.remapAnnotations(oldPath, newPath); } });
		await this.refreshReaderSourceRename(result.oldPath, result.newPath);
		await this.targets.retryPendingTargetWrites(this.annotations);
		await this.refreshShelves(); await this.refreshReaderAnnotations();
	}

	private async onVaultRename(file: TAbstractFile, oldPath: string): Promise<void> {
		const affected = this.app.workspace.getLeavesOfType(READER_VIEW_TYPE).filter(leaf => leaf.view instanceof ReaderView).map(leaf => leaf.view as ReaderView).map(reader => reader.getState().pdfPath).filter((path): path is string => typeof path === 'string' && (path === oldPath || path.startsWith(`${oldPath}/`)));
		await this.library.renamePaths(oldPath, file.path, (before, after) => { this.remapAnnotations(before, after); });
		for (const path of affected) await this.refreshReaderSourceRename(path, file.path + path.slice(oldPath.length));
		await this.targets.retryPendingTargetWrites(this.annotations);
		if (file instanceof TFile && isLibraryPath(file.path)) this.vaultChanges.add(file.path);
		if (file instanceof TFile && isTargetPath(file.path)) await this.syncTargetDeletion(file.path);
		await this.refreshShelves();
	}

	private async onVaultDelete(file: TAbstractFile): Promise<void> {
		const path = file.path;
		const affected = this.library.list().filter(book => book.path === path || book.path.startsWith(`${path}/`));
		const targets = this.annotations.listAll().filter(item => item.target && (item.target.path === path || item.target.path.startsWith(`${path}/`)));
		if (!affected.length && !targets.length) return;
		await this.library.markMissing(path);
		for (const targetPath of new Set(targets.map(item => item.target.path))) this.targets.reportMissingTarget(targetPath, targets);
		for (const book of affected) await this.refreshReaderSourceDelete(book.path);
		await this.refreshShelves();
		this.notice(`文件 ${path} 暂时缺失，书目、标注与评论已保留，可重新关联源文件或恢复目标文件。`);
	}

	private async syncTargetDeletion(path: string): Promise<void> {
		if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFile)) { this.targets.reportMissingTarget(path, this.annotations.listAll()); return; }
		let changed = false;
		for (const type of ['canvas', 'excalidraw', 'markdown'] as TargetType[]) {
			try {
				const candidates = this.annotations.listAll().filter(highlight => highlight.target?.path === path && highlight.target.type === type);
				if (!candidates.length) continue;
				const removed = await this.targets.removeMissingTargetHighlights({ type, path }, candidates, this.annotations);
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

	private readLegacyBookshelfData(): Promise<unknown | null> {
		const adapter = this.app.vault.adapter;
		return readLegacyBookshelfSource({ exists: path => adapter.exists(path), read: path => adapter.read(path), list: path => adapter.list(path), notice: message => this.notice(message) });
	}

	private async replaceRepositoryData(next: ReturnType<ReadingDeskRepository['snapshot']>): Promise<void> {
		await this.repository.replaceData(next);
		this.library.rebuildPathMap();
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
		if (existing instanceof TFile) return this.app.vault.modifyBinary(existing, value);
		// Covers live under .obsidian/plugins, outside the vault index; the adapter sees them.
		if (await this.app.vault.adapter.exists(path)) return this.app.vault.adapter.writeBinary(path, value);
		await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
		await this.app.vault.createBinary(path, value);
	}
}

function toLibraryFile(file: TFile): LibraryFile {
	return { path: file.path, extension: file.extension, stat: { mtime: file.stat.mtime, size: file.stat.size } };
}

function isLibraryPath(path: string): boolean { return /\.(pdf|epub)$/i.test(path); }
function isTargetPath(path: string): boolean { return /\.canvas$/i.test(path) || /\.excalidraw\.md$/i.test(path) || /\.md$/i.test(path); }
