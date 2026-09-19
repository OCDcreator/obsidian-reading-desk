import { describe, expect, it } from 'vitest';
import { denormalizeRect, normalizeClientRect } from '../../src/reader/PdfSelectionGeometry';

const viewport = {
	width: 200,
	height: 100,
	viewBox: [0, 0, 200, 100] as [number, number, number, number],
	convertToPdfPoint: (x: number, y: number): [number, number] => [x, y],
	convertToViewportPoint: (x: number, y: number): [number, number] => [x, y]
};

describe('PdfSelectionGeometry', () => {
	it('stores a selection as normalized PDF coordinates, not screen pixels', () => {
		const rect = normalizeClientRect(rectangle(120, 60, 40, 10), rectangle(100, 50, 200, 100), viewport);
		expect(rect).toMatchObject({ x: 0.1, y: 0.8 });
		expect(rect.width).toBeCloseTo(0.2);
		expect(rect.height).toBeCloseTo(0.1);
	});

	it('round trips a normalized rect through a different scale', () => {
		const rendered = denormalizeRect({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, {
			...viewport,
			width: 400,
			height: 200,
			convertToViewportPoint: (x: number, y: number): [number, number] => [x * 2, y * 2]
		});
		expect(rendered.left).toBeCloseTo(40);
		expect(rendered.top).toBeCloseTo(160);
		expect(rendered.width).toBeCloseTo(80);
		expect(rendered.height).toBeCloseTo(20);
	});

	it('uses page viewBox rather than scaled CSS dimensions', () => {
		const scaled = {
			width: 1200,
			height: 1600,
			viewBox: [20, 30, 620, 830] as [number, number, number, number],
			convertToPdfPoint: (x: number, y: number): [number, number] => [20 + x / 2, 830 - y / 2],
			convertToViewportPoint: (x: number, y: number): [number, number] => [(x - 20) * 2, (830 - y) * 2]
		};
		const stored = normalizeClientRect(rectangle(120, 200, 120, 40), rectangle(0, 0, 1200, 1600), scaled);
		expect(stored).toMatchObject({ x: 0.1, y: 0.125, width: 0.1 });
		expect(stored.height).toBeCloseTo(0.025);
		const unscaled = denormalizeRect(stored, { ...scaled, width: 600, height: 800, convertToViewportPoint: (x, y) => [x - 20, 830 - y] });
		expect(unscaled).toEqual({ left: 60, top: 100, width: 60, height: 20 });
	});
});

function rectangle(left: number, top: number, width: number, height: number): DOMRect {
	return { left, top, right: left + width, bottom: top + height, width, height } as DOMRect;
}
