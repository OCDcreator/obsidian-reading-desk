import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfNavigationView } from '../../src/views/PdfNavigationView';

afterEach(() => vi.unstubAllGlobals());
describe('PdfNavigationView identity', () => {
	it('restores the saved bookmark tab alongside existing navigation modes', () => {
		vi.stubGlobal('window', { localStorage: { getItem: () => 'bookmarks' } });
		const view = Object.create(PdfNavigationView.prototype) as PdfNavigationView;
		const reader = { setPreferredNavigationMode: vi.fn() };
		(view as unknown as { restorePreferredMode(value: typeof reader): void }).restorePreferredMode(reader);
		expect(reader.setPreferredNavigationMode).toHaveBeenCalledWith('bookmarks');
	});
	it('uses the native panel-left SVG icon for the Obsidian sidebar tab', () => {
		const view = Object.create(PdfNavigationView.prototype) as PdfNavigationView;
		expect(view.getIcon()).toBe('panel-left');
	});
});
