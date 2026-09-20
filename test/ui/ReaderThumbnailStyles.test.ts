import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../assets/styles.css', import.meta.url), 'utf8');

describe('Reader thumbnail layout styles', () => {
	it('restores intrinsic thumbnail button geometry over Obsidian global button chrome', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('height: auto');
		expect(rule).toContain('min-height: 0');
		expect(rule).toContain('overflow: hidden');
		expect(rule).toContain('background: var(--rd-surface)');
	});

	it('keeps thumbnail previews inside their item box with a stable intrinsic width cap', () => {
		const rule = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail canvas\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('width: 100%');
		expect(rule).toContain('max-width: 120px');
		expect(rule).toContain('height: auto');
	});
	it('keeps passive sidebar rows quiet under the host button theme', () => {
		const thumbnails = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-thumbnail\s*\{([^}]*)\}/)?.[1] ?? '';
		const outline = styles.match(/\.reading-desk-pdf-navigation-host \.rd-reader-outline__item\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(thumbnails).toContain('border-color: transparent');
		expect(outline).toContain('background: transparent');
		expect(outline).toContain('border-color: transparent');
	});
});
