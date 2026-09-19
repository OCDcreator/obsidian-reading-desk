import { describe, expect, it } from 'vitest';
import {
	clampCropRect,
	denormalizeCropRect,
	isCropRectLargeEnough,
	normalizeCropPoint,
	normalizeCropRect,
	type CropPageBounds
} from '../../../src/ui/crop/CropGeometry';

const page: CropPageBounds = { left: 100, top: 50, width: 400, height: 800 };

describe('CropGeometry', () => {
	it('stores a reverse pointer drag as normalized page geometry', () => {
		const rect = normalizeCropRect({ x: 420, y: 650 }, { x: 180, y: 250 }, page);

		expect(rect).toMatchObject({ x: 0.2, y: 0.25, height: 0.5 });
		expect(rect.width).toBeCloseTo(0.6);
	});

	it('clamps pointer positions outside the rendered page before persisting', () => {
		const rect = normalizeCropRect({ x: 10, y: -30 }, { x: 900, y: 1000 }, page);

		expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
		expect(normalizeCropPoint({ x: 700, y: 300 }, page)).toEqual({ x: 1, y: 0.3125 });
	});

	it('maps the durable rectangle back to a differently located rendered page', () => {
		const rendered = denormalizeCropRect(
			{ x: 0.25, y: 0.1, width: 0.5, height: 0.4 },
			{ left: 12, top: 18, width: 1000, height: 500 }
		);

		expect(rendered).toEqual({ left: 262, top: 68, width: 500, height: 200 });
	});

	it('rejects visually accidental tiny selections while accepting an 8px square', () => {
		const eightPixels = { x: 0.1, y: 0.1, width: 8 / page.width, height: 8 / page.height };
		const tiny = { x: 0.1, y: 0.1, width: 7 / page.width, height: 8 / page.height };

		expect(isCropRectLargeEnough(eightPixels, page)).toBe(true);
		expect(isCropRectLargeEnough(tiny, page)).toBe(false);
	});

	it('keeps malformed persistent rectangles inside normalized PDF space', () => {
		expect(clampCropRect({ x: -0.2, y: 0.8, width: 2, height: 1 })).toEqual({
			x: 0,
			y: 0.8,
			width: 1,
			height: 0.19999999999999996
		});
	});
});
