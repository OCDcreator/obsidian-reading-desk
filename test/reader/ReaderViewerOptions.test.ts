import { describe, expect, it } from 'vitest';
import { effectiveInvert } from '../../src/reader/ReaderViewerOptions';

describe('effectiveInvert', () => {
	it('follows the host theme in auto mode', () => {
		expect(effectiveInvert('auto', true)).toBe(true);
		expect(effectiveInvert('auto', false)).toBe(false);
	});
	it('honors explicit overrides over the theme', () => {
		expect(effectiveInvert('on', false)).toBe(true);
		expect(effectiveInvert('off', true)).toBe(false);
	});
});
