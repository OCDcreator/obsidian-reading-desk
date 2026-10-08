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

describe('PdfNavigationView reader lifecycle', () => {
	interface FakeInternals {
		navigationRoot: unknown;
		activeReader: unknown;
		findReader: () => unknown;
		app: unknown;
		render(): void;
	}

	function fakeHost(texts: string[]) {
		return {
			replaceChildren: vi.fn(),
			createEl: vi.fn((_tag: string, options: { text: string }) => {
				texts.push(options.text);
				return {};
			})
		};
	}

	function fakeReader() {
		return {
			getViewType: () => 'reading-desk-reader',
			attachNavigation: vi.fn(),
			setPreferredNavigationMode: vi.fn()
		};
	}

	it('drops a closed reader and shows the empty state instead of resurrecting its navigation', () => {
		const view = Object.create(PdfNavigationView.prototype) as PdfNavigationView;
		const texts: string[] = [];
		const deadReader = fakeReader();
		const internals = view as unknown as FakeInternals;
		internals.navigationRoot = fakeHost(texts);
		internals.activeReader = deadReader;
		internals.findReader = () => null;
		internals.app = { workspace: { getLeavesOfType: () => [] } };
		internals.render();
		expect(deadReader.attachNavigation).not.toHaveBeenCalled();
		expect(texts.join(' ')).toContain('打开 Reading Desk 阅读器后显示 PDF 导航。');
	});

	it('keeps attaching a reader whose leaf is still in the workspace', () => {
		const view = Object.create(PdfNavigationView.prototype) as PdfNavigationView;
		const texts: string[] = [];
		const reader = fakeReader();
		const internals = view as unknown as FakeInternals;
		internals.navigationRoot = fakeHost(texts);
		internals.activeReader = reader;
		internals.findReader = () => null;
		internals.app = { workspace: { getLeavesOfType: () => [{ view: reader }] } };
		internals.render();
		expect(reader.attachNavigation).toHaveBeenCalled();
		expect(texts).toHaveLength(0);
	});
});
