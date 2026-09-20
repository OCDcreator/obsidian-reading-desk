import { describe, expect, it } from 'vitest';
import { availableFitExtent, fitScale } from '../../src/reader/ReaderFit';

describe('Reader fit geometry', () => {
	it('fits height from the bounded Reader body instead of a content-expanded stage', () => {
		const body = { clientWidth: 900, clientHeight: 720 };
		const contentExpandedStage = { clientWidth: 660, clientHeight: 1400 };
		const insets = { horizontal: 48, vertical: 48 };
		expect(availableFitExtent('height', contentExpandedStage, body, insets)).toBe(672);
		expect(fitScale('height', 1.25, { width: 800, height: 1200 }, contentExpandedStage, body, insets)).toBeCloseTo(0.7, 3);
	});

	it('recomputes height scale after a Reader reflow without changing fit mode', () => {
		const stage = { clientWidth: 600, clientHeight: 1300 };
		const insets = { horizontal: 32, vertical: 32 };
		const first = fitScale('height', 1, { width: 700, height: 1000 }, stage, { clientWidth: 800, clientHeight: 700 }, insets);
		const second = fitScale('height', first, { width: 700 * first, height: 1000 * first }, stage, { clientWidth: 700, clientHeight: 560 }, insets);
		expect(first).toBeCloseTo(0.668, 3);
		expect(second).toBeCloseTo(0.528, 3);
	});
});
