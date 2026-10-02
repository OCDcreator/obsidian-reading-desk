import type { BibliographicSource, LibraryBook } from '../types/contracts';

export type BibliographicProvider = BibliographicSource['provider'];
export interface BibliographicRecord {
	source: BibliographicSource;
	title: string;
	author: string;
	/** Hints from an export, never permission to read an external file. */
	attachmentPaths: string[];
}
export interface BibliographicDiagnostic {
	severity: 'warning' | 'error';
	message: string;
	index?: number;
}
export interface BibliographicParseResult {
	provider: BibliographicProvider;
	records: BibliographicRecord[];
	diagnostics: BibliographicDiagnostic[];
}
export interface BibliographicLocalFile {
	path: string;
	stat?: { mtime: number; size: number };
}
export interface BibliographicPlanOptions {
	availableFiles?: BibliographicLocalFile[];
	availablePaths?: string[];
	/** sourceKey -> existing vault PDF/EPUB path. Entries are explicit user confirmations. */
	pathMappings?: Record<string, string>;
}
export type BibliographicEntryKind = 'new' | 'update' | 'unchanged' | 'conflict' | 'no-attachment';
export interface BibliographicImportEntry {
	key: string;
	record: BibliographicRecord;
	kind: BibliographicEntryKind;
	bookId?: string;
	path?: string;
	pathConfirmed: boolean;
	suggestedPaths: string[];
	changes: Array<'title' | 'author' | 'source' | 'path'>;
	protectedFields: Array<'title' | 'author'>;
	reason?: string;
}
export interface BibliographicImportPlan {
	entries: BibliographicImportEntry[];
	/** Only applicable additions/updates. Pass through LibraryIndex.applyImportedBooks after confirmation. */
	resultBooks: LibraryBook[];
	diagnostics: BibliographicDiagnostic[];
	hasErrors: boolean;
	summary: Record<BibliographicEntryKind, number>;
}

export function bibliographicSourceKey(source: BibliographicSource): string {
	return `${source.provider}:${source.id}`;
}

/** Two independent 32-bit hashes; deterministic across devices, never used as a security digest. */
export function bibliographicStableHash(value: string): string {
	let first = 2166136261;
	let second = 5381;
	for (let index = 0; index < value.length; index++) {
		first = Math.imul(first ^ value.charCodeAt(index), 16777619);
		second = Math.imul(second, 33) ^ value.charCodeAt(index);
	}
	return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
}
