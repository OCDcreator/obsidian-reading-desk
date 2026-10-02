import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPersistenceController, type ReaderStatePort, type ReaderStoredState } from '../../src/reader/ReaderPersistenceController';
import type { ReaderSavedPosition } from '../../src/types/contracts';
import { deferred } from './ReaderTestDom';
const location = (page = 4): Omit<ReaderSavedPosition, 'updatedAt'> => ({ page, x: -0.1, y: -0.25, scale: 1.75, rotation: 90, fitMode: 'manual' });
function fixture() {
	const books = new Map<string, ReaderStoredState>([['a.pdf', { bookId: 'book-a', path: 'a.pdf', bookmarks: [] }], ['b.pdf', { bookId: 'book-b', path: 'b.pdf', bookmarks: [] }]]);
	const byId = (id: string) => { const book = Array.from(books.values()).find(item => item.bookId === id); if (!book) throw new Error('missing book'); return book; };
	const port: ReaderStatePort = { read: path => books.get(path) ?? null,
		savePosition: vi.fn(async (id, position) => { byId(id).position = position; }),
		saveBookmark: async (id, bookmark) => { const book = byId(id); book.bookmarks = [...book.bookmarks.filter(item => item.id !== bookmark.id), bookmark]; },
		removeBookmark: async (id, bookmarkId) => { const book = byId(id); book.bookmarks = book.bookmarks.filter(item => item.id !== bookmarkId); } };
	const error = vi.fn(); const restore = vi.fn(async () => undefined); let current = location();
	const create = () => new ReaderPersistenceController({ port, capture: () => current, restore, error });
	return { books, port, error, restore, create, set: (page: number) => { current = location(page); } };
}
afterEach(() => vi.useRealTimers());
describe('per-leaf reader persistence', () => {
	it('debounces scrolls, flushes on leave, and reopens exact rotation/scale/signed offsets', async () => {
		vi.useFakeTimers(); const f = fixture(); const controller = f.create();
		expect(controller.begin('a.pdf')).toBeUndefined(); controller.activate(new EventTarget() as HTMLElement);
		controller.changed(); f.set(7); controller.changed();
		expect(f.port.savePosition).not.toHaveBeenCalled();
		await controller.leave(); expect(f.port.savePosition).toHaveBeenCalledOnce();
		expect(f.create().begin('a.pdf')).toMatchObject(location(7));
	});
	it('retains failed saves for explicit retry without redirecting after source rename or switch', async () => {
		const f = fixture(); const controller = f.create(); const write = vi.spyOn(f.port, 'savePosition'); write.mockRejectedValueOnce(new Error('disk full'));
		controller.begin('a.pdf'); controller.activate(new EventTarget() as HTMLElement); controller.changed(); await controller.leave();
		expect(f.error).toHaveBeenCalledOnce();
		const book = f.books.get('a.pdf'); if (!book) throw new Error('missing book'); f.books.delete('a.pdf'); book.path = 'renamed.pdf'; f.books.set(book.path, book);
		f.books.set('a.pdf', { bookId: 'different-book', path: 'a.pdf', bookmarks: [] }); controller.rename('a.pdf', book.path);
		controller.begin('b.pdf'); await controller.flush();
		expect(book.position?.page).toBe(4); expect(f.books.get('a.pdf')?.position).toBeUndefined(); expect(f.books.get('b.pdf')?.position).toBeUndefined();
	});
	it('keeps two leaf sessions and delayed writes attached to their own identities', async () => {
		const f = fixture(); const old = deferred<void>(); const write = vi.spyOn(f.port, 'savePosition'); write.mockImplementationOnce(async () => old.promise);
		const a = f.create(); const b = f.create(); a.begin('a.pdf'); b.begin('b.pdf');
		a.activate(new EventTarget() as HTMLElement); b.activate(new EventTarget() as HTMLElement);
		a.changed(); const saving = a.flush(); await Promise.resolve(); f.set(9); b.changed(); await b.leave();
		old.resolve(); await saving; await a.leave();
		expect(write.mock.calls.map(call => call[0])).toEqual(['book-a', 'book-b']); expect(f.books.get('b.pdf')?.position?.page).toBe(9);
	});
	it('adds renames jumps and removes a named bookmark without replacing other leaf edits', async () => {
		const f = fixture(); const a = f.create(); const b = f.create(); a.begin('a.pdf'); b.begin('a.pdf');
		await a.addBookmark('  Evidence  '); await b.addBookmark('Conclusion');
		const first = a.bookmarks()[0]; expect(first.name).toBe('Evidence'); expect(first.position).toMatchObject(location());
		await a.renameBookmark(first.id, 'Method'); expect(b.bookmarks().map(item => item.name)).toEqual(['Conclusion', 'Method']);
		await b.jumpBookmark(first.id); expect(f.restore).toHaveBeenCalledWith(expect.objectContaining(location()));
		await a.removeBookmark(first.id); expect(b.bookmarks().map(item => item.name)).toEqual(['Conclusion']);
	});
	it('does not save intermediate restoration geometry or fail on old unindexed data', async () => {
		const f = fixture(); const a = f.create(); a.begin('a.pdf'); a.changed(); await a.flush(); expect(f.port.savePosition).not.toHaveBeenCalled();
		expect(a.begin('unknown.pdf')).toBeUndefined(); expect(a.available()).toBe(false); expect(a.bookmarks()).toEqual([]);
	});
});
