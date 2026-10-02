import { describe, expect, it } from 'vitest';
import { diagnoseSourceAnchors } from '../../src/annotations/SourceAnchorDiagnostics';
import type { PdfHighlight } from '../../src/types/contracts';

function highlight(id: string, patch: Partial<PdfHighlight> = {}): PdfHighlight {
	return { id, pdfPath: 'book.pdf', page: 3, pageLabel: 'iv', rotation: 0, rects: [{ x: .1, y: .2, width: .3, height: .1 }],
		text: '原文引文', color: 'moss', chapterPath: ['第一章'], tags: [], createdAt: 1, updatedAt: 1, ...patch };
}
describe('source anchor diagnostics', () => {
	it('distinguishes stat matches, change and missing historical information without moving anchors', () => {
		const input = [highlight('match', { sourceFingerprint: { mtime: 2, size: 10 } }), highlight('changed', { sourceFingerprint: { mtime: 1, size: 10 } }), highlight('legacy')];
		const original = structuredClone(input);
		const results = diagnoseSourceAnchors(input, { mtime: 2, size: 10 });
		expect(results.map(item => item.status)).toEqual(['matched', 'changed', 'unknown']);
		expect(results[0]).toMatchObject({ page: 3, pageLabel: 'iv', quote: '原文引文' });
		expect(results[0].message).toContain('尚未核验正文'); expect(results[1].message).toContain('位置需核验'); expect(input).toEqual(original);
	});
	it('treats an unavailable current source as unknown and bounds display/search without modifying the original quote', () => {
		const source = highlight('large', { text: '摘录'.repeat(500), sourceFingerprint: { mtime: 1, size: 10 }, chapterPath: ['章节'.repeat(100)] });
		const [diagnostic] = diagnoseSourceAnchors([source], undefined);
		expect(diagnostic.status).toBe('unknown'); expect(diagnostic.quote.length).toBe(241); expect(diagnostic.searchQuery.length).toBe(120);
		expect(diagnostic.chapter.length).toBe(121); expect(source.text.length).toBe(1000);
	});
	it('rejects invalid stat evidence and keeps empty quote search empty', () => {
		const [diagnostic] = diagnoseSourceAnchors([highlight('blank', { text: '  ', sourceFingerprint: { mtime: NaN, size: 10 } })], { mtime: 1, size: 10 });
		expect(diagnostic.status).toBe('unknown'); expect(diagnostic.searchQuery).toBe('');
		expect(diagnoseSourceAnchors([], { mtime: 1, size: 10 })).toEqual([]);
	});
});
