import { describe, expect, it } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import type { PdfComment, PdfHighlight } from '../../src/types/contracts';

function setup(): { store: AnnotationStore; highlights: Record<string, PdfHighlight>; comments: Record<string, PdfComment[]> } {
	const highlights: Record<string, PdfHighlight> = {};
	const comments: Record<string, PdfComment[]> = {};
	return { store: new AnnotationStore({ readHighlights: () => highlights, readComments: () => comments, commit: async mutation => mutation() }), highlights, comments };
}

const highlight: PdfHighlight = { id: 'h1', pdfPath: 'book.pdf', page: 0, rotation: 0, rects: [{ x: 0, y: 0, width: 0.2, height: 0.1 }], text: '一段原文', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1 };

describe('AnnotationStore', () => {
	it('persists comments, tags, and a reversible deletion as one source', async () => {
		const { store, highlights, comments } = setup();
		await store.save(highlight);
		await store.setTags('h1', ['研究', '研究', '']);
		await store.addComment('h1', '想法', 'pdf');
		expect(highlights.h1.tags).toEqual(['研究']);
		expect(comments.h1[0].showTimestamp).toBe(true);
		await store.remove('h1');
		expect(highlights.h1).toBeUndefined();
		expect(comments.h1).toBeUndefined();
	});
});
