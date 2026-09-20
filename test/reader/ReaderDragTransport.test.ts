import { describe, expect, it } from 'vitest';
import { parseDraggedHighlightRects } from '../../src/reader/ReaderDragTransport';

describe('ReaderDragTransport', () => {
	it('accepts a complete finite normalized selection payload', () => {
		const rects = [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }];
		expect(parseDraggedHighlightRects(JSON.stringify(rects))).toEqual(rects);
	});

	it('rejects malformed, partial, and non-finite payloads', () => {
		for (const value of ['bad json', '{}', '[{"x":0,"y":0,"width":1}]', '[{"x":0,"y":0,"width":1,"height":null}]']) {
			expect(parseDraggedHighlightRects(value)).toBeNull();
		}
	});

	it('accepts exact unit boundaries without tolerance and rejects any out-of-bounds or zero-area rect', () => {
		expect(parseDraggedHighlightRects('[{"x":0,"y":0,"width":1,"height":1}]')).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
		for (const rect of [
			{ x: -Number.EPSILON, y: 0, width: 0.1, height: 0.1 },
			{ x: 0, y: -Number.EPSILON, width: 0.1, height: 0.1 },
			{ x: 0, y: 0, width: 0, height: 0.1 },
			{ x: 0, y: 0, width: 0.1, height: 0 },
			{ x: 0.9, y: 0, width: 0.1000000000000002, height: 0.1 },
			{ x: 0, y: 0.9, width: 0.1, height: 0.1000000000000002 }
		]) expect(parseDraggedHighlightRects(JSON.stringify([rect]))).toBeNull();
	});
});
