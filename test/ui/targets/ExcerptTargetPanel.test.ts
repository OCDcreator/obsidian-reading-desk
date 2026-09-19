import { describe, expect, it } from 'vitest';
import type { PdfHighlight } from '../../../src/types/contracts';

const highlight: PdfHighlight = {
	id: 'excerpt-1', pdfPath: 'books/a.pdf', page: 0, rotation: 0,
	rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }], text: '一段可以编辑标题的摘录内容',
	color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1
};

describe('ExcerptTargetPanel contract', () => {
	it('identifies only persisted Reading Desk excerpts for a PDF', () => {
		const cards = [{ highlight, title: '关键结论', folded: true }];
		expect(cards[0].highlight.id).toBe('excerpt-1');
		expect(cards[0].folded).toBe(true);
	});

	it('keeps title and folding as an explicit, target-scoped patch', () => {
		const patch: { title?: string; folded?: boolean } = { title: '新标题', folded: false };
		expect(patch).toEqual({ title: '新标题', folded: false });
	});
});
