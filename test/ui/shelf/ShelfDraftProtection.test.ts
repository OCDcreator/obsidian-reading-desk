import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShelfView } from '../../../src/views/ShelfView';
import type { ShelfViewHost } from '../../../src/ui/shelf/ShelfHost';
import type { LibraryBook } from '../../../src/types/contracts';
import { FakeEvent } from '../../support/fake-dom';
import { flush, installDom, UiDocument, UiNode } from './ShelfTestDom';

let document: UiDocument;
beforeEach(() => { document = installDom(vi.stubGlobal); });
afterEach(() => vi.unstubAllGlobals());
const book = (id: string, patch: Partial<LibraryBook> = {}): LibraryBook => ({ id, title: '书 ' + id, author: '旧作者', path: id + '.pdf', format: 'pdf', tags: [], progress: 0, fileSize: 1, fingerprint: { mtime: 1, size: 1 }, ...patch });
const labeled = (root: UiNode, label: string): UiNode => {
	const found = root.querySelector('[aria-label="' + label + '"]');
	if (!found) throw new Error('Missing ' + label);
	return found;
};
const edit = (node: UiNode, value: string): void => { node.focus(); node.value = value; node.dispatchEvent(new FakeEvent('input')); };
function harness(books: LibraryBook[]) {
	const pending: Array<{ resolve(): void; reject(): void }> = [];
	const writes: unknown[] = [];
	const host: ShelfViewHost = {
		getBooks: () => books, getCategories: () => [{ id: 'c', name: '学习', order: 0 }],
		addCategory: async name => ({ id: 'x', name, order: 1 }), reorderCategories: async () => undefined,
		openBook: vi.fn(), scan: async () => undefined,
		updateBook: (id, patch) => {
			writes.push(patch);
			return new Promise<void>((resolve, reject) => pending.push({
				resolve: () => { const target = books.find(item => item.id === id); if (target) Object.assign(target, patch); resolve(); },
				reject: () => reject(new Error('写入失败'))
			}));
		}
	};
	return { host, pending, writes };
}

describe('shelf repaired states and draft protection', () => {
	it('exposes selected category and view with the existing visual state classes', async () => {
		const root = document.body.createDiv(); await new ShelfView(harness([book('1', { categoryId: 'c' })]).host).render(root as unknown as HTMLElement);
		labeled(root, '学习 1').click(); labeled(root, '表格视图').click();
		expect(labeled(root, '学习 1').matches('.rd-category-chip.is-selected')).toBe(true);
		expect(labeled(root, '表格视图').matches('.rd-view-switch-button.is-selected')).toBe(true);
		expect(labeled(root, '卡片视图').classList.contains('is-selected')).toBe(false);
	});
	it('focuses the new result page instead of the continue rail and keeps book titles out of headings', async () => {
		const books = Array.from({ length: 81 }, (_, index) => book(String(index).padStart(3, '0'), { progress: index ? 0 : 0.5 }));
		const root = document.body.createDiv(); await new ShelfView(harness(books).host).render(root as unknown as HTMLElement);
		labeled(root, '下一页图书').click();
		expect(document.activeElement === root.querySelector('.rd-shelf-grid .rd-shelf-card')).toBe(true);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('打开 书 040');
		expect(root.querySelectorAll('.rd-book-title').every(node => !/^H[1-6]$/.test(node.tagName))).toBe(true);
	});
	it('keeps the next field draft when an earlier field finishes saving', async () => {
		const books = [book('1')]; const { host, pending, writes } = harness(books);
		const root = document.body.createDiv(); await new ShelfView(host).render(root as unknown as HTMLElement); labeled(root, '表格视图').click();
		const title = labeled(root, '书 1 的标题'); edit(title, '新标题'); title.blur(); await flush();
		edit(labeled(root, '书 1 的作者'), '未提交作者'); pending[0].resolve(); await flush();
		const author = labeled(root, '新标题 的作者'); expect(author.value).toBe('未提交作者'); expect(document.activeElement).toBe(author);
		expect(writes).toEqual([{ title: '新标题' }]); author.blur(); await flush(); pending[1].resolve(); await flush();
		expect(books[0].author).toBe('未提交作者');
	});
	it('does not clear a newer draft of the same field when its older version saves', async () => {
		const books = [book('1')]; const { host, pending } = harness(books);
		const root = document.body.createDiv(); await new ShelfView(host).render(root as unknown as HTMLElement); labeled(root, '表格视图').click();
		const author = labeled(root, '书 1 的作者'); edit(author, '第一稿'); author.blur(); await flush(); edit(author, '第二稿');
		pending[0].resolve(); await flush();
		const current = labeled(root, '书 1 的作者'); expect(current.value).toBe('第二稿'); current.blur(); await flush();
		pending[1].resolve(); await flush(); expect(books[0].author).toBe('第二稿');
	});
	it('serializes same-field saves and ignores an older failure once a newer draft exists', async () => {
		const books = [book('1')]; const { host, pending, writes } = harness(books);
		const root = document.body.createDiv(); await new ShelfView(host).render(root as unknown as HTMLElement); labeled(root, '表格视图').click();
		const author = labeled(root, '书 1 的作者'); edit(author, '第一稿'); author.blur(); await flush();
		edit(author, '第二稿'); author.blur(); await flush(); expect(writes).toHaveLength(1);
		pending[0].reject(); await flush(); expect(writes).toEqual([{ author: '第一稿' }, { author: '第二稿' }]);
		expect(root.querySelector('.rd-table-error')).toBeNull(); expect(author.value).toBe('第二稿');
		pending[1].resolve(); await flush(); expect(books[0].author).toBe('第二稿'); expect(root.querySelector('.rd-table-error')).toBeNull();
	});
	it('keeps a pending select value through another field save and restores a failed automatic-reset action', async () => {
		const books = [book('1', { autoMetadata: { title: '书 1', author: '自动作者' }, metadataOverrides: { author: '旧作者' } })];
		const { host, pending, writes } = harness(books);
		const reset = vi.fn().mockRejectedValueOnce(new Error('恢复失败')).mockImplementation(async () => { books[0].author = '自动作者'; books[0].metadataOverrides = {}; });
		host.clearMetadataOverride = reset;
		const root = document.body.createDiv(); await new ShelfView(host).render(root as unknown as HTMLElement); labeled(root, '表格视图').click();
		const title = labeled(root, '书 1 的标题'); edit(title, '新标题'); title.blur(); await flush();
		labeled(root, '书 1 的评分').change('8'); await flush(); pending[0].resolve(); await flush();
		expect(labeled(root, '新标题 的评分').value).toBe('8'); pending[1].resolve(); await flush();
		labeled(root, '恢复 新标题 的自动作者').click(); await flush();
		expect(labeled(root, '新标题 的作者').value).toBe('自动作者'); expect(root.querySelector('.rd-table-error')?.textContent).toContain('恢复失败');
		labeled(root, '卡片视图').click(); labeled(root, '表格视图').click();
		labeled(root, '重试保存 新标题 的作者').click(); await flush();
		expect(reset).toHaveBeenCalledTimes(2); expect(writes).toEqual([{ title: '新标题' }, { rating: 8 }]);
		expect(books[0].metadataOverrides).toEqual({}); expect(books[0].author).toBe('自动作者');
	});
	it('retains a failed draft and its retry across a view redraw', async () => {
		const books = [book('1')]; const { host, pending } = harness(books);
		const root = document.body.createDiv(); await new ShelfView(host).render(root as unknown as HTMLElement); labeled(root, '表格视图').click();
		const author = labeled(root, '书 1 的作者'); edit(author, '重试作者'); author.blur(); await flush(); pending[0].reject(); await flush();
		labeled(root, '卡片视图').click(); labeled(root, '表格视图').click();
		expect(labeled(root, '书 1 的作者').value).toBe('重试作者'); expect(root.querySelector('.rd-table-error')?.textContent).toContain('写入失败');
		labeled(root, '重试保存 书 1 的作者').click(); await flush(); pending[1].resolve(); await flush();
		expect(books[0].author).toBe('重试作者'); expect(root.querySelector('.rd-table-error')).toBeNull();
	});
});
