import type { BibliographicSource, BookEnrichmentRecord, LibraryBook, ReadingStatus } from '../types/contracts';

export interface LibraryFile {
	path: string;
	extension: string;
	stat: { mtime: number; size: number };
}

/** A host batches create/modify as upsert; rename uses explicitly confirmed relink. */
export type LibraryFileEvent = { type: 'upsert'; file: LibraryFile } | { type: 'delete'; path: string };

export interface LibraryBookPatch {
	title?: string;
	author?: string;
	tags?: string[];
	tagMode?: 'append' | 'replace' | 'remove';
	categoryId?: string | null;
	rating?: number | null;
	readingStatus?: ReadingStatus;
	listIds?: string[];
	listMode?: 'append' | 'replace' | 'remove';
}

export interface LibraryImportUpdate {
	source: BibliographicSource;
	path: string;
	title: string;
	author: string;
	tags?: string[];
	bookId?: string;
}

export interface LibraryRelinkOptions {
	confirmed: boolean;
	replaceBookId?: string;
	/** Online rename already identifies the source; retain extracted metadata. */
	skipExtraction?: boolean;
	/** Pure synchronous host remap, inside the same persistence transaction. */
	mutateRelated?: (oldPath: string, newPath: string) => void;
}

export interface LibraryRelinkResult {
	bookId: string;
	oldPath: string;
	newPath: string;
}

export interface LibraryRelinkCandidate {
	file: LibraryFile;
	/** A suggestion only: neither filename nor mtime/size proves identity. */
	sameName: boolean;
	sameFingerprint: boolean;
}

export type MetadataField = 'title' | 'author';
export type ExtractedBookMetadata = Pick<LibraryBook, 'title' | 'author' | 'pageCount' | 'coverPath' | 'metadataError' | 'coverRetryable' | 'coverError'>;

/**
 * Field-level enrichment for one existing book. Blank fields only; never touches
 * metadataOverrides, identity fields, or merges records (ADR 0017 vs ADR 0011).
 */
export interface BookEnrichment {
	title?: string;
	author?: string;
	pageCount?: number;
	rating?: number;
	coverPath?: string;
	source?: BibliographicSource;
	needsReview: boolean;
	record: BookEnrichmentRecord;
}
