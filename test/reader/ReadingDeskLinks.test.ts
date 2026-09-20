import { describe, expect, it, vi } from 'vitest';
import { createHighlightLink, createPageLink, parseReadingDeskLink, writeReadingDeskLink } from '../../src/reader/ReadingDeskLinks';

describe('ReadingDeskLinks', () => {
	it('keeps the legacy stable-highlight protocol and resolves it without requiring a file', () => {
		expect(createHighlightLink({ id: 'high light', pdfPath: '书籍/示例.pdf' }))
			.toBe('obsidian://reading-desk-highlight?file=%E4%B9%A6%E7%B1%8D%2F%E7%A4%BA%E4%BE%8B.pdf&highlight=high%20light');
		expect(parseReadingDeskLink({ highlight: 'high light', file: 'stale.pdf' })).toEqual({
			ok: true,
			target: { kind: 'highlight', highlightId: 'high light', file: 'stale.pdf' }
		});
	});

	it('creates and parses a 1-based page link with a rename-stable book id', () => {
		const link = createPageLink({ file: '书籍/示例.pdf', page: 2, bookId: 'book-1' });
		expect(link).toContain('page=2');
		expect(link).toContain('book=book-1');
		expect(parseReadingDeskLink({ file: '书籍/示例.pdf', page: '2', book: 'book-1' })).toEqual({
			ok: true,
			target: { kind: 'page', file: '书籍/示例.pdf', page: 2, bookId: 'book-1' }
		});
	});

	it('rejects zero, fractional, missing, and malformed visible page numbers', () => {
		for (const page of ['0', '-1', '1.5', 'abc', '']) {
			expect(parseReadingDeskLink({ file: 'book.pdf', page })).toMatchObject({ ok: false });
		}
		expect(() => createPageLink({ file: 'book.pdf', page: 0 })).toThrow('可见页码');
		expect(parseReadingDeskLink({ file: 'book.pdf', page: '1', highlight: 'h-1' })).toMatchObject({ ok: false });
	});

	it('surfaces clipboard success and failure through the same owner', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		await writeReadingDeskLink({ writeText }, 'obsidian://example');
		expect(writeText).toHaveBeenCalledWith('obsidian://example');
		await expect(writeReadingDeskLink({ writeText: vi.fn().mockRejectedValue(new Error('denied')) }, 'x')).rejects.toThrow('denied');
	});
});
