import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../../assets/styles.css', import.meta.url), 'utf8');

function rule(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return styles.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
}

describe('Shelf layout contract (ADR 0007)', () => {
	it('centers content in a 1368px frame over a 24px workspace', () => {
		expect(styles).toMatch(/^\.rd-shelf \{ padding: 24px 24px 72px; container-type: inline-size; \}$/m);
		expect(rule('.rd-shelf-frame')).toContain('max-width: 1368px');
		expect(rule('.rd-shelf-frame')).toContain('margin: 0 auto');
	});

	it('breaks on the shelf container, not the host window', () => {
		expect(styles).toContain('@container (max-width: 1180px)');
		expect(styles).toContain('@container (max-width: 880px)');
		expect(styles).not.toContain('@media (max-width: 1180px)');
		expect(rule('.rd-shelf-search')).toContain('max-width: 440px');
	});

	it('keeps the 25/20/16/14/12 title ladder', () => {
		expect(rule('.rd-shelf-heading')).toContain('font-size: 25px');
		expect(rule('.rd-section-heading-main')).toContain('font-size: 20px');
		expect(rule('.rd-continue-title')).toContain('font-size: 16px');
		expect(rule('.rd-shelf-subtitle')).toContain('font-size: 14px');
		expect(rule('.rd-book-meta')).toContain('font-size: 12px');
	});

	it('cards: full-bleed 0.7 cover with the only functional shadow, flat square card', () => {
		expect(rule('.rd-book-cover')).toContain('aspect-ratio: 0.7');
		expect(rule('.rd-book-cover')).toContain('box-shadow: 0 8px 22px var(--rd-elevation)');
		expect(rule('.rd-shelf-card')).toContain('grid-template-rows: auto minmax(0, 1fr)');
		expect(rule('.rd-shelf-card')).not.toContain('box-shadow');
		expect(rule('.rd-shelf-card')).not.toContain('border-radius');
		expect(rule('.rd-continue-card:hover, .rd-shelf-card:hover')).toContain('border-color: var(--background-modifier-border-hover');
		expect(rule('.rd-continue-card:focus-visible, .rd-shelf-card:focus-visible')).toContain('outline: 2px solid var(--rd-accent)');
	});

	it('fixed info slots: two-line clamped title, one-line author, 3px progress with right value', () => {
		expect(rule('.rd-book-title')).toContain('-webkit-line-clamp: 2');
		expect(rule('.rd-book-title')).toContain('min-height: 2.6em');
		expect(rule('.rd-book-author')).toContain('text-overflow: ellipsis');
		expect(rule('.rd-progress')).toContain('height: 3px');
		expect(rule('.rd-progress-value')).toContain('font-variant-numeric: tabular-nums');
		expect(rule('.rd-progress-row')).toContain('grid-template-columns: minmax(0, 1fr) auto');
	});

	it('category badge is a host-sized pill on the cover corner', () => {
		const badge = rule('.rd-cover-category-badge');
		expect(badge).toContain('font-size: var(--font-ui-smaller');
		expect(badge).toContain('border-radius: 999px');
		expect(badge).toContain('left: 10px');
		expect(badge).toContain('top: 10px');
	});

	it('grids: auto-fill 184px library wall, three-card rail, four-column compact grid', () => {
		expect(rule('.rd-shelf-grid')).toContain('repeat(auto-fill, minmax(184px, 1fr))');
		expect(rule('.rd-continue-reading-list')).toContain('repeat(3, minmax(0, 1fr))');
		expect(rule('.rd-continue-reading-list')).toContain('gap: 16px');
		expect(rule('.rd-continue-card')).toContain('grid-template-columns: 88px minmax(0, 1fr)');
		expect(rule('.rd-book-cover--continue')).toContain('min-height: 118px');
		expect(rule('.rd-compact-grid')).toContain('repeat(4, minmax(0, 1fr))');
	});

	it('ledger: four summary cells, 42px cover, dense bordered table', () => {
		expect(rule('.rd-ledger-summary')).toContain('repeat(4, minmax(0, 1fr))');
		expect(rule('.rd-book-cover--ledger')).toContain('width: 42px');
		expect(rule('.rd-book-cover--ledger')).toContain('box-shadow: none');
		expect(rule('.rd-library-table td, .rd-library-table th')).toContain('padding: 10px 12px');
	});

	it('navigation: 224px sticky rail with inset accent selection and a 172px focus cover', () => {
		expect(rule('.rd-shelf-navigation')).toContain('grid-template-columns: 224px minmax(0, 1fr)');
		expect(rule('.rd-nav-sidebar')).toContain('position: sticky');
		expect(rule('.rd-nav-category.is-selected')).toContain('box-shadow: inset 2px 0 var(--rd-accent)');
		expect(rule('.rd-nav-focus')).toContain('grid-template-columns: 172px minmax(0, 1fr)');
	});

	it('chips and toolbar keep accent-line selection without saturated fills', () => {
		const chip = rule('.rd-category-chip.is-selected');
		expect(chip).toContain('border-color: var(--rd-accent)');
		expect(chip).not.toContain('background: var(--rd-accent)');
		const viewSwitch = rule('.rd-shelf .rd-view-switch-button');
		expect(viewSwitch).toContain('background: transparent');
		expect(viewSwitch).toContain('box-shadow: none');
	});

	it('host button penetration: transparent shelf buttons clear all three chrome layers', () => {
		const sectionLink = rule('.rd-shelf .rd-section-link');
		expect(sectionLink).toContain('background: transparent');
		expect(sectionLink).toContain('border-color: transparent');
		expect(sectionLink).toContain('box-shadow: none');
		const navCategory = rule('.rd-shelf .rd-nav-category');
		expect(navCategory).toContain('background: transparent');
		expect(navCategory).toContain('border-color: transparent');
		expect(navCategory).toContain('box-shadow: none');
	});

	it('detached modal and menus restate their own tokens and control chrome', () => {
		const tokens = rule('.rd-category-modal, .rd-action-menu');
		expect(tokens).toContain('--rd-line: var(--background-modifier-border');
		expect(tokens).toContain('--rd-accent: var(--interactive-accent');
		expect(rule('.rd-category-modal .rd-button')).toContain('background: var(--rd-surface)');
		expect(rule('.rd-category-modal .rd-button')).toContain('box-shadow: none');
	});
});
