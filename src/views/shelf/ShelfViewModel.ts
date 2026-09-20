import type { LibraryBook, LibraryCategory } from '../../types/contracts';

/** A=卡片墙, C=台账, B=分类导航工作台; stored as the remembered shelf layout. */
export type ShelfLayout = 'cards' | 'ledger' | 'navigation';
export type ShelfSortMode = 'recent' | 'title';

export interface ShelfFilters {
	query?: string;
	categoryId?: string;
	/** 「查看阅读记录」筛选态：主列表只保留有阅读记录的书并强制最近阅读排序。 */
	historyOnly?: boolean;
}

export interface LedgerStats {
	totalBooks: number;
	readingBooks: number;
	highlights: number;
	averageProgress: number;
}

/** Keeps IME composition text out of filtering until the composition commits. */
export class ShelfSearchController {
	private composing = false;
	private pending = '';

	beginComposition(): void { this.composing = true; }

	input(value: string): string | null {
		this.pending = value;
		return this.composing ? null : value;
	}

	endComposition(value: string): string {
		this.composing = false;
		this.pending = value;
		return this.pending;
	}
}

export interface KeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const LAYOUT_KEY = 'reading-desk-shelf-layout';
const SORT_KEY = 'reading-desk-shelf-sort';

/** Remembers layout and sort across sessions; storage failures fall back to defaults. */
export class ShelfViewStateStore {
	constructor(private readonly storage: KeyValueStorage) { }

	readLayout(): ShelfLayout {
		return this.read(LAYOUT_KEY, ['cards', 'ledger', 'navigation'], 'cards');
	}

	writeLayout(layout: ShelfLayout): void {
		this.write(LAYOUT_KEY, layout);
	}

	readSortMode(): ShelfSortMode {
		return this.read(SORT_KEY, ['recent', 'title'], 'recent');
	}

	writeSortMode(mode: ShelfSortMode): void {
		this.write(SORT_KEY, mode);
	}

	private read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
		try {
			const value = this.storage.getItem(key) as T | null;
			return value && allowed.includes(value) ? value : fallback;
		} catch {
			return fallback;
		}
	}

	private write(key: string, value: string): void {
		try { this.storage.setItem(key, value); } catch { /* Storage can be unavailable in private windows. */ }
	}
}

/** 阅读记录筛选态下继续阅读轨仍是「查看阅读记录」入口，只有搜索或分类筛选会隐藏它。 */
export function shouldShowContinueReading(filters: ShelfFilters): boolean {
	return !(filters.query ?? '').trim() && !filters.categoryId;
}

export function hasReadingHistory(book: LibraryBook): boolean {
	return book.progress > 0 || book.lastReadAt !== undefined;
}

export function isReading(book: LibraryBook): boolean {
	return book.progress > 0 && book.progress < 1;
}

export function filterBooks(books: LibraryBook[], filters: ShelfFilters): LibraryBook[] {
	const normalizedQuery = (filters.query ?? '').trim().toLocaleLowerCase('zh-CN');
	return books.filter(book => {
		const matchesCategory = !filters.categoryId || book.categoryId === filters.categoryId;
		if (!matchesCategory) return false;
		if (filters.historyOnly && !hasReadingHistory(book)) return false;
		if (!normalizedQuery) return true;
		return [book.title, book.author, ...book.tags]
			.some(value => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
	});
}

/** 继续阅读轨：只收正在读的书，按最近打开倒序，取前三张。 */
export function continueReadingBooks(books: LibraryBook[], limit = 3): LibraryBook[] {
	return books
		.filter(book => isReading(book))
		.sort((left, right) => (right.lastReadAt ?? 0) - (left.lastReadAt ?? 0))
		.slice(0, limit);
}

/** B 导航的重点卡：当前筛选结果里最近读过的那本。 */
export function focusBookFor(books: LibraryBook[]): LibraryBook | undefined {
	return [...books]
		.filter(book => hasReadingHistory(book))
		.sort((left, right) => (right.lastReadAt ?? 0) - (left.lastReadAt ?? 0))[0];
}

/** 「上次读到第 N 页」由进度与页数换算；页数未知时不显示该行。 */
export function lastReadPageOf(book: LibraryBook): number | undefined {
	if (!book.pageCount || !isFinite(book.pageCount) || book.pageCount <= 0) return undefined;
	const page = Math.ceil(clamp01(book.progress) * book.pageCount);
	return Math.min(Math.max(page, 1), book.pageCount);
}

export function ledgerStats(books: LibraryBook[], highlights: number): LedgerStats {
	const totalProgress = books.reduce((sum, book) => sum + clamp01(book.progress), 0);
	return {
		totalBooks: books.length,
		readingBooks: books.filter(book => isReading(book)).length,
		highlights,
		averageProgress: books.length === 0 ? 0 : Math.round((totalProgress / books.length) * 100)
	};
}

export function sortCategories(categories: LibraryCategory[]): LibraryCategory[] {
	return [...categories].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'zh-CN'));
}

export function categoryBookCount(books: LibraryBook[], categoryId: string): number {
	return books.filter(book => book.categoryId === categoryId).length;
}

export function formatFileSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / Math.pow(1024, exponent);
	return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatProgress(progress: number): string {
	return `${Math.round(clamp01(progress) * 100)}%`;
}

export function parseTags(value: string): string[] {
	return [...new Set(value.split(/[，,]/).map(tag => tag.trim()).filter(Boolean))];
}

function clamp01(progress: number): number {
	return Math.max(0, Math.min(1, progress));
}
