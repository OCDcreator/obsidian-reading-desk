import { describe, expect, it, vi } from 'vitest';
import { selectionAnchor, selectionRects, writeReaderExcerpt, type ExcerptWriteInput } from '../../src/reader/ReaderExcerptWriter';
import { recolorReaderExcerpt } from '../../src/reader/ReaderExcerptController';
import { ReaderTestDocument, TestRange } from './ReaderTestDom';
import { testViewport } from './TestViewport';

function fixture() {
	const doc = new ReaderTestDocument(); const host = doc.createElement('div'); host.className = 'rd-pdf-page-host'; host.dataset.page = '7'; doc.body.append(host);
	const text = host.createEl('span'); const range = new TestRange(); range.startContainer = text; range.endContainer = text;
	range.rects = [{ left: 20, top: 20, right: 60, bottom: 30, width: 40, height: 10 }];
	const viewport = testViewport(90);
	const workflow = vi.fn(async (_target, highlight) => ({ target: { type: 'markdown', path: 'target.md', objectId: highlight.id } }));
	const surface = { hostForPage: (page: number) => page === 7 ? host : null, viewportForPage: () => viewport };
	const input = { text: 'wrong toolbar text', type: 'markdown', color: 'moss', surface,
		fallbackPage: 2, viewportFallback: testViewport(0), pdfPath: 'source.pdf', continuous: true,
		createTarget: vi.fn(async () => ({ type: 'markdown', path: 'target.md' })), selectedTarget: 'markdown', selectedTargetPath: '',
		targets: { writeAndSaveExcerpt: workflow, writeExcerpt: vi.fn() }, annotations: { save: vi.fn() },
		chapterPathFor: vi.fn(() => []), syncOutline: vi.fn(), onTargetResolved: vi.fn()
	} as unknown as ExcerptWriteInput;
	return { host, text, range: range as unknown as Range, input, workflow, surface, viewport };
}
describe('single-page excerpt correctness', () => {
	it('uses Range page 7 and its text/rotation while visible page is 2', async () => {
		const f = fixture();
		expect(selectionAnchor(f.input.surface, 2, f.range)?.page).toBe(7);
		const result = await writeReaderExcerpt(f.input, f.range);
		expect(result?.highlight).toMatchObject({ page: 6, rotation: 90, text: 'actual selected text' });
		expect(f.workflow).toHaveBeenCalledOnce(); expect(f.input.annotations.save).not.toHaveBeenCalled();
	});
	it('freezes printed page label while keeping physical page and geometry', async () => {
		const f = fixture(); const result = await writeReaderExcerpt({ ...f.input, pageLabelFor: page => page === 7 ? 'iv' : 'wrong' }, f.range);
		expect(result?.highlight).toMatchObject({ page: 6, pageLabel: 'iv', rotation: 90 }); expect(result?.highlight.rects).not.toHaveLength(0);
	});
	it('copies the rendered source fingerprint and preserves the drag snapshot across later source changes', async () => {
		const f = fixture(); const fingerprint = { mtime: 10, size: 100 };
		const result = await writeReaderExcerpt({ ...f.input, sourceFingerprint: fingerprint }, f.range); fingerprint.mtime = 20;
		expect(result?.highlight.sourceFingerprint).toEqual({ mtime: 10, size: 100 });
		const dragged = await writeReaderExcerpt({ ...f.input, sourceFingerprint: { mtime: 30, size: 300 }, frozenSelection: { pdfPath: 'source.pdf', page: 7, rotation: 90, rects: [{ x: 0.1, y: 0.2, width: 0.1, height: 0.1 }], text: 'drag', sourceFingerprint: { mtime: 10, size: 100 } } }, null);
		expect(dragged?.highlight.sourceFingerprint).toEqual({ mtime: 10, size: 100 });
	});
	it('rejects cross-page endpoints before creating a target', async () => {
		const f = fixture(); const another = f.host.ownerDocument.createElement('div'); another.className = 'rd-pdf-page-host';
		(f.range as unknown as TestRange).endContainer = another.createEl('span');
		await expect(writeReaderExcerpt(f.input, f.range)).rejects.toThrow('跨页');
		expect(f.input.createTarget).not.toHaveBeenCalled(); expect(f.workflow).not.toHaveBeenCalled();
	});
	it.each([
		{ left: -4, top: 20, right: 60, bottom: 30 }, { left: 20, top: 20, right: 204, bottom: 30 },
		{ left: 20, top: -4, right: 60, bottom: 30 }, { left: 20, top: 20, right: 60, bottom: 104 }
	])('rejects any overflow edge %j', rect => {
		const f = fixture(); (f.range as unknown as TestRange).rects = [{ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }];
		expect(() => selectionRects(f.range, f.host as unknown as HTMLElement, f.viewport)).toThrow('边界');
	});
	it('workflow failure is returned without an independent annotation save', async () => {
		const f = fixture(); f.workflow.mockRejectedValueOnce(new Error('disk full'));
		await expect(writeReaderExcerpt(f.input, f.range)).rejects.toThrow('disk full');
		expect(f.input.annotations.save).not.toHaveBeenCalled(); expect(f.input.onTargetResolved).not.toHaveBeenCalled();
	});
	it('frozen drag retains original page instead of a later visible page', async () => {
		const f = fixture();
		const result = await writeReaderExcerpt({ ...f.input, frozenSelection: { pdfPath: 'source.pdf', page: 9, rotation: 270, rects: [{ x: 0.2, y: 0.3, width: 0.1, height: 0.1 }], text: 'frozen text' } }, null);
		expect(result?.highlight).toMatchObject({ page: 8, rotation: 270, text: 'frozen text' });
	});
	it('recolor uses durable workflow and preserves card metadata without premature recolor', async () => {
		const original = { id: 'h1', color: 'moss', target: { type: 'canvas', path: 't.canvas' } };
		const store = { get: () => original, recolor: vi.fn(), excerptCard: () => ({ title: 'hand title', folded: true }) };
		const targets = { writeAndSaveExcerpt: vi.fn(async () => { throw new Error('target unavailable'); }) };
		await expect(recolorReaderExcerpt(store as never, targets as never, 'h1', 'apricot' as never)).rejects.toThrow('target unavailable');
		expect(targets.writeAndSaveExcerpt).toHaveBeenCalledWith(original.target, expect.objectContaining({ color: 'apricot' }), store, { title: 'hand title', folded: true });
		expect(store.recolor).not.toHaveBeenCalled(); expect(original.color).toBe('moss');
	});
});
