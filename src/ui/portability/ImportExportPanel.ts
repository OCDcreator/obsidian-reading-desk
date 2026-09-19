import {
	errorMessage,
	exportFilename,
	exportSuccessMessage,
	importResultMessage,
	initialPanelState,
	type ImportExportPanelState,
	type LegacyImportResult,
	type PortabilityStatus
} from './ImportExportPanelState';

type Awaitable<T> = T | Promise<T>;
type ExportFormat = 'markdown' | 'json';
export type ExportContent = Blob | string;

export interface ImportExportPanelHost {
	importLegacy(): Awaitable<LegacyImportResult>;
	exportMarkdown(): Awaitable<ExportContent>;
	exportJson(): Awaitable<ExportContent>;
	status(): Awaitable<PortabilityStatus>;
}

export interface BlobUrlApi {
	createObjectURL(blob: Blob): string;
	revokeObjectURL(url: string): void;
}

/**
 * A host-driven, vanilla DOM portability surface. It never reads old plugin
 * data or writes files directly: persistence and data conversion stay behind
 * the supplied host contract.
 */
export class ImportExportPanel {
	private container: HTMLElement | null = null;
	private state: ImportExportPanelState = initialPanelState();

	constructor(private readonly host: ImportExportPanelHost) { }

	render(container: HTMLElement): void {
		this.container = container;
		this.state = { ...initialPanelState(), operation: 'loading-import', message: '正在读取导入状态…' };
		this.renderCurrent();
		void this.loadStatus();
	}

	destroy(): void {
		if (this.container) this.container.replaceChildren();
		this.container = null;
	}

	private async loadStatus(): Promise<void> {
		try {
			const status = await this.host.status();
			this.state = {
				status,
				statusReady: true,
				operation: 'idle',
				message: status.importedBookshelf
					? '旧 Bookshelf 数据已导入。为避免重复写入，此操作已锁定。'
					: initialPanelState().message
			};
		} catch (error) {
			this.state = {
				...initialPanelState(),
				operation: 'error',
				message: errorMessage(error, '无法读取导入状态。')
			};
		}
		this.renderCurrent();
	}

	private renderCurrent(): void {
		if (!this.container) return;
		const root = document.createElement('section');
		root.className = 'rd-import-export-panel';
		root.setAttribute('aria-label', '导入与导出');
		root.setAttribute('aria-busy', String(this.isLoading()));
		root.append(this.createHeading(), this.createImportSection(), this.createExportSection(), this.createStatus());
		this.container.replaceChildren(root);
	}

	private createHeading(): HTMLElement {
		const heading = document.createElement('h3');
		heading.className = 'rd-import-export-panel__heading';
		heading.textContent = '导入与导出';
		return heading;
	}

	private createImportSection(): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-import-export-panel__import';
		section.setAttribute('aria-label', '导入旧 Bookshelf 数据');
		const description = document.createElement('p');
		description.textContent = '导入旧 Bookshelf 的书目与分类；不会修改旧插件数据。此操作在当前库中只能执行一次。';
		const action = this.createButton('导入旧 Bookshelf 数据', '导入旧 Bookshelf 数据', () => void this.importLegacy());
		action.disabled = this.isLoading() || !this.state.statusReady || this.state.status.importedBookshelf;
		if (this.state.status.importedBookshelf) action.setAttribute('aria-describedby', 'rd-import-export-status');
		section.append(description, action);
		return section;
	}

	private createExportSection(): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-import-export-panel__export';
		section.setAttribute('aria-label', '导出当前书架');
		const description = document.createElement('p');
		description.textContent = '下载当前书架的可阅读 Markdown 清单或完整 JSON 备份。';
		const actions = document.createElement('div');
		actions.className = 'rd-import-export-panel__actions';
		const markdown = this.createButton('导出 Markdown', '导出书架 Markdown', () => void this.export('markdown'));
		const json = this.createButton('导出 JSON', '导出书架 JSON', () => void this.export('json'));
		markdown.disabled = this.isLoading();
		json.disabled = this.isLoading();
		actions.append(markdown, json);
		section.append(description, actions);
		return section;
	}

	private createStatus(): HTMLElement {
		const wrapper = document.createElement('div');
		wrapper.className = 'rd-import-export-panel__status-wrap';
		const status = document.createElement('p');
		status.id = 'rd-import-export-status';
		status.className = `rd-import-export-panel__status is-${this.state.operation}`;
		status.setAttribute('role', this.state.operation === 'error' ? 'alert' : 'status');
		status.setAttribute('aria-live', 'polite');
		status.textContent = this.state.message;
		wrapper.append(status);
		if (this.state.operation === 'error' && !this.state.statusReady) {
			wrapper.append(this.createButton('重试读取状态', '重试读取旧 Bookshelf 导入状态', () => void this.retryStatus()));
		}
		return wrapper;
	}

	private createButton(label: string, accessibleLabel: string, action: () => void): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'rd-button rd-import-export-panel__button';
		button.textContent = label;
		button.setAttribute('aria-label', accessibleLabel);
		button.addEventListener('click', action);
		return button;
	}

	private async importLegacy(): Promise<void> {
		if (this.isLoading() || this.state.status.importedBookshelf) return;
		this.setLoading('loading-import', '正在导入旧 Bookshelf 数据…');
		try {
			const result = await this.host.importLegacy();
			this.state = {
				status: { importedBookshelf: true },
				statusReady: true,
				operation: 'success',
				message: importResultMessage(result)
			};
		} catch (error) {
			this.setError(error, '导入旧 Bookshelf 数据失败。');
		}
		this.renderCurrent();
	}

	private async export(format: ExportFormat): Promise<void> {
		if (this.isLoading()) return;
		const label = format === 'markdown' ? '正在准备 Markdown 导出…' : '正在准备 JSON 备份…';
		this.setLoading(format === 'markdown' ? 'loading-markdown' : 'loading-json', label);
		try {
			const content = format === 'markdown' ? await this.host.exportMarkdown() : await this.host.exportJson();
			const mime = format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8';
			downloadBlob(toBlob(content, mime), exportFilename(format));
			this.state = { ...this.state, operation: 'success', message: exportSuccessMessage(format) };
		} catch (error) {
			this.setError(error, format === 'markdown' ? 'Markdown 导出失败。' : 'JSON 导出失败。');
		}
		this.renderCurrent();
	}

	private async retryStatus(): Promise<void> {
		if (this.isLoading()) return;
		this.state = { ...this.state, operation: 'loading-import', message: '正在重新读取导入状态…' };
		this.renderCurrent();
		await this.loadStatus();
	}

	private setLoading(operation: Extract<ImportExportPanelState['operation'], `loading-${string}`>, message: string): void {
		this.state = { ...this.state, operation, message };
		this.renderCurrent();
	}

	private setError(error: unknown, fallback: string): void {
		this.state = { ...this.state, operation: 'error', message: errorMessage(error, fallback) };
	}

	private isLoading(): boolean {
		return this.state.operation.startsWith('loading-');
	}
}

export function toBlob(content: ExportContent, mime: string): Blob {
	return content instanceof Blob ? content : new Blob([content], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string, documentRef = document, urlApi: BlobUrlApi = URL): void {
	const href = urlApi.createObjectURL(blob);
	const link = documentRef.createElement('a');
	link.href = href;
	link.download = filename;
	link.hidden = true;
	documentRef.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => urlApi.revokeObjectURL(href), 0);
}
