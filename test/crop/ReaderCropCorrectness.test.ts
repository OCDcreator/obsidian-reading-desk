import { describe, expect, it } from 'vitest';
import { freezeCropRequest } from '../../src/crop/ReaderCropController';
import { denormalizeRect } from '../../src/reader/PdfSelectionGeometry';
import { testViewport } from '../reader/TestViewport';

describe('frozen crop geometry', () => {
	it.each([0, 90, 180, 270])('keeps explicit source page and round trips displayed selection at %i degrees', rotation => {
		const viewport = testViewport(rotation, 2);
		const request = freezeCropRequest({ page: 6, rect: { x: 0.2, y: 0.3, width: 0.4, height: 0.2 }, target: 'canvas' }, viewport);
		expect(request.page).toBe(6); expect(request.rotation).toBe(rotation); expect(request.viewport).not.toBe(viewport);
		const box = denormalizeRect(request.rect, request.viewport);
		expect(box.left).toBeCloseTo(viewport.width * 0.2); expect(box.top).toBeCloseTo(viewport.height * 0.3);
		expect(box.width).toBeCloseTo(viewport.width * 0.4); expect(box.height).toBeCloseTo(viewport.height * 0.2);
		viewport.rotation = 180; viewport.width = 1;
		expect(request.rotation).toBe(rotation); expect(request.viewport.rotation).toBe(rotation);
	});
	it('quarter turn stores PDF-space coordinates rather than screen fractions', () => {
		const request = freezeCropRequest({ page: 0, rect: { x: 0.2, y: 0.3, width: 0.4, height: 0.2 }, target: 'image' }, testViewport(90));
		expect(request.rect.x).toBeCloseTo(0.3); expect(request.rect.y).toBeCloseTo(0.4);
		expect(request.rect.width).toBeCloseTo(0.2); expect(request.rect.height).toBeCloseTo(0.4);
	});
	it('rejects invalid crop before any raster allocation', () => {
		expect(() => freezeCropRequest({ page: 0, rect: { x: 0.9, y: 0, width: 0.2, height: 1 }, target: 'canvas' }, testViewport())).toThrow('无效');
	});
});
