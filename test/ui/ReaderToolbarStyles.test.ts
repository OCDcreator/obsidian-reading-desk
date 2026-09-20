import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../assets/styles.css', import.meta.url), 'utf8');

describe('Reader toolbar styles', () => {
	it('separates semantic groups with restrained whitespace instead of vertical rules', () => {
		const toolbar = styles.match(/\.rd-reader-toolbar\s*\{([^}]*)\}/)?.[1] ?? '';
		const group = styles.match(/\.rd-reader-toolbar__group\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(toolbar).toContain('gap: 8px');
		expect(group).toContain('gap: 4px');
		expect(group).not.toMatch(/border-(?:left|right)/);
		expect(group).not.toMatch(/padding-(?:left|right)/);
	});
	it('keeps the page total muted while matching the page input typography', () => {
		const rule = styles.match(/\.rd-page-count\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('align-self: center');
		expect(rule).toContain('color: var(--rd-ink-muted)');
		expect(rule).toContain('font: inherit');
		expect(rule).toContain('white-space: nowrap');
		expect(rule).not.toMatch(/font-size\s*:/);
		expect(styles).toMatch(/\.rd-page-count[^{}]*tabular-nums|[^{}]*\.rd-page-count[^{}]*\{[^}]*tabular-nums/s);
	});
});
