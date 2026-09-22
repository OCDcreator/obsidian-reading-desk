import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../assets/styles.css', import.meta.url), 'utf8');

describe('Reader thumbnail layout styles', () => {
	it('mirrors the host PDF sidebar halo: 8px transparent border with 4px radius', () => {
		const rule = styles.match(/\.rd-reader-thumbnail\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('border: 8px solid transparent');
		expect(rule).toContain('border-radius: 4px');
		expect(rule).toContain('position: relative');
	});

	it('overlays the page label badge from data-page-label like native thumbnails', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail::after\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('content: attr(data-page-label)');
		expect(rule).toContain('background: var(--background-secondary');
		expect(rule).toContain('border-radius: 3px');
		expect(rule).toContain('font-size: var(--font-ui-smaller');
	});

	it('keeps thumbnail papers at the native width with the host thumbnail shadow', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail canvas\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('width: 148px');
		expect(rule).toContain('max-width: 100%');
		expect(rule).toContain('height: auto');
		expect(rule).toContain('box-shadow: var(--pdf-thumbnail-shadow');
	});

	it('wraps papers in centered rows by shrink-wrapping list items', () => {
		const list = styles.match(/\.rd-reader-thumbnails\s*\{([^}]*)\}/)?.[1] ?? '';
		const item = styles.match(/\.rd-reader-thumbnails > li\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(list).toContain('flex-wrap: wrap');
		expect(list).toContain('justify-content: center');
		expect(item).toContain('width: fit-content');
	});

	it('flags pending papers with a dashed placeholder until rendered', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail canvas:not\(\[data-rendered\]\)\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('border: 1px dashed');
	});

	it('highlights the current page through the host halo instead of accent chrome', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail\[aria-current='page'\]\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('border-color: var(--background-modifier-hover');
	});

	it('neutralizes theme button chrome on host navigation buttons', () => {
		const thumb = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail\s*\{([^}]*)\}/)?.[1] ?? '';
		const tab = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-navigation__tab:not\(\[aria-selected='true'\]\)\s*\{([^}]*)\}/)?.[1] ?? '';
		const outline = styles.match(/\.reading-desk-pdf-navigation-host \.rd-outline-row\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(thumb).toContain('background: transparent');
		expect(thumb).toContain('border-color: transparent');
		expect(thumb).toContain('box-shadow: none');
		expect(tab).toContain('background: transparent');
		expect(tab).toContain('border-color: transparent');
		expect(outline).toContain('background: transparent');
		expect(outline).toContain('box-shadow: none');
	});

	it('marks the current outline section with the host nav-item active tokens', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-outline-node\[aria-current='location'\] > \.rd-outline-row\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('color: var(--nav-item-color-active');
		expect(rule).toContain('background: var(--nav-item-background-active');
		expect(rule).toContain('font-weight: 600');
		const page = styles.match(/\[aria-current='location'\] \.rd-reader-outline__page\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(page).toContain('color: inherit');
	});
});
