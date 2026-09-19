import type { LibraryBook, LibraryCategory } from '../../types/contracts';

export type ShelfDisplayMode = 'cards' | 'table';

export interface ShelfFilters {
	query: string;
	categoryId?: string;
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

export function shouldShowContinueReading(filters: ShelfFilters): boolean {
	return !filters.query.trim() && !filters.categoryId;
}

export function filterBooks(books: LibraryBook[], filters: ShelfFilters): LibraryBook[] {
	const normalizedQuery = filters.query.trim().toLocaleLowerCase('zh-CN');
	return books.filter(book => {
		const matchesCategory = !filters.categoryId || book.categoryId === filters.categoryId;
		if (!matchesCategory) return false;
		if (!normalizedQuery) return true;
		return [book.title, book.author, ...book.tags]
			.some(value => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
	});
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
	return `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
}

export function parseTags(value: string): string[] {
	return [...new Set(value.split(/[，,]/).map(tag => tag.trim()).filter(Boolean))];
}
