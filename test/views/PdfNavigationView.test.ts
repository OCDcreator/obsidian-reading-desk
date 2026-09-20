import { describe, expect, it } from 'vitest';
import { PdfNavigationView } from '../../src/views/PdfNavigationView';

describe('PdfNavigationView identity', () => {
	it('uses the native panel-left SVG icon for the Obsidian sidebar tab', () => {
		const view = Object.create(PdfNavigationView.prototype) as PdfNavigationView;
		expect(view.getIcon()).toBe('panel-left');
	});
});
