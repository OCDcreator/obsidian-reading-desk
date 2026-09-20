import { describe, expect, it } from 'vitest';
import { scaleToFitHeight, scaleToFitWidth } from '../../src/reader/PdfRenderer';

describe('scaleToFitWidth', () => {
	it('uses the actual PDF-column width instead of the enclosing Reader body', () => {
		expect(scaleToFitWidth(1.25, 732, 552)).toBeCloseTo(0.9426, 3);
	});

	it('leaves a scale unchanged when a layout measurement is unusable', () => {
		expect(scaleToFitWidth(1.25, 0, 552)).toBe(1.25);
		expect(scaleToFitWidth(1.25, 732, 0)).toBe(1.25);
	});
});

describe('scaleToFitHeight', () => {
	it('fits the rendered page to the measured PDF host height', () => {
		expect(scaleToFitHeight(1.25, 946, 680)).toBeCloseTo(0.8985, 3);
	});

	it('leaves a scale unchanged when a layout measurement is unusable', () => {
		expect(scaleToFitHeight(1.25, 0, 680)).toBe(1.25);
		expect(scaleToFitHeight(1.25, 946, 0)).toBe(1.25);
	});
});
