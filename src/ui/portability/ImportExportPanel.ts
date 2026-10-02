import {
	exportFilename,
	exportSuccessMessage,
	importResultMessage,
	initialPanelState,
	type ImportExportPanelState,
	type LegacyImportResult,
	type PortabilityStatus
} from './ImportExportPanelState';

import { BackupRestorePanel } from './BackupRestorePanel';
import { BibliographicImportPanel } from './BibliographicImportPanel';
import { RepositoryRecoveryPanel } from './RepositoryRecoveryPanel';
import { RecoverySnapshotPanel } from './RecoverySnapshotPanel';
import { ExcerptTemplatePanel } from './ExcerptTemplatePanel';
import type { Awaitable, DataPanelHost, ExportContent } from './DataPanelHost';
import type { PanelSection } from './PanelSection';
export type { ExportContent, DataPanelHost, BackupPanelPreview, BackupPanelOptions, RecoveryPanelStatus } from './DataPanelHost';

type ExportFormat = 'markdown' | 'json';

const CONFIRM_MESSAGE = '导入只能执行一次。请再次点击“确认导入”完成操作，或点击“取消”返回。';

export interface ImportExportPanelHost extends DataPanelHost {
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
 *
 * The panel builds its DOM once per render and afterwards only mutates the
 * existing nodes (text, classes, disabled and hidden state). Rebuilding the
 * status node on every state change would silence its live region, so state
 * updates go through updateView() instead.
 */
export class ImportExportPanel {
	private container: HTMLElement | null = null;
	private root: HTMLElement | null = null;
	private importButton: HTMLButtonElement | null = null;
	private cancelConfirmButton: HTMLButtonElement | null = null;
	private markdownButton: HTMLButtonElement | null = null;
	private jsonButton: HTMLButtonElement | null = null;
	private statusNode: HTMLParagraphElement | null = null;
	private retryButton: HTMLButtonElement | null = null;
	private state: ImportExportPanelState = initialPanelState();
	private confirmPending = false;
	private sections: PanelSection[] = [];
	private generation = 0;

	constructor(private readonly host: ImportExportPanelHost) { }

	render(container: HTMLElement): void {
		this.destroy();
		this.container = container;
		this.confirmPending = false;
		this.state = { ...initialPanelState(), operation: 'loading-import', message: '正在读取导入状态…' };
		this.buildPanel();
		void this.loadStatus();
	}

	destroy(): void {
		this.generation++;
		for (const section of this.sections) section.destroy();
		this.sections = [];
		if (this.container) this.container.replaceChildren();
		this.container = null;
		this.root = null;
		this.importButton = null;
		this.cancelConfirmButton = null;
		this.markdownButton = null;
		this.jsonButton = null;
		this.statusNode = null;
		this.retryButton = null;
	}

	private buildPanel(): void {
		if (!this.container) return;
		const root = document.createElement('section');
		root.className = 'rd-import-export-panel';
		root.setAttribute('aria-label', '导入与导出');
		root.append(this.createImportSection(), this.createExportSection(), this.createStatusWrap());
		this.buildDataSections(root);
		this.root = root;
		this.container.replaceChildren(root);
		this.updateView();
	}

	private buildDataSections(root: HTMLElement): void {
		if (this.host.repositoryStatus || this.host.recoveryStatus) this.sections.push(new RepositoryRecoveryPanel(this.host));
		if (this.host.exportBackup || this.host.previewBackup) {
			const backup = new BackupRestorePanel(this.host, (content, filename) => downloadBlob(toBlob(content, 'application/json;charset=utf-8'), filename));
			if (this.host.recoverySnapshots) this.sections.push(new RecoverySnapshotPanel(this.host, text => backup.loadSnapshot(text)));
			this.sections.push(backup);
		}
		if (this.host.prepareBibliographicImport) this.sections.push(new BibliographicImportPanel(this.host));
		if (this.host.excerptTemplate && this.host.previewExcerptTemplate) this.sections.push(new ExcerptTemplatePanel(this.host));
		for (const section of this.sections) root.append(section.root);
	}

	private createImportSection(): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-import-export-panel__import';
		section.setAttribute('aria-label', '导入旧 Bookshelf 数据');
		const description = document.createElement('p');
		description.textContent = '导入旧 Bookshelf 的书目与分类；不会修改旧插件数据。此操作在当前库中只能执行一次，执行前需要二次确认。';
		const actions = document.createElement('div');
		actions.className = 'rd-import-export-panel__actions';
		this.importButton = this.createButton('导入旧 Bookshelf 数据', '导入旧 Bookshelf 数据', () => this.handleImportClick());
		this.cancelConfirmButton = this.createButton('取消', '取消导入确认', () => this.cancelImportConfirm());
		this.cancelConfirmButton.hidden = true;
		actions.append(this.importButton, this.cancelConfirmButton);
		section.append(description, actions);
		return section;
	}

	private createExportSection(): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-import-export-panel__export';
		section.setAttribute('aria-label', '导出当前书架');
		const description = document.createElement('p');
		description.textContent = '下载当前书架的 Markdown 或 JSON 清单。书架导出仅包含书目与分类；标注、评论与摘录状态请使用完整备份。';
		const actions = document.createElement('div');
		actions.className = 'rd-import-export-panel__actions';
		this.markdownButton = this.createButton('导出 Markdown', '导出书架 Markdown', () => void this.export('markdown'));
		this.jsonButton = this.createButton('导出 JSON', '导出书架 JSON', () => void this.export('json'));
		actions.append(this.markdownButton, this.jsonButton);
		section.append(description, actions);
		return section;
	}

	private createStatusWrap(): HTMLElement {
		const wrapper = document.createElement('div');
		wrapper.className = 'rd-import-export-panel__status-wrap';
		const status = document.createElement('p');
		status.id = 'rd-import-export-status';
		status.className = 'rd-import-export-panel__status';
		status.setAttribute('role', 'status');
		status.setAttribute('aria-live', 'polite');
		this.statusNode = status;
		this.retryButton = this.createButton('重试读取状态', '重试读取旧 Bookshelf 导入状态', () => void this.retryStatus());
		this.retryButton.hidden = true;
		wrapper.append(status, this.retryButton);
		return wrapper;
	}

	private handleImportClick(): void {
		if (this.isLoading() || !this.state.statusReady || this.state.status.importedBookshelf) return;
		if (!this.confirmPending) {
			this.confirmPending = true;
			this.updateView();
			return;
		}
		this.confirmPending = false;
		void this.importLegacy();
	}

	private cancelImportConfirm(): void {
		this.confirmPending = false;
		this.updateView();
	}

	private updateView(): void {
		const root = this.root;
		if (!root) return;
		root.setAttribute('aria-busy', String(this.isLoading()));
		this.updateImportSection();
		this.updateExportSection();
		this.updateStatus();
	}

	private updateImportSection(): void {
		const importButton = this.importButton;
		if (!importButton) return;
		const busy = this.isLoading();
		const locked = this.state.status.importedBookshelf;
		importButton.disabled = busy || !this.state.statusReady || locked;
		importButton.textContent = this.confirmPending ? '确认导入' : '导入旧 Bookshelf 数据';
		importButton.setAttribute('aria-label', this.confirmPending ? '确认导入旧 Bookshelf 数据' : '导入旧 Bookshelf 数据');
		if (locked) importButton.setAttribute('aria-describedby', 'rd-import-export-status');
		else importButton.removeAttribute('aria-describedby');
		const cancelButton = this.cancelConfirmButton;
		if (cancelButton) {
			cancelButton.hidden = !this.confirmPending || busy || locked;
			cancelButton.disabled = busy;
		}
	}

	private updateExportSection(): void {
		const busy = this.isLoading();
		if (this.markdownButton) this.markdownButton.disabled = busy;
		if (this.jsonButton) this.jsonButton.disabled = busy;
	}

	private updateStatus(): void {
		const status = this.statusNode;
		if (!status) return;
		status.className = `rd-import-export-panel__status is-${this.state.operation}`;
		status.setAttribute('role', this.state.operation === 'error' ? 'alert' : 'status');
		status.setAttribute('aria-live', this.state.operation === 'error' ? 'assertive' : 'polite');
		status.textContent = this.confirmPending && !this.isLoading() ? CONFIRM_MESSAGE : this.state.message;
		const retryButton = this.retryButton;
		if (retryButton) retryButton.hidden = !(this.state.operation === 'error' && !this.state.statusReady);
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

	private async loadStatus(): Promise<void> {
		const generation = this.generation;
		try {
			const status = await this.host.status();
			if (generation !== this.generation) return;
			this.state = {
				status,
				statusReady: true,
				operation: 'idle',
				message: status.importedBookshelf
					? '旧 Bookshelf 数据已导入。为避免重复写入，此操作已锁定。'
					: initialPanelState().message
			};
		} catch (error) {
			if (generation !== this.generation) return;
			this.state = {
				...initialPanelState(),
				operation: 'error',
				message: describeError(error, '无法读取导入状态。')
			};
		}
		this.updateView();
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
		this.updateView();
	}

	private async export(format: ExportFormat): Promise<void> {
		if (this.isLoading()) return;
		const label = format === 'markdown' ? '正在准备 Markdown 导出…' : '正在准备书架 JSON 导出…';
		this.setLoading(format === 'markdown' ? 'loading-markdown' : 'loading-json', label);
		try {
			const content = format === 'markdown' ? await this.host.exportMarkdown() : await this.host.exportJson();
			const mime = format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8';
			downloadBlob(toBlob(content, mime), exportFilename(format));
			this.state = { ...this.state, operation: 'success', message: exportSuccessMessage(format) };
		} catch (error) {
			this.setError(error, format === 'markdown' ? 'Markdown 导出失败。' : 'JSON 导出失败。');
		}
		this.updateView();
	}

	private async retryStatus(): Promise<void> {
		if (this.isLoading()) return;
		this.state = { ...this.state, operation: 'loading-import', message: '正在重新读取导入状态…' };
		this.updateView();
		await this.loadStatus();
	}

	private setLoading(operation: Extract<ImportExportPanelState['operation'], `loading-${string}`>, message: string): void {
		this.state = { ...this.state, operation, message };
		this.updateView();
	}

	private setError(error: unknown, fallback: string): void {
		this.state = { ...this.state, operation: 'error', message: describeError(error, fallback) };
	}

	private isLoading(): boolean {
		return this.state.operation.startsWith('loading-');
	}
}

/**
 * Maps an internal failure to Chinese copy with a next step. The raw
 * exception text is never shown; only permission and path details survive,
 * shortened, because those are the ones a reader can act on.
 */
function describeError(error: unknown, fallback: string): string {
	const nextStep = '请重试；若持续失败，请检查 Reading Desk 的存储设置。';
	const reason = errorReason(error);
	return reason ? `${fallback}原因可能是${reason}。${nextStep}` : `${fallback}${nextStep}`;
}

function errorReason(error: unknown): string {
	const raw = error instanceof Error ? error.message : '';
	if (/EACCES|EPERM|permission denied/i.test(raw)) return '存储位置没有写入权限';
	if (/ENOENT|no such file|not found/i.test(raw)) return '目标文件夹不存在或已被移动';
	return '';
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
