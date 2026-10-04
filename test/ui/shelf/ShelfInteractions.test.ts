import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShelfView } from '../../../src/views/ShelfView';
import { createShelfCard } from '../../../src/views/shelf/BookCard';
import { ShelfBookDrafts } from '../../../src/ui/shelf/ShelfBookDrafts';
import type { ShelfViewHost } from '../../../src/ui/shelf/ShelfHost';
import type { LibraryBook } from '../../../src/types/contracts';
import { FakeEvent } from '../../support/fake-dom';
import { installDom, flush, UiDocument, UiNode } from './ShelfTestDom';
const book = (id: string, patch: Partial<LibraryBook> = {}): LibraryBook => ({ id, title: '书 ' + id, path: id + '.pdf', author: '', tags: [], progress: 0, fileSize: 100, format: 'pdf', fingerprint: { mtime: 1, size: 100 }, ...patch });
let document: UiDocument;
beforeEach(() => { document = installDom(vi.stubGlobal); });
afterEach(() => vi.unstubAllGlobals());
const hostFor = (books: LibraryBook[]): ShelfViewHost => ({ getBooks: () => books, getCategories: () => [{ id: 'c', name: '学习', order: 0 }], addCategory: async name => ({ id: 'new', name, order: 1 }), reorderCategories: async () => undefined, updateBook: async () => undefined, openBook: vi.fn(), scan: async () => undefined, getLists: () => [{ id: 'l', name: '本周' }], batchUpdate: vi.fn(async () => undefined) });
const labeled = (node: UiNode, label: string): UiNode => { const found = node.querySelector('[aria-label="' + label + '"]'); if (!found) throw new Error('Missing control ' + label); return found; };
describe('shelf interaction regressions', () => {
	it('keeps inline author editing from opening a book while direct card Enter opens once', () => {
		const bookValue = book('1'); const host = hostFor([bookValue]); const open = vi.fn();
		const card = createShelfCard(bookValue, undefined, { host, categories: [{ id: 'c', name: '学习', order: 0 }], lists: [], selected: new Set(), drafts: new ShelfBookDrafts(), onSelect: vi.fn(), onOpen: open, onRelink: vi.fn(), onChanged: vi.fn() }) as unknown as UiNode;
		document.body.append(card); labeled(card, '为 书 1 添加作者').click(); const select = labeled(card, '书 1 的作者');
		expect(select.keydown(' ').defaultPrevented).toBe(false); expect(open).not.toHaveBeenCalled();
		card.keydown('Enter'); expect(open).toHaveBeenCalledOnce();
	});
	it('opens category management on demand, preserves filtering and restores actual trigger', async () => {
		const root = document.body.createDiv(); const shelf = new ShelfView(hostFor([book('1'), book('2', { categoryId: 'c' })])); await shelf.render(root as unknown as HTMLElement);
		expect(root.querySelector('.rd-category-order')).toBeNull(); labeled(root, '学习 1').click();
		expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(1); const trigger = labeled(root, '管理分类'); trigger.focus(); trigger.click();
		expect(root.querySelector('.rd-category-order')).not.toBeNull(); root.querySelector('.rd-shelf-dialog')?.keydown('Escape');
		expect(document.activeElement).toBe(trigger); expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(1);
	});
	it('bounds mounted cards, keeps batch selection across pages and sends append/replace explicitly', async () => {
		const books = Array.from({ length: 10000 }, (_, i) => book(String(i).padStart(5, '0'))); const host = hostFor(books); const root = document.body.createDiv();
		const shelf = new ShelfView(host); await shelf.render(root as unknown as HTMLElement);
		expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(40); labeled(root, '批量选择本页').click(); labeled(root, '下一页图书').click();
		const check = labeled(root, '批量选择 书 00040'); check.checked = true; check.change(); labeled(root, '批量整理已选图书').click();
		const enableTags = labeled(root, '修改标签'); enableTags.checked = true; enableTags.change(); labeled(root, '批量标签').value = '新标签'; labeled(root, '批量标签').dispatchEvent(new FakeEvent('input'));
		const enableList = labeled(root, '修改阅读列表'); enableList.checked = true; enableList.change(); labeled(root, '批量阅读列表').change('l'); labeled(root, '列表操作').change('replace');
		labeled(root, '确认批量修改 41 本图书').click(); await flush();
		expect(host.batchUpdate).toHaveBeenCalledWith(expect.arrayContaining(['00000', '00040']), { tags: ['新标签'], tagMode: 'append', listIds: ['l'], listMode: 'replace' });
		expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(40);
	});
	it('does not relink until confirmation, and invokes the host migration with chosen path', async () => {
		const host = { ...hostFor([book('missing', { missing: true })]), listSourcePaths: () => ['new/book.pdf'], relinkBook: vi.fn(async () => undefined) }; const root = document.body.createDiv();
		await new ShelfView(host).render(root as unknown as HTMLElement); labeled(root, '重新关联 书 missing').click(); await flush();
		labeled(root, '候选源文件').change('new/book.pdf'); expect(host.relinkBook).not.toHaveBeenCalled();
		labeled(root, '确认重新关联源文件').click(); await flush(); expect(host.relinkBook).toHaveBeenCalledWith('missing', 'new/book.pdf');
	});
	it('keeps typed input across IME composition and filters only committed text', async () => {
		const root = document.body.createDiv(); await new ShelfView(hostFor([book('甲'), book('乙')])).render(root as unknown as HTMLElement);
		const search = labeled(root, '搜索书架'); search.focus(); search.dispatchEvent(new FakeEvent('compositionstart')); search.value = '甲'; search.dispatchEvent(new FakeEvent('input'));
		expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(2); search.dispatchEvent(new FakeEvent('compositionend'));
		expect(root.querySelectorAll('.rd-shelf-card')).toHaveLength(1); expect(document.activeElement).toBe(search);
	});
	it('restores just the requested manual metadata field through the host', async () => {
		const books = [book('1', { author: '', title: '人工标题', metadataOverrides: { title: '人工标题', author: '' }, autoMetadata: { title: '自动标题', author: '自动作者' } })];
		const host = { ...hostFor(books), clearMetadataOverride: vi.fn(async () => undefined) }; const root = document.body.createDiv(); await new ShelfView(host).render(root as unknown as HTMLElement);
		labeled(root, '表格视图').click(); labeled(root, '恢复 人工标题 的自动作者').click(); await flush(); expect(host.clearMetadataOverride).toHaveBeenCalledWith('1', ['author']);
	});

});
