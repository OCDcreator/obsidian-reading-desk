import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../../assets/styles.css', import.meta.url), 'utf8');

describe('HighlightList styles', () => {
	it('resets semantic ol indentation without removing its list semantics', () => {
		expect(styles).toMatch(/\.rd-highlight-list__items\s*\{[^}]*list-style:\s*none;[^}]*margin:\s*0;[^}]*padding:\s*0;[^}]*\}/s);
	});

	it('wraps long excerpt buttons at full content-column width without truncation', () => {
		const rule = styles.match(/\.rd-highlight-drawer\s+\.rd-highlight-row__jump\s*\{([^}]*)\}/s)?.[1] ?? '';
		expect(rule).toContain('width: 100%');
		expect(rule).toContain('height: auto');
		expect(rule).toContain('min-height: 30px');
		expect(rule).toContain('white-space: normal');
		expect(rule).toContain('line-height: 1.5');
		expect(rule).toContain('overflow-wrap: anywhere');
		expect(rule).not.toMatch(/text-overflow|line-clamp|nowrap/);
	});
});
