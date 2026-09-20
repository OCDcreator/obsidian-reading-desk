import { describe, expect, it } from 'vitest';
import {
	hostThemeDark,
	marginAnchorIconId,
	READING_DESK_MARGIN_ANCHOR_DAY,
	READING_DESK_MARGIN_ANCHOR_NIGHT
} from '../../src/ui/icons/ReadingDeskIcons';

describe('ReadingDesk margin anchor icon', () => {
	it('keeps the page, margin, anchor and excerpt semantics in both variants', () => {
		for (const icon of [READING_DESK_MARGIN_ANCHOR_DAY, READING_DESK_MARGIN_ANCHOR_NIGHT]) {
			expect(icon).toContain('M24 13H62L78 29V87H24Z');
			expect(icon).toContain('<circle');
			expect(icon).toContain('interactive-accent');
			expect(icon).toContain('canvas-color-1');
			expect(icon).toContain('currentColor');
		}
	});
	it('compensates stroke weight optically between day and night', () => {
		expect(READING_DESK_MARGIN_ANCHOR_DAY).toContain('stroke-width="8"');
		expect(READING_DESK_MARGIN_ANCHOR_NIGHT).toContain('stroke-width="7"');
	});
	it('maps theme state to icon ids', () => {
		expect(marginAnchorIconId(true)).toBe('reading-desk-margin-night');
		expect(marginAnchorIconId(false)).toBe('reading-desk-margin-day');
	});
	it('detects dark themes from a document-like object', () => {
		const doc = { body: { classList: { contains: (name: string) => name === 'theme-dark' } }, documentElement: { classList: { contains: () => false } } } as unknown as Document;
		expect(hostThemeDark(doc)).toBe(true);
		const light = { body: { classList: { contains: () => false } }, documentElement: { classList: { contains: () => false } } } as unknown as Document;
		expect(hostThemeDark(light)).toBe(false);
	});
});
