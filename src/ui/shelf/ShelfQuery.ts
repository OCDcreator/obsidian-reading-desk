import type { BookFormat, LibraryBook, ReadingStatus } from '../../types/contracts';
import { filterBooks } from '../../views/shelf/ShelfViewModel';
export type ShelfSort = 'title' | 'author' | 'recent' | 'rating' | 'progress';
export interface ShelfQuery {
	query: string;
	categoryId?: string;
	format?: BookFormat;
	tag?: string;
	minRating?: number;
	readingStatus?: ReadingStatus;
	listId?: string;
	missingOnly?: boolean;
	sort: ShelfSort;
}
export const SHELF_PAGE_SIZE = 40;
export const CONTINUE_LIMIT = 6;
export const STATUS_LABELS: Record<ReadingStatus, string> = { unread: '未读', reading: '在读', finished: '读完', abandoned: '暂搁' };
export function hasShelfFilters(query: ShelfQuery): boolean {
	return !!(query.query.trim() || query.categoryId || query.format || query.tag || query.minRating || query.readingStatus || query.listId || query.missingOnly);
}
export function queryBooks(books: LibraryBook[], query: ShelfQuery): LibraryBook[] {
	const filtered = filterBooks(books, query).filter(book =>
		(!query.format || book.format === query.format) &&
		(!query.tag || book.tags.includes(query.tag)) &&
		(!query.minRating || (book.rating ?? 0) >= query.minRating) &&
		(!query.readingStatus || (book.readingStatus ?? 'unread') === query.readingStatus) &&
		(!query.listId || book.listIds?.includes(query.listId)) &&
		(!query.missingOnly || book.missing)
	);
	return filtered.sort((a, b) => compareBooks(a, b, query.sort) || a.title.localeCompare(b.title, 'zh-CN') || a.id.localeCompare(b.id));
}
function compareBooks(a: LibraryBook, b: LibraryBook, sort: ShelfSort): number {
	switch (sort) {
		case 'author': return a.author.localeCompare(b.author, 'zh-CN');
		case 'recent': return (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0);
		case 'rating': return (b.rating ?? 0) - (a.rating ?? 0);
		case 'progress': return b.progress - a.progress;
		default: return a.title.localeCompare(b.title, 'zh-CN');
	}
}
export function pageBooks<T>(items: T[], requested: number, size = SHELF_PAGE_SIZE): { items: T[]; page: number; pages: number; total: number } {
	const pages = Math.max(1, Math.ceil(items.length / size));
	const page = Math.max(1, Math.min(pages, requested));
	return { items: items.slice((page - 1) * size, page * size), page, pages, total: items.length };
}
