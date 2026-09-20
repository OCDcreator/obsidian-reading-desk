import { describe, expect, it } from 'vitest';
import { availableFitExtent, fitScale } from '../../src/reader/ReaderFit';

describe('ReaderFit page mode', () => {
	const stage = { clientWidth: 600, clientHeight: 800 };
	const body = { clientWidth: 600, clientHeight: 800 };
	const insets = { horizontal: 48, vertical: 48 };

	it('page fit uses the smaller of width and height fits', () => {
		// 800x400 page: width fit is tighter than height fit.
		const scale = fitScale('page', 1, { width: 800, height: 400 }, stage, body, insets);
		expect(scale).toBeCloseTo(552 / 800, 5);
		// 400x900 page: height fit is tighter.
		const tall = fitScale('page', 1, { width: 400, height: 900 }, stage, body, insets);
		expect(tall).toBeCloseTo(752 / 900, 5);
	});

	it('page mode measures the width extent for resize tracking', () => {
		expect(availableFitExtent('page', stage, body, insets)).toBe(552);
	});
});
