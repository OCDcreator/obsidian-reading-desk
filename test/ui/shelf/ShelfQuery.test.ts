import { describe, expect, it } from 'vitest';
import type { LibraryBook } from '../../../src/types/contracts';
import { hasShelfFilters, pageBooks, queryBooks } from '../../../src/ui/shelf/ShelfQuery';
const book = (id: string, patch: Partial<LibraryBook> = {}): LibraryBook => ({ id, path: id + '.pdf', title: id, author: '', format: 'pdf', fileSize: 100, tags: [], progress: 0, fingerprint: { mtime: 1, size: 100 }, ...patch });
describe('shelf query and DOM budget', () => {
	it('combines format, tag, rating, explicit status, category and multiple-list membership', () => {
		const books = [book('a', { tags: ['学习'], rating: 8, categoryId: 'c', readingStatus: 'reading', listIds: ['l1', 'l2'], progress: 1 }), book('b', { tags: ['学习'], rating: 9, categoryId: 'c', progress: 0.5 }), book('c', { format: 'epub', tags: ['学习'], rating: 8, categoryId: 'c', readingStatus: 'reading', listIds: ['l2'] })];
		expect(queryBooks(books, { query: '', sort: 'title', format: 'pdf', tag: '学习', minRating: 8, readingStatus: 'reading', categoryId: 'c', listId: 'l2' }).map(book => book.id)).toEqual(['a']);
		// Explicit status stays independent of the percentage.
		expect(queryBooks(books, { query: '', sort: 'title', readingStatus: 'unread' }).map(book => book.id)).toEqual(['b']);
	});
	it('sorts descending values with a deterministic title tie break without mutating input', () => {
		const books = [book('b', { rating: 9 }), book('a', { rating: 9 }), book('c', { rating: 3 })];
		expect(queryBooks(books, { query: '', sort: 'rating' }).map(book => book.id)).toEqual(['a', 'b', 'c']);
		expect(books.map(book => book.id)).toEqual(['b', 'a', 'c']);
	});
	it('limits ten thousand books to forty nodes and clamps a page after filtering', () => {
		const books = Array.from({ length: 10000 }, (_, i) => book(String(i)));
		expect(pageBooks(books, 250)).toMatchObject({ page: 250, pages: 250, total: 10000 });
		expect(pageBooks(books, 250).items).toHaveLength(40);
		expect(pageBooks(books.slice(0, 2), 250)).toMatchObject({ page: 1, pages: 1 });
		expect(hasShelfFilters({ query: '', sort: 'rating', missingOnly: true })).toBe(true);
	});
});
