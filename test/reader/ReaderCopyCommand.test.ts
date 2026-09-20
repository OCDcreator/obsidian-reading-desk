import { describe, expect, it, vi } from 'vitest';
import { canCopyReaderPage, executeCopyReaderPage } from '../../src/reader/ReaderCopyCommand';

describe('ReaderCopyCommand', () => {
	it('disables the command without an active copyable PDF page', () => {
		expect(canCopyReaderPage(null)).toBe(false);
		expect(canCopyReaderPage({ canCopyCurrentPage: () => false, copyCurrentPageLink: vi.fn() })).toBe(false);
		expect(canCopyReaderPage({ canCopyCurrentPage: () => true, copyCurrentPageLink: vi.fn() })).toBe(true);
	});

	it('reports a Chinese recovery Notice message instead of swallowing copy rejection', async () => {
		const report = vi.fn();
		const copied = await executeCopyReaderPage({
			canCopyCurrentPage: () => true,
			copyCurrentPageLink: vi.fn().mockRejectedValue(new Error('无法写入剪贴板，请检查系统权限后重试'))
		}, report);
		expect(copied).toBe(false);
		expect(report).toHaveBeenCalledWith('复制失败：无法写入剪贴板，请检查系统权限后重试');
	});

	it('does not report failure after a successful copy', async () => {
		const report = vi.fn();
		expect(await executeCopyReaderPage({ canCopyCurrentPage: () => true, copyCurrentPageLink: vi.fn() }, report)).toBe(true);
		expect(report).not.toHaveBeenCalled();
	});
});
