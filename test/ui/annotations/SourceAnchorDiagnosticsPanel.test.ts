import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceAnchorDiagnosticsPanel } from '../../../src/ui/annotations/SourceAnchorDiagnosticsPanel';
import type { SourceAnchorDiagnostic } from '../../../src/annotations/SourceAnchorDiagnostics';
import { flush, installDom, UiDocument, UiNode } from '../shelf/ShelfTestDom';

let document: UiDocument;
beforeEach(() => { document = installDom(vi.stubGlobal); });
afterEach(() => vi.unstubAllGlobals());
const diagnostic = (index = 0): SourceAnchorDiagnostic => ({ highlightId: 'h' + index, page: index, pageLabel: 'iv',
	status: 'changed', message: '文件信息变化，位置需核验。', quote: '原文引文', searchQuery: '原文引文', chapter: '第一章' });
const labeled = (root: UiNode, label: string): UiNode => {
	const node = root.querySelector('[aria-label="' + label + '"]'); if (!node) throw new Error(label); return node;
};
describe('source anchor diagnostic panel', () => {
	it('appends a collapsed read-only panel with both printed and physical pages and delegates quote search', async () => {
		const root = document.body.createDiv(); const original = root.createDiv(); const search = vi.fn();
		const panel = new SourceAnchorDiagnosticsPanel(); panel.render(root as unknown as HTMLElement, [diagnostic(3)], search);
		const details = root.querySelector('details') as unknown as HTMLDetailsElement;
		expect(details.open).toBe(false); expect(original.isConnected).toBe(true);
		expect(root.querySelectorAll('p').some(node => node.textContent.includes('印刷页 iv · PDF 第 4 页'))).toBe(true);
		labeled(root, '查找引文：PDF 第 4 页').click(); await flush(); expect(search).toHaveBeenCalledWith('原文引文');
		details.open = true; panel.render(root as unknown as HTMLElement, [diagnostic(3)], search);
		expect((root.querySelector('details') as unknown as HTMLDetailsElement).open).toBe(true); expect(root.querySelectorAll('details')).toHaveLength(1);
		panel.destroy(); expect(root.querySelector('details')).toBeNull(); expect(original.isConnected).toBe(true);
	});
	it('bounds mounted rows and keeps later rows reachable while disabling empty quotes', () => {
		const root = document.body.createDiv(); const data = Array.from({ length: 41 }, (_, index) => diagnostic(index)); data[0].searchQuery = ''; data[0].quote = '';
		new SourceAnchorDiagnosticsPanel().render(root as unknown as HTMLElement, data, vi.fn());
		expect(root.querySelectorAll('li')).toHaveLength(20); expect(labeled(root, '查找引文：PDF 第 1 页').disabled).toBe(true);
		labeled(root, '下一页源文件核验结果').click(); expect(root.querySelectorAll('li')[0].dataset.highlightId).toBe('h20');
		labeled(root, '下一页源文件核验结果').click(); expect(root.querySelectorAll('li')).toHaveLength(1); expect(root.querySelectorAll('li')[0].dataset.highlightId).toBe('h40');
	});
	it('does not start a deferred search after its source panel was destroyed', async () => {
		const root = document.body.createDiv(); const panel = new SourceAnchorDiagnosticsPanel(); const search = vi.fn();
		panel.render(root as unknown as HTMLElement, [diagnostic()], search);
		labeled(root, '查找引文：PDF 第 1 页').click(); panel.destroy(); await flush(); expect(search).not.toHaveBeenCalled();
	});
	it('keeps failures retryable and renders no empty diagnostic surface', async () => {
		const root = document.body.createDiv(); const panel = new SourceAnchorDiagnosticsPanel(); const search = vi.fn().mockRejectedValueOnce(new Error('搜索失败')).mockResolvedValue(undefined);
		panel.render(root as unknown as HTMLElement, [diagnostic()], search); const find = labeled(root, '查找引文：PDF 第 1 页');
		find.click(); await flush(); expect(find.disabled).toBe(false); expect(root.querySelectorAll('[role="status"]').some(node => node.textContent.includes('搜索失败'))).toBe(true);
		find.click(); await flush(); expect(search).toHaveBeenCalledTimes(2);
		panel.render(root as unknown as HTMLElement, [], search); expect(root.querySelector('details')).toBeNull();
	});
});
