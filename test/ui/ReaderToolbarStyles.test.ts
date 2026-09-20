import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../assets/styles.css', import.meta.url), 'utf8');

describe('Reader toolbar styles', () => {
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
