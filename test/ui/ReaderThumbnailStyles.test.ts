import fs from 'fs';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(new URL('../../assets/styles.css', import.meta.url), 'utf8');

describe('Reader thumbnail layout styles', () => {
	it('restores intrinsic thumbnail button geometry over Obsidian global button chrome', () => {
		const rule = styles.match(/\.rd-reader \.rd-reader-thumbnail\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('height: auto');
		expect(rule).toContain('min-height: 0');
		expect(rule).toContain('overflow: hidden');
		expect(rule).toContain('background: var(--rd-surface)');
	});

	it('keeps thumbnail previews inside their item box with a stable intrinsic width cap', () => {
		const rule = styles.match(/\.rd-reader \.rd-reader-thumbnail canvas\s*\{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toContain('width: 100%');
		expect(rule).toContain('max-width: 136px');
		expect(rule).toContain('height: auto');
	});
});
