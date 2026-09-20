import { describe, expect, it } from 'vitest';
import { readerDensity } from '../../src/reader/ReaderResponsive';

describe('readerDensity', () => {
	it('uses Reader container width for stable wide, medium and narrow layouts', () => {
		expect(readerDensity(1200)).toBe('wide');
		expect(readerDensity(820)).toBe('medium');
		expect(readerDensity(620)).toBe('narrow');
	});

	it('treats exact breakpoint widths deterministically', () => {
		expect(readerDensity(980)).toBe('wide');
		expect(readerDensity(680)).toBe('medium');
		expect(readerDensity(679)).toBe('narrow');
	});
});
