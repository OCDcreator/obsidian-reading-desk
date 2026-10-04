import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShelfView } from '../../../src/views/ShelfView';
import { readLegacyShelfState } from '../../../src/views/shelf/ShelfViewModel';
import { createEmptyData } from '../../../src/data/defaults';
import { validateReadingDeskData } from '../../../src/data/DataValidation';
import type { LibraryBook, LibraryCategory, ShelfViewState } from '../../../src/types/contracts';
import type { ShelfViewHost } from '../../../src/ui/shelf/ShelfHost';
import { FakeEvent } from '../../support/fake-dom';
import { flush, installDom, UiDocument, UiNode } from './ShelfTestDom';
let document: UiDocument;
beforeEach(() => { document = installDom(vi.stubGlobal); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const labeled = (root: UiNode, label: string): UiNode => { const node = root.querySelector('[aria-label="' + label + '"]'); if (!node) throw new Error('Missing ' + label); return node; };
const book = (id: string, patch: Partial<LibraryBook> = {}): LibraryBook => ({ id, title: '书 ' + id, author: '', path: id + '.pdf', format: 'pdf', tags: [], progress: 0, fileSize: 1, pageCount: 100, fingerprint: { mtime: 1, size: 1 }, ...patch });
function harness(rows: LibraryBook[], initial?: ShelfViewState) {
	let state = initial; const categories: LibraryCategory[] = [{ id: 'c', name: '学习', order: 0 }];
	const host: ShelfViewHost = {
		getBooks: () => rows, getCategories: () => categories, addCategory: async name => ({ id: 'new', name, order: 1 }), reorderCategories: async () => undefined,
		updateBook: vi.fn(async (id, patch) => { Object.assign(rows.find(row => row.id === id) ?? {}, patch); }), openBook: vi.fn(), scan: async () => undefined,
		readShelfState: () => state, saveShelfState: async next => { state = structuredClone(next); },
		lastReadPage: () => 12, countHighlights: () => 7,
		renameCategory: vi.fn(async (id, name) => { const item = categories.find(category => category.id === id); if (item) item.name = name; }),
		removeCategory: vi.fn(async id => { categories.splice(categories.findIndex(category => category.id === id), 1); for (const row of rows) if (row.categoryId === id) row.categoryId = undefined; })
	};
	return { host, categories, state: () => state };
}
const type = (node: UiNode, value: string): void => { node.focus(); node.value = value; node.dispatchEvent(new FakeEvent('input')); };

describe('accepted A/B/C with Margin 0.5', () => {
	it('keeps covers free of form controls until explicit selection mode, then exits without opening books', async () => {
		const f = harness([book('1')]); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		expect(root.querySelector('.rd-shelf-card .rd-book-cover select')).toBeNull(); expect(root.querySelector('.rd-shelf-card .rd-book-cover input')).toBeNull();
		labeled(root, '切换批量选择').click(); const check = labeled(root, '批量选择 书 1'); check.checked = true; check.change();
		expect(root.querySelector('.rd-shelf-card')?.classList.contains('is-selected')).toBe(true); expect(f.host.openBook).not.toHaveBeenCalled(); root.querySelector('.rd-shelf-card')?.keydown('Enter'); expect(root.querySelector('.rd-shelf-card')?.classList.contains('is-selected')).toBe(false);
		labeled(root, '切换批量选择').click(); expect(root.querySelector('.rd-shelf-card .rd-book-cover input')).toBeNull(); expect(root.querySelector('.rd-shelf-card')?.classList.contains('is-selected')).toBe(false);
	});
	it('continues three available books and uses the authoritative reader position in navigation', async () => {
		const rows = Array.from({ length: 6 }, (_, i) => book(String(i), { progress: .4, lastReadAt: i, missing: i === 5 }));
		const f = harness(rows); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		expect(root.querySelectorAll('.rd-continue-card')).toHaveLength(3); expect(root.querySelector('.rd-continue-card')?.dataset.bookId).toBe('4');
		labeled(root, '导航视图').click(); expect(root.querySelector('.rd-nav-focus-page')?.textContent).toBe('上次读到第 12 页');
		labeled(root, '按学习筛选').click(); expect(root.querySelector('.rd-nav-focus')).toBeNull(); expect(root.querySelector('.rd-nav-sidebar')).not.toBeNull();
		await shelf.destroy(); expect(f.state()).toMatchObject({ mode: 'navigation', query: { categoryId: 'c' } });
	});
	it('history is a persisted filter that composes with search, not another book collection', async () => {
		const f = harness([book('1', { lastReadAt: 1, progress: .5 }), book('2')]); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		labeled(root, '筛选出有阅读记录的图书').click(); expect(root.querySelectorAll('.rd-shelf-grid .rd-shelf-card')).toHaveLength(1);
		type(labeled(root, '搜索书架'), '书 2'); expect(root.querySelectorAll('.rd-shelf-grid .rd-shelf-card')).toHaveLength(0);
		labeled(root, '清除所有书架筛选').click(); expect(root.querySelectorAll('.rd-shelf-grid .rd-shelf-card')).toHaveLength(2);
		labeled(root, '筛选出有阅读记录的图书').click(); await shelf.destroy(); expect(f.state()?.query.historyOnly).toBe(true);
	});
	it('A author cancellation and native keys do not open a book or publish a discarded draft', async () => {
		const f = harness([book('1')]); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		labeled(root, '为 书 1 添加作者').click(); const author = labeled(root, '书 1 的作者'); type(author, '丢弃作者'); author.keydown('Escape'); await flush();
		expect(f.host.updateBook).not.toHaveBeenCalled(); expect(f.host.openBook).not.toHaveBeenCalled(); expect(root.querySelector('.rd-author-input')).toBeNull();
		labeled(root, '为 书 1 添加作者').click(); type(labeled(root, '书 1 的作者'), '保留作者'); labeled(root, '书 1 的作者').keydown('Enter'); await flush();
		expect(f.host.updateBook).toHaveBeenCalledWith('1', { author: '保留作者' }); expect(f.host.openBook).not.toHaveBeenCalled();
	});
	it('A failed author draft survives B/C switches and retries the same requested value', async () => {
		const f = harness([book('1', { lastReadAt: 1 })]); const update = vi.fn().mockRejectedValueOnce(new Error('离线失败')).mockResolvedValue(undefined); f.host.updateBook = update;
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		labeled(root, '为 书 1 添加作者').click(); type(labeled(root, '书 1 的作者'), '重试作者'); labeled(root, '书 1 的作者').blur(); await flush();
		labeled(root, '导航视图').click(); labeled(root, '表格视图').click(); expect(labeled(root, '书 1 的作者').value).toBe('重试作者');
		labeled(root, '重试保存 书 1 的作者').click(); await flush(); expect(update).toHaveBeenCalledTimes(2); expect(update.mock.calls[1]).toEqual(['1', { author: '重试作者' }]);
	});
	it('C exposes the accepted book columns, statistics and retained 0.5 fields', async () => {
		const f = harness([book('1')]); const root = document.body.createDiv(); await new ShelfView(f.host).render(root as unknown as HTMLElement); labeled(root, '表格视图').click();
		expect(root.querySelectorAll('thead th').map(node => node.textContent)).toEqual(['书名', '作者', '分类', '标签', '评分', '进度', '页数', '大小']);
		expect(root.querySelectorAll('.rd-summary-value').map(node => node.textContent)).toEqual(['1 本', '0 本', '7 条', '0%']);
		expect(labeled(root, '书 1 的标题')).toBeDefined(); expect(labeled(root, '书 1 的状态')).toBeDefined();
	});
	it('category management reads live data after rename and removal preserves every book', async () => {
		const rows = [book('1', { categoryId: 'c' })]; const f = harness(rows); const root = document.body.createDiv(); await new ShelfView(f.host).render(root as unknown as HTMLElement);
		labeled(root, '管理分类').click(); labeled(root, '重命名分类 学习').click(); type(labeled(root, '分类名称 学习'), '研究'); labeled(root, '保存分类名称 学习').click(); await flush();
		expect(labeled(root, '删除分类 研究')).toBeDefined(); expect(f.categories[0].name).toBe('研究');
		labeled(root, '删除分类 研究').click(); expect(f.host.removeCategory).not.toHaveBeenCalled(); labeled(root, '删除分类 研究').click(); await flush();
		expect(rows).toHaveLength(1); expect(rows[0].categoryId).toBeUndefined(); expect(f.categories).toHaveLength(0);
	});
	it('migrates legacy layout once and repository state wins when present', async () => {
		const bag = new Map([['reading-desk-shelf-layout', 'navigation'], ['reading-desk-shelf-sort', 'recent']]); const storage = { getItem: (key: string) => bag.get(key) ?? null, setItem: vi.fn() }; vi.stubGlobal('localStorage', storage);
		expect(readLegacyShelfState(storage)).toMatchObject({ mode: 'navigation', query: { sort: 'recent' } });
		const f = harness([book('1')]); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement); await vi.advanceTimersByTimeAsync(500);
		expect(f.state()?.mode).toBe('navigation'); await shelf.destroy();
		f.host.readShelfState = () => ({ mode: 'table', page: 1, query: { query: '', sort: 'title' } }); const reopen = document.body.createDiv(); await new ShelfView(f.host).render(reopen as unknown as HTMLElement);
		expect(labeled(reopen, '表格视图').getAttribute('aria-pressed')).toBe('true'); expect(storage.setItem).not.toHaveBeenCalled();
	});
	it('validates persisted navigation/history and supports the existing ten-point rating filter', () => {
		const data = createEmptyData(); data.settings.shelf = { mode: 'navigation', page: 1, query: { query: '', sort: 'recent', historyOnly: true, minRating: 10 } };
		expect(validateReadingDeskData(data).settings.shelf).toEqual(data.settings.shelf);
	});
});
