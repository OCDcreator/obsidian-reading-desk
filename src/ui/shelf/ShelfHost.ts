import type { BookFormat, LibraryBook, LibraryCategory, LibraryList } from '../../types/contracts';
import type { LibraryBookPatch } from '../../library/LibraryTypes';
import type { AnnotationSearchQuery, AnnotationSearchResult } from '../../annotations/AnnotationSearchService';
export type Awaitable<T> = T | Promise<T>;
export type BookPatch = LibraryBookPatch;
export type ShelfBatchPatch = LibraryBookPatch;
export type ShelfAnnotationQuery = AnnotationSearchQuery;
export interface ShelfAnnotationHit extends AnnotationSearchResult {
	/** Zero-based PdfHighlight page; display labels add one, navigation uses highlightId. */
	page: number;
}
export interface ShelfCandidateFile { path: string; format?: BookFormat; }
export interface ShelfViewHost {
	getBooks(): Awaitable<LibraryBook[]>;
	getCategories(): Awaitable<LibraryCategory[]>;
	addCategory(name: string): Awaitable<LibraryCategory>;
	reorderCategories(ids: string[]): Awaitable<void>;
	updateBook(id: string, patch: BookPatch): Awaitable<void>;
	openBook(book: LibraryBook): Awaitable<void>;
	scan(): Awaitable<void>;
	resolveCoverUrl?(coverPath: string): string | null;
	openSettings?(): Awaitable<void>;
	getLists?(): Awaitable<LibraryList[]>;
	createList?(name: string): Awaitable<LibraryList>;
	batchUpdate?(ids: string[], patch: ShelfBatchPatch): Awaitable<void>;
	clearMetadataOverride?(id: string, fields: Array<'title' | 'author'>): Awaitable<void>;
	searchAnnotations?(query: ShelfAnnotationQuery): Awaitable<ShelfAnnotationHit[]>;
	openHighlight?(path: string, id: string): Awaitable<void>;
	candidateFiles?(): Awaitable<ShelfCandidateFile[]>;
	listSourcePaths?(): Awaitable<string[]>;
	relinkBook?(id: string, path: string): Awaitable<void>;
}
