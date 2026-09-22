import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../assets/styles.css', import.meta.url), 'utf8');

/** Body of the first rule whose selector line starts with `selector`, alone or in a list. */
function ruleBody(selector: string): string {
	const at = styles.indexOf(`\n${selector}`);
	if (at === -1) return '';
	const after = styles[at + 1 + selector.length];
	if (after !== ' ' && after !== ',') return '';
	const open = styles.indexOf('{', at);
	const close = styles.indexOf('}', open);
	return styles.slice(open + 1, close);
}

describe('Outline tree and bullet styles', () => {
	it('keeps one 30px row height so dots, connectors and chevrons share a center line', () => {
		const row = ruleBody('.rd-outline-row');
		expect(row).toContain('height: 30px');
		expect(row).toContain('min-width: 0');
		expect(row).toContain('position: relative');
	});

	it('indents each level by 16px with the logical padding-inline-start property', () => {
		const group = ruleBody('.rd-outline-group');
		expect(group).toContain('padding-inline-start: 16px');
		expect(group).toContain('position: relative');
		expect(styles).not.toContain('padding-left: 20px');
	});

	it('aligns the 5px bullet dot to the 1px rail center at every depth', () => {
		const gutter = ruleBody('.rd-reader-outline--bullet .rd-outline-gutter');
		const dot = ruleBody('.rd-reader-outline--bullet .rd-outline-gutter::before');
		const stem = ruleBody('.rd-outline-group::before');
		const segment = ruleBody('.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node::before');
		const last = ruleBody('.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node:last-child::before');
		const tick = ruleBody('.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node > .rd-outline-row::after');
		expect(gutter).toContain('padding-inline-start: 10px');
		expect(dot).toContain('width: 5px');
		expect(dot).toContain('height: 5px');
		expect(dot).toContain('border-radius: 50%');
		expect(stem).toContain('inset-inline-start: 12px');
		expect(stem).toContain('top: -15px');
		expect(stem).toContain('height: 15px');
		expect(segment).toContain('inset-inline-start: -4px');
		expect(segment).toContain('top: 0; bottom: 0');
		expect(last).toContain('height: 15px');
		expect(tick).toContain('top: 15px');
		expect(tick).toContain('width: 14px');
	});

	it('ends each branch line at the final child instead of running into the next group', () => {
		const lastTree = ruleBody('.rd-reader-outline--tree .rd-outline-group > .rd-outline-node:last-child::before');
		const lastBullet = ruleBody('.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node:last-child::before');
		expect(lastTree).toContain('bottom: auto');
		expect(lastTree).toContain('height: 15px');
		expect(lastBullet).toContain('bottom: auto');
	});

	it('sizes the chevron to 15px inside a 24px gutter and honors reduced motion', () => {
		const gutter = ruleBody('.rd-outline-gutter');
		const chevron = ruleBody('.rd-outline-gutter svg');
		expect(gutter).toContain('width: 24px');
		expect(gutter).toContain('height: 24px');
		expect(chevron).toContain('width: 15px');
		expect(chevron).toContain('height: 15px');
		expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
		expect(styles).toContain('transition: none');
	});

	it('marks the current bullet node with accent dot plus row state, never the dot alone', () => {
		const dot = ruleBody('.rd-reader-outline--bullet .rd-outline-node[aria-current=\'location\'] .rd-outline-gutter::before');
		expect(dot).toContain('background: var(--rd-accent');
		expect(styles).toContain('font-weight: 600');
	});

	it('keeps outline connectors and markers pointer-transparent so clicks reach rows and chevrons', () => {
		for (const selector of [
			'.rd-outline-group::before',
			'.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node::before',
			'.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node:last-child::before',
			'.rd-reader-outline--bullet .rd-outline-group > .rd-outline-node > .rd-outline-row::after',
			'.rd-reader-outline--bullet .rd-outline-gutter::before'
		]) {
			expect(ruleBody(selector), selector).toContain('pointer-events: none');
		}
	});
});
