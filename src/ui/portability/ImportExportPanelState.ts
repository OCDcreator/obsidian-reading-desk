export interface LegacyImportResult {
	importedBookCount: number;
	skippedBookCount: number;
	importedCategoryCount: number;
	alreadyImported: boolean;
}

export interface PortabilityStatus {
	/** Whether legacy Bookshelf data was already imported into this vault. */
	importedBookshelf: boolean;
}

export type PanelOperation = 'idle' | 'loading-import' | 'loading-markdown' | 'loading-json' | 'success' | 'error';

export interface ImportExportPanelState {
	status: PortabilityStatus;
	statusReady: boolean;
	operation: PanelOperation;
	message: string;
}

export function initialPanelState(): ImportExportPanelState {
	return {
		status: { importedBookshelf: false },
		statusReady: false,
		operation: 'idle',
		message: '旧 Bookshelf 数据只可导入一次。导入前请确认当前书架已保存。'
	};
}

export function importResultMessage(result: LegacyImportResult): string {
	if (result.alreadyImported) return '旧 Bookshelf 数据此前已导入，本次没有写入任何内容。';
	const skipped = result.skippedBookCount ? `，跳过 ${result.skippedBookCount} 本重复或无效书目` : '';
	return `已导入 ${result.importedBookCount} 本书和 ${result.importedCategoryCount} 个分类${skipped}。`;
}

export function exportSuccessMessage(format: 'markdown' | 'json'): string {
	return format === 'markdown' ? 'Markdown 导出已开始下载。' : 'JSON 备份已开始下载。';
}

export function exportFilename(format: 'markdown' | 'json', date = new Date()): string {
	const stamp = date.toISOString().slice(0, 10);
	return `reading-desk-书架导出-${stamp}.${format === 'markdown' ? 'md' : 'json'}`;
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
