import type { BookFormat, ReadingStatus } from './contracts';

/** Persistent reader page is zero-based physical PDF page, never a printed label. */
export interface ReaderSavedPosition {
	page: number;
	/** Signed display-space page-relative offsets preserve cross-page viewports. */
	x: number;
	y: number;
	rotation: 0 | 90 | 180 | 270;
	scale: number;
	fitMode: 'manual' | 'width' | 'height' | 'page';
	updatedAt: number;
}
export interface ReaderBookmark {
	id: string;
	name: string;
	position: ReaderSavedPosition;
	createdAt: number;
	updatedAt: number;
}
export interface ReaderBookState {
	bookId: string;
	path: string;
	position?: ReaderSavedPosition;
	bookmarks: ReaderBookmark[];
}
export interface ShelfViewState {
	mode: 'cards' | 'table' | 'annotations';
	page: number;
	query: {
		query: string;
		sort: 'title' | 'author' | 'recent' | 'rating' | 'progress';
		categoryId?: string;
		format?: BookFormat;
		tag?: string;
		minRating?: number;
		readingStatus?: ReadingStatus;
		listId?: string;
		missingOnly?: boolean;
	};
}
