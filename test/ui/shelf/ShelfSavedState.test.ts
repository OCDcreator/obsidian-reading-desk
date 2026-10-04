import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShelfView } from '../../../src/views/ShelfView';
import { createEmptyData } from '../../../src/data/defaults';
import { ReadingDeskRepository } from '../../../src/data/ReadingDeskRepository';
import { LibraryIndex } from '../../../src/library/LibraryIndex';
import type { ShelfViewHost } from '../../../src/ui/shelf/ShelfHost';
import type { LibraryBook, LibraryList, ShelfViewState } from '../../../src/types/contracts';
import { FakeEvent } from '../../support/fake-dom';
import { flush, installDom, UiDocument, UiNode } from './ShelfTestDom';

let document: UiDocument;
beforeEach(() => { document = installDom(vi.stubGlobal); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const labeled = (root: UiNode, label: string): UiNode => {
	const node = root.querySelector('[aria-label="' + label + '"]'); if (!node) throw new Error('Missing ' + label); return node;
};
const books = (count = 85): LibraryBook[] => Array.from({ length: count }, (_, i) => ({ id: String(i), title: '书 ' + String(i).padStart(3, '0'), author: '', path: i + '.pdf', format: 'pdf', tags: [], progress: 0, fileSize: 1, fingerprint: { mtime: 1, size: 1 }, listIds: i < 2 ? ['l'] : [] }));
function harness(initial?: ShelfViewState) {
	let state = initial; const rows = books(); const lists: LibraryList[] = [{ id: 'l', name: '本周' }];
	const save = vi.fn(async (next: ShelfViewState) => { state = structuredClone(next); });
	const host: ShelfViewHost = {
		getBooks: () => rows, getCategories: () => [], getLists: () => lists,
		addCategory: async name => ({ id: 'c', name, order: 0 }), reorderCategories: async () => undefined,
		updateBook: async () => undefined, openBook: async () => undefined, scan: async () => undefined,
		readShelfState: () => state, saveShelfState: save,
		renameList: vi.fn(async (id, name) => { const list = lists.find(item => item.id === id); if (list) list.name = name; }),
		deleteList: vi.fn(async id => { lists.splice(lists.findIndex(item => item.id === id), 1); rows.forEach(book => { book.listIds = book.listIds?.filter(item => item !== id); }); })
	};
	return { host, save, state: () => state, rows };
}
const search = (root: UiNode, query: string): void => { const input = labeled(root, '搜索书架'); input.value = query; input.dispatchEvent(new FakeEvent('input')); };

describe('shelf saved workflow state', () => {
	it('defaults old data without writing and coalesces quick filters, then reopens the saved page', async () => {
		const f = harness(); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		expect(labeled(root, '卡片视图').getAttribute('aria-pressed')).toBe('true'); expect(f.save).not.toHaveBeenCalled();
		search(root, '书 0'); search(root, '书'); labeled(root, '表格视图').click(); labeled(root, '下一页图书').click();
		await vi.advanceTimersByTimeAsync(499); expect(f.save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1); expect(f.save).toHaveBeenCalledTimes(1);
		expect(f.state()).toMatchObject({ mode: 'table', query: { query: '书', sort: 'recent' }, page: 2 });
		await shelf.destroy(); const reopened = document.body.createDiv(); await new ShelfView(f.host).render(reopened as unknown as HTMLElement);
		expect(labeled(reopened, '表格视图').getAttribute('aria-pressed')).toBe('true'); expect(labeled(reopened, '搜索书架').value).toBe('书');
		expect(reopened.querySelector('.rd-library-table tbody tr')?.dataset.bookId).toBe('40');
	});
	it('serializes writes and flushes the newest operation when closed during a save', async () => {
		const f = harness(); const completions: Array<() => void> = [];
		f.save.mockImplementation(() => new Promise<void>(resolve => completions.push(resolve)));
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		search(root, '书'); await vi.advanceTimersByTimeAsync(500); expect(f.save).toHaveBeenCalledTimes(1);
		search(root, '书 0'); labeled(root, '表格视图').click(); const closing = shelf.destroy(); await flush(); expect(f.save).toHaveBeenCalledTimes(1);
		completions[0](); await flush(); expect(f.save).toHaveBeenCalledTimes(2);
		expect(f.save.mock.calls[1][0]).toMatchObject({ mode: 'table', query: { query: '书 0' } }); completions[1](); await closing;
	});
	it('keeps a failed preference save available for retry', async () => {
		const f = harness(); f.save.mockRejectedValueOnce(new Error('磁盘暂不可写'));
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		search(root, '书'); await vi.advanceTimersByTimeAsync(500); expect(labeled(root, '重试保存书架视图').hidden).toBe(false);
		expect(labeled(root, '搜索书架').value).toBe('书'); labeled(root, '重试保存书架视图').click(); await flush();
		expect(f.save).toHaveBeenCalledTimes(2); expect(f.state()?.query.query).toBe('书'); expect(labeled(root, '重试保存书架视图').hidden).toBe(true); await shelf.destroy();
	});
	it('drops removed references and clamps pages before saving the repaired preferences', async () => {
		const f = harness({ mode: 'cards', query: { query: '', sort: 'title', categoryId: 'deleted', listId: 'deleted' }, page: 99 });
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		expect(root.querySelector('.rd-shelf-grid .rd-shelf-card')?.dataset.bookId).toBe('80'); await shelf.destroy();
		expect(f.state()).toEqual({ mode: 'cards', query: { query: '', sort: 'title' }, page: 3 });
	});
	it('renames a list and requires deletion confirmation, then clears its active filter', async () => {
		const f = harness({ mode: 'cards', query: { query: '', sort: 'title', listId: 'l' }, page: 1 });
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		labeled(root, '管理阅读列表').click(); labeled(root, '阅读列表名称：本周').value = '下周'; labeled(root, '保存阅读列表名称：本周').click(); await flush();
		expect(f.host.renameList).toHaveBeenCalledWith('l', '下周'); labeled(root, '删除阅读列表：下周').click(); expect(f.host.deleteList).not.toHaveBeenCalled();
		labeled(root, '取消删除阅读列表：下周').click(); expect(f.host.deleteList).not.toHaveBeenCalled();
		labeled(root, '删除阅读列表：下周').click(); labeled(root, '确认删除阅读列表：下周').click(); await flush();
		expect(f.host.deleteList).toHaveBeenCalledWith('l'); expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(40);
		expect(f.rows).toHaveLength(85); expect(f.rows.every(book => !book.listIds?.includes('l'))).toBe(true);
		await shelf.destroy(); expect(f.state()?.query.listId).toBeUndefined();
	});
	it('keeps a failed rename draft and allows retry', async () => {
		const f = harness(); const rename = vi.fn().mockRejectedValueOnce(new Error('保存失败')).mockImplementation(f.host.renameList);
		f.host.renameList = rename;
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement); labeled(root, '管理阅读列表').click();
		const name = labeled(root, '阅读列表名称：本周'); name.value = '新列表'; labeled(root, '保存阅读列表名称：本周').click(); await flush();
		expect(name.value).toBe('新列表'); expect(labeled(root, '保存阅读列表名称：本周').disabled).toBe(false);
		labeled(root, '保存阅读列表名称：本周').click(); await flush(); expect(rename).toHaveBeenCalledTimes(2); expect(labeled(root, '阅读列表名称：新列表').value).toBe('新列表'); await shelf.destroy();
	});
	it('does not overwrite early user input with a late saved-state read', async () => {
		const f = harness(); let resolveState: (value: ShelfViewState) => void = () => undefined;
		f.host.readShelfState = () => new Promise(resolve => { resolveState = resolve; });
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); const rendering = shelf.render(root as unknown as HTMLElement);
		search(root, '书 00'); labeled(root, '表格视图').click();
		resolveState({ mode: 'cards', query: { query: '旧关键词', sort: 'title' }, page: 2 }); await rendering; await shelf.destroy();
		expect(f.state()).toMatchObject({ mode: 'table', query: { query: '书 00' }, page: 1 });
	});
	it('keeps a later view change when an older queued save fails', async () => {
		const f = harness(); let rejectFirst: (reason: Error) => void = () => undefined;
		f.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
		const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		search(root, '书'); await vi.advanceTimersByTimeAsync(500); labeled(root, '表格视图').click();
		rejectFirst(new Error('旧请求失败')); await flush(); expect(f.save).toHaveBeenCalledTimes(2);
		expect(f.state()?.mode).toBe('table'); expect(labeled(root, '重试保存书架视图').hidden).toBe(true); await shelf.destroy();
	});
	it('traps keyboard focus on visible list controls while confirmation is hidden', async () => {
		const f = harness(); const root = document.body.createDiv(); const shelf = new ShelfView(f.host); await shelf.render(root as unknown as HTMLElement);
		labeled(root, '管理阅读列表').click(); const remove = labeled(root, '删除阅读列表：本周'); remove.focus(); const event = remove.keydown('Tab');
		expect(event.defaultPrevented).toBe(true); expect(document.activeElement?.getAttribute('aria-label')).toBe('关闭管理阅读列表'); await shelf.destroy();
	});
	it('roundtrips a closed shelf through the actual Repository and LibraryIndex', async () => {
		let disk = createEmptyData(); disk.books = Object.fromEntries(books().map(book => [book.id, book]));
		const make = async () => {
			const repository = new ReadingDeskRepository({ load: async () => structuredClone(disk), save: async next => { disk = structuredClone(next); } }); await repository.initialize();
			const index = new LibraryIndex(repository, { extract: async () => ({ title: '', author: '' }) });
			const host = harness().host; host.getBooks = () => index.list(); host.readShelfState = () => repository.readSettings().shelf; host.saveShelfState = state => repository.updateSettings({ shelf: state });
			return new ShelfView(host);
		};
		const first = await make(); const root = document.body.createDiv(); await first.render(root as unknown as HTMLElement);
		labeled(root, '排序').change('recent'); labeled(root, '表格视图').click(); labeled(root, '下一页图书').click(); await first.destroy();
		const next = await make(); const restored = document.body.createDiv(); await next.render(restored as unknown as HTMLElement);
		expect(labeled(restored, '表格视图').getAttribute('aria-pressed')).toBe('true'); expect(labeled(restored, '排序').value).toBe('recent');
		expect(restored.querySelector('.rd-library-table tbody tr')?.dataset.bookId).toBe('40'); await next.destroy();
	});
});
