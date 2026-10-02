import { describe, expect, it } from 'vitest';
import { remapAnnotationPaths } from '../../src/host/SourcePathRemap';
import { createEmptyData } from '../../src/data/defaults';
import type { PdfHighlight } from '../../src/types/contracts';

const highlight = (id: string, pdfPath: string, targetPath: string): PdfHighlight => ({ id, pdfPath, page: 0, rotation: 0,
	rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }], text: id, color: 'moss', chapterPath: [], tags: [],
	target: { type: 'markdown', path: targetPath }, createdAt: 1, updatedAt: 1 });

describe('source path migration', () => {
	it('remaps active, pending and recoverable annotations while preserving identity and normalized geometry', () => {
		const data = createEmptyData();
		data.highlights.a = highlight('a', 'Books/old/a.pdf', 'Books/old/notes.md');
		data.highlights.other = highlight('other', 'Books/older/b.pdf', 'Notes/b.md');
		data.pendingTargetWrites.a = structuredClone(data.highlights.a);
		data.deletedAnnotations.gone = { highlight: highlight('gone', 'Books/old/c.pdf', 'Notes/c.md'), comments: [], deletedAt: 2, reason: 'target-deleted' };
		const geometry = structuredClone(data.highlights.a.rects);
		expect(remapAnnotationPaths(data, 'Books/old', 'Archive/new')).toEqual(['a']);
		expect(data.highlights.a.pdfPath).toBe('Archive/new/a.pdf');
		expect(data.highlights.a.target?.path).toBe('Archive/new/notes.md');
		expect(data.pendingTargetWrites.a.pdfPath).toBe('Archive/new/a.pdf');
		expect(data.deletedAnnotations.gone.highlight.pdfPath).toBe('Archive/new/c.pdf');
		expect(data.highlights.other.pdfPath).toBe('Books/older/b.pdf');
		expect(data.highlights.a.rects).toEqual(geometry);
	});
});
