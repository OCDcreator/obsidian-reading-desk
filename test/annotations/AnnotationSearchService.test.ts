import { describe, expect, it, vi } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { AnnotationSearchService } from '../../src/annotations/AnnotationSearchService';
import type { PdfComment, PdfHighlight } from '../../src/types/contracts';
import { libraryBook } from '../library/LibraryTestHelpers';

function highlight(id: string, patch: Partial<PdfHighlight> = {}): PdfHighlight {
	return { id, pdfPath: '书/one.pdf', page: 4, rotation: 0, rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }], text: '共同引文', color: 'moss', chapterPath: ['理论', '第一章'], tags: ['主题'], createdAt: 1, updatedAt: 2, ...patch };
}

function harness() {
	const highlights: Record<string, PdfHighlight> = { one: highlight('one'), two: highlight('two', { pdfPath: '书/two.pdf', color: 'amber', chapterPath: ['实践'], tags: ['其他'], text: '对照', page: 1 }) };
	const comments: Record<string, PdfComment[]> = {};
	const commit = vi.fn(async (change: () => void) => change());
	const store = new AnnotationStore({ readHighlights: () => highlights, readComments: () => comments, commit });
	const library = { list: () => [libraryBook('book-one', '书/one.pdf', { missing: true }), libraryBook('book-two', '书/two.pdf')] };
	return { highlights, comments, commit, store, search: new AnnotationSearchService(store, library) };
}

describe('AnnotationSearchService', () => {
	it('finds comment-only terms and combines text/tags/color/chapter/book filters with stable anchors', async () => {
		const { store, search, commit } = harness();
		const comment = await store.addComment('one', '只有评论中的关键字 INSIGHT', 'pdf');
		const before = commit.mock.calls.length;
		const result = search.search({ text: '关键字 insight', tags: ['主题'], color: 'moss', chapter: '第一章', bookId: 'book-one' });
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ highlightId: 'one', pdfPath: '书/one.pdf', page: 4, bookId: 'book-one', bookTitle: 'book-one', matchingComments: [comment] });
		expect(commit.mock.calls.length).toBe(before);
		expect(search.search({ text: '关键字', colors: ['amber'] })).toHaveLength(0);
		expect(search.search({ text: '关键字', bookIds: ['book-two'] })).toHaveLength(0);
		expect(search.search({ text: '关键字', chapterPath: ['理论', '第二章'] })).toHaveLength(0);
	});

	it('reads edits and deletions from the true store on each query', async () => {
		const { store, search } = harness();
		const comment = await store.addComment('one', 'first-keyword', 'markdown');
		expect(search.search({ text: 'first-keyword' }).map(result => result.highlightId)).toEqual(['one']);
		await store.deleteComment('one', comment.id);
		expect(search.search({ text: 'first-keyword' })).toHaveLength(0);
		await store.setTags('one', ['edited']);
		await store.recolor('one', 'brick');
		expect(search.search({ tags: ['edited'], color: 'brick' })).toHaveLength(1);
		expect(search.search({ tags: ['主题'], color: 'moss' })).toHaveLength(0);
		await store.remove('one');
		expect(search.search().some(result => result.highlightId === 'one')).toBe(false);
	});

	it('returns detached arrays/comments so result presentation cannot mutate annotations', async () => {
		const { store, search } = harness();
		await store.addComment('one', 'note', 'pdf');
		const result = search.search({ text: 'note' })[0];
		result.tags.push('presentation');
		result.chapterPath[0] = 'changed';
		result.comments[0].content = 'changed';
		result.matchingComments[0].content = 'changed again';
		expect(store.get('one').tags).toEqual(['主题']);
		expect(store.get('one').chapterPath).toEqual(['理论', '第一章']);
		expect(store.comments('one')[0].content).toBe('note');
	});

	it('keeps orphan/offline annotations searchable without requiring book metadata', () => {
		const { store, commit } = harness();
		const search = new AnnotationSearchService(store);
		expect(search.search({ pdfPaths: ['书/one.pdf'] })).toMatchObject([{ highlightId: 'one', pdfPath: '书/one.pdf', page: 4 }]);
		expect(search.search({ bookId: 'not-indexed' })).toHaveLength(0);
		expect(commit).not.toHaveBeenCalled();
	});

	it('supports all/any tag matching, ancestor prefix and deterministic source/page ordering', () => {
		const { search, highlights } = harness();
		highlights.three = highlight('three', { page: 2, tags: ['主题', '方法'] });
		expect(search.search({ tags: ['主题', '方法'] }).map(result => result.highlightId)).toEqual(['three']);
		expect(search.search({ tags: ['方法', '其他'], tagMode: 'any' }).map(result => result.highlightId)).toEqual(['three', 'two']);
		expect(search.search({ chapterPath: ['理论'], text: '共同引文' }).map(result => result.highlightId)).toEqual(['three', 'one']);
		expect(search.search({ pdfPath: '书/one.pdf', colors: ['moss'] }).map(result => result.highlightId)).toEqual(['three', 'one']);
	});
});
