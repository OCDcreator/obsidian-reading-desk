import { describe, expect, it } from 'vitest';
import {
	errorMessage,
	exportFilename,
	exportSuccessMessage,
	importResultMessage,
	initialPanelState
} from '../../../src/ui/portability/ImportExportPanelState';
import { toBlob } from '../../../src/ui/portability/ImportExportPanel';

describe('ImportExportPanelState', () => {
	it('uses an explicit one-time import warning as its initial state', () => {
		expect(initialPanelState()).toEqual({
			status: { importedBookshelf: false },
			statusReady: false,
			operation: 'idle',
			message: '旧 Bookshelf 数据只可导入一次。导入前请确认当前书架已保存。'
		});
	});

	it('turns text exports into typed blobs while preserving service-provided blobs', async () => {
		const textBlob = toBlob('书架', 'text/markdown;charset=utf-8');
		const provided = new Blob(['备份'], { type: 'application/json;charset=utf-8' });
		expect(textBlob.type).toBe('text/markdown;charset=utf-8');
		expect(await textBlob.text()).toBe('书架');
		expect(toBlob(provided, 'text/plain')).toBe(provided);
	});

	it('reports import results without claiming skipped entries were imported', () => {
		expect(importResultMessage({
			importedBookCount: 3,
			skippedBookCount: 2,
			importedCategoryCount: 1,
			alreadyImported: false
		})).toBe('已导入 3 本书和 1 个分类，跳过 2 本重复或无效书目。');
		expect(importResultMessage({
			importedBookCount: 0,
			skippedBookCount: 0,
			importedCategoryCount: 0,
			alreadyImported: true
		})).toBe('旧 Bookshelf 数据此前已导入，本次没有写入任何内容。');
	});

	it('builds predictable download filenames and user-facing export feedback', () => {
		const date = new Date('2026-09-18T01:02:03.000Z');
		expect(exportFilename('markdown', date)).toBe('reading-desk-书架导出-2026-09-18.md');
		expect(exportFilename('json', date)).toBe('reading-desk-书架导出-2026-09-18.json');
		expect(exportSuccessMessage('markdown')).toBe('Markdown 导出已开始下载。');
		expect(exportSuccessMessage('json')).toBe('JSON 备份已开始下载。');
		expect(errorMessage(new Error('存储不可用'), '失败')).toBe('存储不可用');
		expect(errorMessage('unknown', '失败')).toBe('失败');
	});
});
