import { describe, expect, it } from 'vitest';
import type { LibraryBook, LibraryCategory } from '../../../src/types/contracts';
import {
	categoryBookCount,
	continueReadingBooks,
	filterBooks,
	focusBookFor,
	formatFileSize,
	formatProgress,
	hasReadingHistory,
	lastReadPageOf,
	ledgerStats,
	parseTags,
	ShelfSearchController,
	ShelfViewStateStore,
	shouldShowContinueReading,
	sortCategories
} from '../../../src/views/shelf/ShelfViewModel';

const books: LibraryBook[] = [
	{
		id: 'one', path: '研究/光.pdf', format: 'pdf', title: '光的研究', author: '王明', pageCount: 12,
		fileSize: 1024, tags: ['物理', '实验'], progress: 0.25, categoryId: 'science', lastReadAt: 100, fingerprint: { mtime: 1, size: 1024 }
	},
	{
		id: 'two', path: '小说/河.epub', format: 'epub', title: '河流', author: '李青',
		fileSize: 2 * 1024 * 1024, tags: ['文学'], progress: 2, categoryId: 'fiction', fingerprint: { mtime: 2, size: 2 }
	}
];

describe('ShelfViewModel', () => {
	it('按中文标题、作者和标签筛选，并保留分类约束', () => {
		expect(filterBooks(books, { query: '研究' }).map(book => book.id)).toEqual(['one']);
		expect(filterBooks(books, { query: '王明' }).map(book => book.id)).toEqual(['one']);
		expect(filterBooks(books, { query: '文学', categoryId: 'science' })).toEqual([]);
	});

	it('按持久化顺序组织分类并计算分类计数', () => {
		const categories: LibraryCategory[] = [
			{ id: 'fiction', name: '文学', order: 2 },
			{ id: 'science', name: '科学', order: 1 }
		];
		expect(sortCategories(categories).map(category => category.id)).toEqual(['science', 'fiction']);
		expect(categoryBookCount(books, 'science')).toBe(1);
	});

	it('提供稳定的文件、进度和标签显示值', () => {
		expect(formatFileSize(1024)).toBe('1.0 KB');
		expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
		expect(formatProgress(-1)).toBe('0%');
		expect(formatProgress(1.2)).toBe('100%');
		expect(parseTags('物理， 实验,物理')).toEqual(['物理', '实验']);
	});
});

describe('Shelf search composition', () => {
	it('defers filtering during IME composition and commits once composition ends', () => {
		const search = new ShelfSearchController();
		search.beginComposition();
		expect(search.input('yan')).toBeNull();
		expect(search.endComposition('研究')).toBe('研究');
		expect(search.input('研究资料')).toBe('研究资料');
	});

	it('does not show continue-reading cards for a search or category filter', () => {
		expect(shouldShowContinueReading({ query: '' })).toBe(true);
		expect(shouldShowContinueReading({ query: '研究' })).toBe(false);
		expect(shouldShowContinueReading({ query: '', categoryId: 'science' })).toBe(false);
	});
});

describe('Reading-history filter state', () => {
	it('filters to books with history and composes with search and category without leaking', () => {
		expect(filterBooks(books, { query: '', historyOnly: true }).map(book => book.id)).toEqual(['one', 'two']);
		expect(filterBooks(books, { query: '河流', historyOnly: true }).map(book => book.id)).toEqual(['two']);
		expect(filterBooks(books, { categoryId: 'science', historyOnly: true }).map(book => book.id)).toEqual(['one']);
		expect(filterBooks(books, { query: '河流', categoryId: 'science', historyOnly: true })).toEqual([]);
		expect(hasReadingHistory(books[0])).toBe(true);
		expect(hasReadingHistory({ ...books[1], progress: 0 })).toBe(false);
	});

	it('keeps the rail visible while the history filter is the only active filter', () => {
		expect(shouldShowContinueReading({ query: '', historyOnly: true })).toBe(true);
	});
});

describe('Continue reading and focus book selection', () => {
	const reading = [
		{ ...books[0], progress: 0.4, lastReadAt: 200 },
		{ ...books[1], progress: 0.8, lastReadAt: 900 },
		{ ...books[0], id: 'three', progress: 0.6, lastReadAt: 500 },
		{ ...books[1], id: 'four', progress: 0.1, lastReadAt: 700 }
	];

	it('ranks only in-progress books by lastReadAt and caps at three', () => {
		expect(continueReadingBooks(reading).map(book => book.id)).toEqual(['two', 'four', 'three']);
		expect(continueReadingBooks(reading, 2)).toHaveLength(2);
	});

	it('picks the most recently read book as the navigation focus', () => {
		expect(focusBookFor(reading)?.id).toBe('two');
		expect(focusBookFor([{ ...books[0], progress: 0, lastReadAt: undefined }])).toBeUndefined();
	});

	it('derives 上次读到第 N 页 from progress and page count with clamping', () => {
		expect(lastReadPageOf({ ...books[0], progress: 0, lastReadAt: 1 })).toBe(1);
		expect(lastReadPageOf({ ...books[0], progress: 0.25 })).toBe(3);
		expect(lastReadPageOf({ ...books[0], progress: 1 })).toBe(12);
		expect(lastReadPageOf({ ...books[0], pageCount: undefined })).toBeUndefined();
	});
});

describe('Ledger stats and remembered view state', () => {
	it('computes the four summary cells from real data', () => {
		expect(ledgerStats(books, 142)).toEqual({ totalBooks: 2, readingBooks: 1, highlights: 142, averageProgress: 63 });
		expect(ledgerStats([], 0).averageProgress).toBe(0);
	});

	it('remembers layout and sort through injectable storage and ignores bad values', () => {
		const bag = new Map<string, string>();
		const storage = {
			getItem: (key: string) => bag.get(key) ?? null,
			setItem: (key: string, value: string) => { bag.set(key, value); }
		};
		const store = new ShelfViewStateStore(storage);
		expect(store.readLayout()).toBe('cards');
		expect(store.readSortMode()).toBe('recent');
		store.writeLayout('navigation');
		store.writeSortMode('title');
		expect(store.readLayout()).toBe('navigation');
		expect(store.readSortMode()).toBe('title');
		bag.set('reading-desk-shelf-layout', 'bogus');
		bag.set('reading-desk-shelf-sort', 'nope');
		expect(new ShelfViewStateStore(storage).readLayout()).toBe('cards');
		expect(new ShelfViewStateStore(storage).readSortMode()).toBe('recent');
	});

	it('falls back to defaults when storage throws', () => {
		const broken = {
			getItem: () => { throw new Error('private mode'); },
			setItem: () => { throw new Error('private mode'); }
		};
		const store = new ShelfViewStateStore(broken);
		expect(store.readLayout()).toBe('cards');
		expect(() => store.writeLayout('ledger')).not.toThrow();
	});
});
