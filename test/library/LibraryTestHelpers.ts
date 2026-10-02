import { vi } from 'vitest';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import type { BookMetadataExtractor, LibraryFile } from '../../src/library/LibraryIndex';
import type { LibraryBook, LibraryCategory, LibraryList } from '../../src/types/contracts';

export function libraryFile(path = '书/one.pdf', mtime = 1, size = 4): LibraryFile {
	return { path, extension: path.split('.').pop() ?? 'pdf', stat: { mtime, size } };
}

export function libraryBook(id: string, path = `书/${id}.pdf`, patch: Partial<LibraryBook> = {}): LibraryBook {
	return { id, path, title: id, author: '原作者', format: 'pdf', fileSize: 4, fingerprint: { mtime: 1, size: 4 }, tags: [], progress: 0, ...patch };
}

export function libraryHarness(initial: LibraryBook[] = [], extractor?: BookMetadataExtractor) {
	const books: Record<string, LibraryBook> = Object.fromEntries(initial.map(book => [book.id, book]));
	const categories: LibraryCategory[] = [];
	const lists: LibraryList[] = [];
	const commit = vi.fn(async (change: () => void) => change());
	const extract = vi.fn(extractor?.extract ?? (async () => ({ title: '自动标题', author: '自动作者', pageCount: 2, coverPath: 'covers/one.png' })));
	const persistence = { readBooks: () => books, readCategories: () => categories, readLists: () => lists, commit };
	return { index: new LibraryIndex(persistence, { extract }), books, categories, lists, commit, extract, persistence };
}
