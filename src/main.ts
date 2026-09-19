import { MarkdownView, Notice, Plugin, TFile, type TAbstractFile } from 'obsidian';
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
import type { PreparedCropDrag } from './ui/crop/CropDragTransport';
import type { NormalizedPdfRect, ObjectStorageSettings, TargetType } from './types/contracts';
import { ReaderView, READER_VIEW_TYPE } from './views/ReaderView';
import { ShelfItemView, SHELF_VIEW_TYPE } from './views/ShelfItemView';

const LEGACY_DATA_PATHS = ['.obsidian/plugins/obsidian-bookshelf/data.json', '.obsidian/plugins/obsidian-bookshelf/metadata.json'];
const LEGACY_METADATA_FOLDER = '.obsidian/plugins/bookshelf/metadata';
const AI_CONTEXT_FOLDER = 'Reading Desk/AI Context';
const CROP_FOLDER = 'Reading Desk/裁剪';

type PluginRegistry = { enabledPlugins: Set<string>; getPlugin(id: string): unknown; };
type PreparedCropInput = { pdfPath: string; page: number; rect: NormalizedPdfRect; target: 'canvas' | 'image'; image: Blob; previewUrl: string; };

export default class ReadingDeskPlugin extends Plugin {
	repository!: ReadingDeskRepository;
	ai!: AiIntegrationService;
	private annotations!: AnnotationStore;
	private library!: LibraryIndex;
	private targets!: TargetService;
	private readonly preparedCrops = new Map<string, PreparedCropInput>();

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
		this.ai = new AiIntegrationService(this.pluginRegistry(), { opencodian: plugin => this.createOpenCodianBridge(plugin) });
		this.registerView(READER_VIEW_TYPE, leaf => new ReaderView(leaf, {
			createPdfRenderer: () => this.createPdfRenderer(),
			annotations: this.annotations,
			targets: this.targets,
			openFile: path => this.openReader(path),
			createTarget: type => this.createTarget(type),
			listTargets: type => this.listTargets(type),
			prepareCropDrag: input => this.prepareCropDrag(input),
			commitPreparedCrop: (token, targetPath) => this.commitPreparedCrop(token, targetPath),
			discardPreparedCrop: token => this.discardPreparedCrop(token),
			updateProgress: (path, progress) => this.updateProgress(path, progress),
			showTarget: (path, objectId) => this.showTarget(path, objectId),
			openTargetInSplit: (path, objectId) => this.openTargetInSplit(path, objectId),
			getReaderLayout: () => this.getReaderLayout(),
			setReaderLayout: layout => this.setReaderLayout(layout),
			readExcerptCards: path => this.readExcerptCards(path),
			updateExcerptCard: (highlightId, patch) => this.updateExcerptCard(highlightId, patch)
		}));
		this.registerView(SHELF_VIEW_TYPE, leaf => new ShelfItemView(leaf, this.library, {
			open: path => this.openReader(path),
			scan: () => this.scanLibrary(),
			resourceUrl: path => this.app.vault.adapter.getResourcePath(path)
		}));
		this.addRibbonIcon('book-open', '打开 Reading Desk 书架', () => this.openShelf());
		this.addCommand({ id: 'open-reading-desk', name: '打开 Reading Desk 书架', callback: () => this.openShelf() });
		this.addCommand({ id: 'scan-library', name: '扫描 Reading Desk 书库', callback: () => this.scanLibrary() });
		this.addCommand({ id: 'open-reader-in-focus-layout', name: '以专注布局打开 Reading Desk 阅读器', callback: () => this.openFocusedReader() });
		this.addCommand({ id: 'import-legacy-bookshelf', name: '导入旧 Bookshelf 数据（一次性）', callback: () => this.importLegacyBookshelf() });
		this.addCommand({ id: 'export-library-markdown', name: '导出 Reading Desk 书架为 Markdown（写入仓库）', callback: () => this.exportToVault('markdown') });
		this.addCommand({ id: 'export-library-json', name: '导出 Reading Desk 书架为 JSON（写入仓库）', callback: () => this.exportToVault('json') });
		this.addCommand({ id: 'ask-ai-about-selection', name: '将当前 Reading Desk 选区交给 AI', checkCallback: checking => this.askAiAboutCurrentSelection(checking) });
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
		for (const prepared of this.preparedCrops.values()) URL.revokeObjectURL(prepared.previewUrl);
		this.preparedCrops.clear();
	}

	notice(message: string): void { new Notice(message); }

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

	private async openReader(path: string): Promise<void> {
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: READER_VIEW_TYPE, state: {}, active: true });
		const reader = leaf.view instanceof ReaderView ? leaf.view : null;
		if (reader) await reader.openPdf(path);
	}

	private async openReaderHighlight(params: Record<string, string>): Promise<void> {
		const highlightId = params.highlight;
		const stored = highlightId ? this.annotations.get(highlightId) : undefined;
		const path = stored?.pdfPath ?? params.file;
		if (!path || !highlightId) {
			this.notice('Reading Desk 原文链接缺少文件或高亮标识。');
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: READER_VIEW_TYPE, state: {}, active: true });
		if (leaf.view instanceof ReaderView) await leaf.view.openPdfAtHighlight(path, highlightId);
	}

	private async updateProgress(path: string, progress: number): Promise<void> {
		const book = this.library.getByPath(path);
		if (book) {
			await this.library.updateProgress(book.id, progress);
			await this.refreshShelves();
		}
	}

	private async openFocusedReader(): Promise<void> {
		await this.setReaderLayout('focus');
		const active = this.app.workspace.getActiveFile();
		const path = active?.extension.toLowerCase() === 'pdf' ? active.path : this.library.list().find(book => book.format === 'pdf')?.path;
		if (!path) throw new Error('没有可打开的 PDF。请先扫描书库或打开一个 PDF。');
		await this.openReader(path);
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

	private async getReaderLayout(): Promise<'focus' | 'split'> {
		return this.repository.readSettings().readerLayout === 'focus' ? 'focus' : 'split';
	}

	private async setReaderLayout(layout: 'focus' | 'split'): Promise<void> {
		await this.repository.updateSettings({ readerLayout: layout });
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

	private async prepareCropDrag(input: Omit<PreparedCropInput, 'previewUrl'>): Promise<PreparedCropDrag> {
		const dragToken = `crop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const previewUrl = URL.createObjectURL(input.image);
		this.preparedCrops.set(dragToken, { ...input, previewUrl });
		return { dragToken, previewUrl, mimeType: input.image.type || 'image/png' };
	}

	private async discardPreparedCrop(dragToken: string): Promise<void> {
		const prepared = this.preparedCrops.get(dragToken);
		if (!prepared) return;
		this.preparedCrops.delete(dragToken);
		URL.revokeObjectURL(prepared.previewUrl);
	}

	private async commitPreparedCrop(dragToken: string, targetPath?: string): Promise<void> {
		const prepared = this.preparedCrops.get(dragToken);
		if (!prepared) throw new Error('裁剪预览已失效，请重新框选。');
		this.preparedCrops.delete(dragToken);
		URL.revokeObjectURL(prepared.previewUrl);
		await this.persistCrop(prepared, targetPath);
	}

	private async persistCrop(input: Omit<PreparedCropInput, 'previewUrl'>, targetPath?: string): Promise<void> {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const storage = this.repository.readSettings().storage;
		const imagePath = `${CROP_FOLDER}/裁剪-${id}.png`;
		let renderedImage: string;
		if (storage.enabled) {
			const uploaded = await new ObjectStorageService(storage).upload({ key: `crops/${id}.png`, body: input.image, contentType: 'image/png' });
			renderedImage = `![PDF 裁剪](<${uploaded.url}>)`;
		} else {
			await this.writeBinary(imagePath, await input.image.arrayBuffer());
			renderedImage = `![[${imagePath}]]`;
		}
		if (input.target === 'image') {
			const notePath = `Reading Desk/裁剪-${id}.md`;
			await this.ensureFile(notePath, `# PDF 裁剪\n\n${renderedImage}\n\n来源：${input.pdfPath} 第 ${input.page + 1} 页\n`);
			await this.app.workspace.openLinkText(notePath, '', false);
			this.notice('PDF 裁剪已保存为图片笔记。');
			return;
		}
		const canvasPath = targetPath ?? `Reading Desk/裁剪-${id}.canvas`;
		const cropNode = storage.enabled
			? { id: `rd-crop-${id}`, type: 'text', text: `${renderedImage}\n\n来源：${input.pdfPath} 第 ${input.page + 1} 页`, x: 0, y: 0, width: 640, height: 420,
				readingDesk: { schemaVersion: 1, kind: 'crop', pdfPath: input.pdfPath, page: input.page, rect: input.rect, remoteImage: renderedImage } }
			: { id: `rd-crop-${id}`, type: 'file', file: imagePath, x: 0, y: 0, width: 640, height: 420,
				readingDesk: { schemaVersion: 1, kind: 'crop', pdfPath: input.pdfPath, page: input.page, rect: input.rect } };
		await this.appendCropNode(canvasPath, cropNode);
		await this.app.workspace.openLinkText(canvasPath, '', false);
		this.notice('PDF 裁剪已保存并加入 Canvas。');
	}

	private async appendCropNode(path: string, node: Record<string, unknown>): Promise<void> {
		const initial = '{\n  "nodes": [],\n  "edges": []\n}\n';
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (!(existing instanceof TFile)) await this.ensureFile(path, initial);
		await this.atomicTransform(path, current => {
			const parsed: unknown = JSON.parse(current);
			if (!isCanvasDocument(parsed)) throw new Error('裁剪目标不是有效 Canvas 文件。');
			parsed.nodes.push(node);
			return `${JSON.stringify(parsed, null, 2)}\n`;
		});
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

function isCanvasDocument(value: unknown): value is { nodes: Record<string, unknown>[]; edges: unknown[] } {
	return typeof value === 'object' && value !== null
		&& Array.isArray((value as { nodes?: unknown }).nodes)
		&& Array.isArray((value as { edges?: unknown }).edges);
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
