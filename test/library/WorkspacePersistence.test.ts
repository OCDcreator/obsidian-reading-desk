import { describe, expect, it } from 'vitest';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import { dataSignature } from '../../src/data/DataValidation';
import { createEmptyData } from '../../src/data/defaults';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import { ReadingDeskBackupService } from '../../src/portability/ReadingDeskBackupService';
import type { LibraryBook, ReaderSavedPosition, ReadingDeskData } from '../../src/types/contracts';

const book: LibraryBook = { id: 'stable-book', path: 'Books/one.pdf', format: 'pdf', title: 'One', author: 'Author', tags: [], progress: 0, fileSize: 12, fingerprint: { mtime: 1, size: 12 }, pageCount: 10 };
const position: ReaderSavedPosition = { page: 0, x: -0.2, y: -0.36, rotation: 90, scale: 1.5, fitMode: 'width', updatedAt: 10 };
async function fixture() {
	let disk: ReadingDeskData = { ...createEmptyData(), books: { [book.id]: structuredClone(book) } };
	let enter: (() => void) | undefined;
	let release: (() => void) | undefined;
	let paused: Promise<void> | undefined;
	const sink = { load: async () => { const waiting = paused; paused = undefined; if (waiting) { enter?.(); await waiting; } return structuredClone(disk); }, save: async (value: ReadingDeskData) => { disk = structuredClone(value); } };
	const repository = new ReadingDeskRepository(sink);
	await repository.initialize();
	const index = new LibraryIndex(repository, { extract: async () => ({ title: 'One', author: 'Author' }) });
	return { repository, index, sink, disk: () => structuredClone(disk), pause: () => {
		const entered = new Promise<void>(resolve => { enter = resolve; });
		paused = new Promise<void>(resolve => { release = resolve; });
		return { entered, release: () => release?.() };
	} };
}

describe('workspace state persistence through the authoritative book index', () => {
	it('loads old books without state, persists signed page zero and reloads exact view semantics', async () => {
		const state = await fixture();
		expect(state.index.readReaderState(book.path)).toMatchObject({ bookId: book.id, bookmarks: [] });
		await state.index.saveReaderPosition(book.id, position);
		const restarted = new ReadingDeskRepository(state.sink); await restarted.initialize();
		expect(restarted.readBooks()[book.id].lastReadPosition).toEqual(position);
		const detached = state.index.readReaderState(book.path);
		if (detached?.position) detached.position.y = 999;
		expect(state.index.readReaderState(book.path)?.position?.y).toBe(-0.36);
		await expect(state.index.saveReaderPosition(book.id, { ...position, scale: 99, updatedAt: 11 })).rejects.toThrow();
		expect(state.disk().books[book.id].lastReadPosition).toEqual(position);
	});

	it('binds delayed updates to book identity across rename and never recreates a removed book', async () => {
		const state = await fixture();
		await state.index.renamePaths(book.path, 'Books/renamed.pdf');
		await state.index.applyImportedBooks([{ ...book, id: 'replacement' }]);
		await state.index.saveReaderPosition(book.id, position);
		expect(state.index.get(book.id)?.path).toBe('Books/renamed.pdf');
		expect(state.index.get('replacement')?.lastReadPosition).toBeUndefined();
		await state.repository.commit(() => { delete state.repository.readBooks()[book.id]; });
		await expect(state.index.saveReaderPosition(book.id, { ...position, updatedAt: 30 })).rejects.toThrow();
		expect(state.disk().books[book.id]).toBeUndefined();
	});

	it('preserves named bookmarks and shelf defaults through full backup, relink and restart', async () => {
		const state = await fixture();
		await state.index.saveBookmark(book.id, { id: 'mark', name: '  Key argument  ', position, createdAt: 2, updatedAt: 3 });
		await state.index.saveBookmark(book.id, { id: 'mark', name: 'Revised name', position: { ...position, page: 2 }, createdAt: 100, updatedAt: 4 });
		await state.repository.updateSettings({ shelf: { mode: 'table', page: 2, query: { query: 'argument', sort: 'recent', readingStatus: 'reading' } } });
		await state.index.relink(book.id, { path: 'Books/new.pdf', extension: 'pdf', stat: { mtime: 2, size: 12 } }, { confirmed: true, skipExtraction: true });
		const backup = new ReadingDeskBackupService();
		const parsed = backup.parseBackup(backup.serializeBackup(state.repository.snapshot()));
		expect(parsed.data.books[book.id].bookmarks).toEqual([{ id: 'mark', name: 'Revised name', position: { ...position, page: 2 }, createdAt: 2, updatedAt: 4 }]);
		expect(parsed.data.settings.shelf?.query.query).toBe('argument');
		await state.repository.replaceData(parsed.data);
		await state.index.removeBookmark(book.id, 'mark');
		expect(state.disk().books[book.id].bookmarks).toEqual([]);
	});

	it('rejects stale bookmark edits and older location writes without losing the newer state', async () => {
		const state = await fixture();
		await state.index.saveReaderPosition(book.id, { ...position, page: 4, updatedAt: 20 });
		await state.index.saveReaderPosition(book.id, position);
		expect(state.index.get(book.id)?.lastReadPosition?.page).toBe(4);
		await state.index.saveBookmark(book.id, { id: 'mark', name: 'New', position, createdAt: 1, updatedAt: 20 });
		await expect(state.index.saveBookmark(book.id, { id: 'mark', name: 'Old', position, createdAt: 1, updatedAt: 10 })).rejects.toThrow();
		expect(state.disk().books[book.id].bookmarks?.[0].name).toBe('New');
	});

	it('checks import preview after preceding Repository mutations, preserving new reader state', async () => {
		const state = await fixture();
		const signature = dataSignature(state.repository.snapshot().books);
		const paused = state.pause();
		const update = state.repository.commit(() => { state.repository.readBooks()[book.id].lastReadPosition = position; });
		await paused.entered;
		const importing = state.index.applyImportedBooks([{ ...book, title: 'Imported title' }], { expectedSignature: signature });
		const result = importing.catch(error => error);
		paused.release(); await update;
		expect(await result).toBeInstanceOf(Error);
		expect(state.disk().books[book.id]).toMatchObject({ title: 'One', lastReadPosition: position });
	});

	it('plans against current identity inside the Repository commit, rejecting a queued duplicate source', async () => {
		const state = await fixture();
		const paused = state.pause();
		const source = { provider: 'csl' as const, id: 'same' };
		const change = state.repository.commit(() => { state.repository.readBooks().other = { ...book, id: 'other', path: 'Books/other.pdf', source }; });
		await paused.entered;
		const result = state.index.applyImportedBooks([{ ...book, source }]).catch(error => error);
		paused.release(); await change;
		expect(await result).toBeInstanceOf(Error);
		expect(state.disk().books.other.source).toEqual(source);
		expect(state.disk().books[book.id].source).toBeUndefined();
	});
});
