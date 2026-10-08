import type { LibraryBook } from '../types/contracts';
import type { BookEnrichment, ExtractedBookMetadata, LibraryBookPatch, MetadataField } from './LibraryTypes';

export function uniqueValues(values: string[]): string[] {
	return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

export function automaticMetadata(book: LibraryBook): { title: string; author: string } {
	return { ...(book.autoMetadata ?? { title: book.title, author: book.author }) };
}

export function applyAutomaticMetadata(book: LibraryBook, automatic: { title: string; author: string }): LibraryBook {
	return {
		...book,
		autoMetadata: { ...automatic },
		metadataOverrides: book.metadataOverrides ? { ...book.metadataOverrides } : undefined,
		title: book.metadataOverrides?.title ?? automatic.title,
		author: book.metadataOverrides?.author ?? automatic.author
	};
}

export function extractedAutomaticMetadata(previous: LibraryBook | undefined, extracted: ExtractedBookMetadata, fallbackTitle: string): { title: string; author: string } {
	// A parse failure cannot turn known automatic values into a filename/empty author.
	// Bibliographic fields retain their explicit provenance until the next source import.
	if (previous && (extracted.metadataError || (previous.source && previous.autoMetadata))) return automaticMetadata(previous);
	return { title: extracted.title || fallbackTitle, author: extracted.author ?? '' };
}

export function validateBookPatch(patch: LibraryBookPatch): void {
	if (patch.title !== undefined && !patch.title.trim()) throw new Error('标题不能为空');
	if (patch.rating !== undefined && patch.rating !== null && (!Number.isFinite(patch.rating) || patch.rating < 0 || patch.rating > 10)) throw new Error('评分必须在 0 到 10 之间');
	if (patch.tagMode !== undefined && !['append', 'replace', 'remove'].includes(patch.tagMode)) throw new Error('无效的标签操作');
	if (patch.listMode !== undefined && !['append', 'replace', 'remove'].includes(patch.listMode)) throw new Error('无效的列表操作');
	if (patch.readingStatus !== undefined && !['unread', 'reading', 'finished', 'abandoned'].includes(patch.readingStatus)) throw new Error('无效的阅读状态');
}

export function applyBookPatch(book: LibraryBook, patch: LibraryBookPatch): LibraryBook {
	let result = applyAutomaticMetadata(book, automaticMetadata(book));
	if (patch.title !== undefined || patch.author !== undefined) {
		result.metadataOverrides = { ...result.metadataOverrides };
		if (patch.title !== undefined) result.metadataOverrides.title = patch.title.trim();
		if (patch.author !== undefined) result.metadataOverrides.author = patch.author.trim();
		result = applyAutomaticMetadata(result, automaticMetadata(result));
	}
	if (patch.tags !== undefined) {
		const tags = uniqueValues(patch.tags);
		result.tags = patch.tagMode === 'append' ? uniqueValues([...book.tags, ...tags])
			: patch.tagMode === 'remove' ? book.tags.filter(tag => !tags.includes(tag)) : tags;
	}
	if (Object.prototype.hasOwnProperty.call(patch, 'categoryId')) result.categoryId = patch.categoryId ?? undefined;
	if (Object.prototype.hasOwnProperty.call(patch, 'rating')) result.rating = patch.rating ?? undefined;
	if (patch.readingStatus !== undefined) result.readingStatus = patch.readingStatus;
	if (patch.listIds !== undefined) {
		const lists = uniqueValues(patch.listIds);
		result.listIds = patch.listMode === 'append' ? uniqueValues([...(book.listIds ?? []), ...lists])
			: patch.listMode === 'remove' ? (book.listIds ?? []).filter(id => !lists.includes(id)) : lists;
	}
	// A manual edit is the review: low-confidence enrichment flags do not survive it.
	result.needsReview = undefined;
	return result;
}

function filenameTitle(path: string): string {
	return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '') || path;
}

/** Online enrichment writes automatic blank fields only; manual overrides and source identity stay untouched. */
export function applyEnrichment(book: LibraryBook, patch: BookEnrichment): LibraryBook {
	const automatic = automaticMetadata(book);
	const overrides = book.metadataOverrides ?? {};
	if (patch.title && overrides.title === undefined && (!automatic.title.trim() || automatic.title === filenameTitle(book.path))) automatic.title = patch.title;
	if (patch.author && overrides.author === undefined && !automatic.author.trim()) automatic.author = patch.author;
	const result = applyAutomaticMetadata({ ...book }, automatic);
	if (patch.pageCount !== undefined && result.pageCount === undefined && Number.isInteger(patch.pageCount) && patch.pageCount >= 1) result.pageCount = patch.pageCount;
	if (patch.rating !== undefined && result.rating === undefined && Number.isFinite(patch.rating)) result.rating = Math.max(0, Math.min(10, patch.rating));
	if (patch.coverPath && !result.coverPath) result.coverPath = patch.coverPath;
	if (patch.source && !result.source) result.source = { ...patch.source };
	result.needsReview = patch.needsReview || undefined;
	result.enrichment = { ...patch.record };
	return result;
}

export function clearOverrides(book: LibraryBook, fields: MetadataField[]): LibraryBook {
	const metadataOverrides = { ...book.metadataOverrides };
	for (const field of fields) delete metadataOverrides[field];
	return applyAutomaticMetadata({ ...book, metadataOverrides }, automaticMetadata(book));
}
