import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShelfAnnotationSearch } from '../../../src/ui/shelf/ShelfAnnotationSearch';
import type { ShelfAnnotationHit } from '../../../src/ui/shelf/ShelfHost';
import { flush, installDom } from './ShelfTestDom';
const hit = (id: string, patch: Partial<ShelfAnnotationHit> = {}): ShelfAnnotationHit => ({ highlightId: id, pdfPath: '书.pdf', page: 0, text: '原文', color: 'moss', tags: [], chapterPath: ['章节'], comments: [], matchingComments: [{ id: 'c', highlightId: id, content: '评论关键词', createdAt: 1, showTimestamp: true, source: 'pdf' }], createdAt: 1, updatedAt: 1, ...patch });
afterEach(() => vi.unstubAllGlobals());
describe('whole library excerpt search UI', () => {
	it('renders matching comments, limits hits and returns path plus stable highlight id', async () => {
		const document = installDom(vi.stubGlobal); const searchAnnotations = vi.fn(() => Array.from({ length: 100 }, (_, i) => hit('h' + i))); const openHighlight = vi.fn();
		const search = new ShelfAnnotationSearch({ searchAnnotations, openHighlight } as never); const root = search.render([]); document.body.append(root as never);
		const node = document.body.querySelector('[aria-label="检索摘录与评论"]'); if (node) node.value = '评论关键词'; document.body.querySelector('[aria-label="检索全库摘录与评论"]')?.click(); await flush();
		expect(searchAnnotations).toHaveBeenCalledWith(expect.objectContaining({ text: '评论关键词' })); expect(document.body.querySelectorAll('.rd-shelf-annotation-hit')).toHaveLength(40); expect(document.body.querySelector('.rd-shelf-hit-comment')?.textContent).toBe('评论：评论关键词');
		expect(document.body.querySelector('[aria-label="回到高亮 书.pdf 第 1 页"]')?.textContent).toBe('书.pdf · 第 1 页');
		document.body.querySelector('[aria-label="回到高亮 书.pdf 第 1 页"]')?.click(); await flush(); expect(openHighlight).toHaveBeenCalledWith('书.pdf', 'h0');
	});
	it('ignores late results after closing and recovers from a failed query', async () => {
		const document = installDom(vi.stubGlobal); let resolve: (hits: ShelfAnnotationHit[]) => void = () => undefined;
		const host = { searchAnnotations: vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockRejectedValueOnce(new Error('提取失败')).mockReturnValueOnce([hit('latest')]) };
		const search = new ShelfAnnotationSearch(host as never); const first = search.render([]); document.body.append(first as never); document.body.querySelector('[aria-label="检索全库摘录与评论"]')?.click(); search.destroy(); resolve([hit('stale')]); await flush(); expect(document.body.querySelectorAll('.rd-shelf-annotation-hit')).toHaveLength(0);
		document.body.replaceChildren(search.render([]) as never); document.body.querySelector('[aria-label="检索全库摘录与评论"]')?.click(); await flush(); expect(document.body.querySelector('[role="status"]')?.textContent).toBe('提取失败');
		document.body.querySelector('[aria-label="检索全库摘录与评论"]')?.click(); await flush(); expect(document.body.querySelectorAll('.rd-shelf-annotation-hit')).toHaveLength(1);
	});
});
