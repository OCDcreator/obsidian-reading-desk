import { describe, expect, it, vi } from 'vitest';
import { renderReaderBookmarks } from '../../src/reader/ReaderBookmarksPanel';
import { ReaderPersistenceController } from '../../src/reader/ReaderPersistenceController';
import type { ReaderBookmark } from '../../src/types/contracts';
import { ReaderTestDocument, flushReaderTasks } from './ReaderTestDom';
describe('bookmark sidebar controls', () => {
	it('keeps a failed name for retry and wires create/rename/jump/delete through the persistence port', async () => {
		const doc = new ReaderTestDocument(); const parent = doc.body.createDiv(); let bookmarks: ReaderBookmark[] = []; const restore = vi.fn(async () => undefined);
		const saveBookmark = vi.fn(async (_id, value) => { bookmarks = [...bookmarks.filter(item => item.id !== value.id), value]; }); saveBookmark.mockRejectedValueOnce(new Error('disk full'));
		const state = new ReaderPersistenceController({ port: { read: () => ({ bookId: 'a', path: 'a.pdf', bookmarks }), savePosition: vi.fn(), saveBookmark, removeBookmark: async (_id, bookmarkId) => { bookmarks = bookmarks.filter(item => item.id !== bookmarkId); } },
			capture: () => ({ page: 4, x: 0, y: 0.4, rotation: 0, scale: 1, fitMode: 'manual' }), restore, error: vi.fn() });
		state.begin('a.pdf'); renderReaderBookmarks(parent as unknown as HTMLElement, state, page => `第 ${page} 页`);
		const button = (text: string) => { const found = parent.querySelectorAll('button').find(item => item.textContent === text); if (!found) throw new Error(`Missing ${text}`); return found; };
		const input = parent.querySelector('input'); if (!input) throw new Error('Missing input'); input.value = 'Evidence'; button('添加书签').click(); await flushReaderTasks();
		expect(parent.querySelector('[role="status"]')?.textContent).toBe('disk full'); expect(input.value).toBe('Evidence');
		button('添加书签').click(); await flushReaderTasks(); expect(bookmarks).toHaveLength(1);
		const rename = parent.querySelectorAll('input')[1]; rename.value = 'Method'; button('保存名称').click(); await flushReaderTasks();
		button('Method · 第 5 页').click(); await flushReaderTasks(); expect(restore).toHaveBeenCalledWith(expect.objectContaining({ page: 4, y: 0.4 }));
		button('删除书签').click(); await flushReaderTasks(); expect(bookmarks).toHaveLength(0); expect(doc.activeElement).toBe(input);
	});
});
