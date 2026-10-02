import type { HighlightColor, LibraryBook, PdfComment } from '../types/contracts';
import type { AnnotationStore } from './AnnotationStore';

export interface AnnotationSearchQuery {
	/** All whitespace-separated terms must occur in the excerpt or its comments. */
	text?: string;
	tags?: string[];
	tagMode?: 'all' | 'any';
	color?: HighlightColor;
	colors?: HighlightColor[];
	/** Case-insensitive substring of the complete chapter breadcrumb. */
	chapter?: string;
	/** Exact ancestor prefix for unambiguous chapter selection. */
	chapterPath?: string[];
	bookId?: string;
	bookIds?: string[];
	pdfPath?: string;
	pdfPaths?: string[];
}

export interface AnnotationSearchResult {
	highlightId: string;
	pdfPath: string;
	page: number;
	bookId?: string;
	bookTitle?: string;
	text: string;
	color: HighlightColor;
	tags: string[];
	chapterPath: string[];
	comments: PdfComment[];
	matchingComments: PdfComment[];
	createdAt: number;
	updatedAt: number;
}

/** A disposable read view: every query reads AnnotationStore's current truth. */
export class AnnotationSearchService {
	constructor(
		private readonly annotations: Pick<AnnotationStore, 'listAll' | 'comments'>,
		private readonly library?: { list(): LibraryBook[] }
	) { }

	search(query: AnnotationSearchQuery = {}): AnnotationSearchResult[] {
		const books = new Map((this.library?.list() ?? []).filter(book => book.path).map(book => [book.path, book]));
		const terms = normalized(query.text ?? '').split(/\s+/).filter(Boolean);
		const tags = (query.tags ?? []).map(normalized).filter(Boolean);
		const chapter = normalized(query.chapter ?? '');
		const results: AnnotationSearchResult[] = [];
		for (const highlight of this.annotations.listAll()) {
			const book = books.get(highlight.pdfPath);
			if (query.bookId !== undefined && book?.id !== query.bookId) continue;
			if (query.bookIds?.length && (!book || !query.bookIds.includes(book.id))) continue;
			if (query.pdfPath !== undefined && highlight.pdfPath !== query.pdfPath) continue;
			if (query.pdfPaths?.length && !query.pdfPaths.includes(highlight.pdfPath)) continue;
			if (query.color !== undefined && highlight.color !== query.color) continue;
			if (query.colors?.length && !query.colors.includes(highlight.color)) continue;
			const highlightTags = highlight.tags.map(normalized);
			if (tags.length && !(query.tagMode === 'any' ? tags.some(tag => highlightTags.includes(tag)) : tags.every(tag => highlightTags.includes(tag)))) continue;
			if (chapter && !normalized(highlight.chapterPath.join(' / ')).includes(chapter)) continue;
			if (query.chapterPath?.length && !query.chapterPath.every((part, index) => part === highlight.chapterPath[index])) continue;
			const comments = this.annotations.comments(highlight.id);
			const haystack = normalized([highlight.text, ...comments.map(comment => comment.content)].join('\n'));
			if (!terms.every(term => haystack.includes(term))) continue;
			results.push({
				highlightId: highlight.id, pdfPath: highlight.pdfPath, page: highlight.page,
				bookId: book?.id, bookTitle: book?.title, text: highlight.text, color: highlight.color,
				tags: [...highlight.tags], chapterPath: [...highlight.chapterPath],
				comments: comments.map(comment => ({ ...comment })),
				matchingComments: comments.filter(comment => terms.length && terms.some(term => normalized(comment.content).includes(term))).map(comment => ({ ...comment })),
				createdAt: highlight.createdAt, updatedAt: highlight.updatedAt
			});
		}
		return results.sort((left, right) => left.pdfPath.localeCompare(right.pdfPath, 'zh-CN') || left.page - right.page || left.createdAt - right.createdAt || left.highlightId.localeCompare(right.highlightId));
	}
}

function normalized(value: string): string { return value.normalize('NFKC').toLowerCase().trim(); }
