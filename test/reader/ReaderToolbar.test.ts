import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReaderToolbar, type ReaderToolbarOptions } from '../../src/reader/ReaderToolbar';
import { readerToolbarOverflow } from '../../src/reader/ReaderResponsive';
import { TargetPanelDisclosure } from '../../src/ui/targets/TargetPanelDisclosure';
import { installDom, UiDocument, UiNode } from '../ui/shelf/ShelfTestDom';
const state = vi.hoisted(() => ({ menus: [] as Array<{ items: Array<{ title: string; disabled: boolean; run: () => void }>; hide?: () => void }> }));
vi.mock('obsidian', () => ({
	setIcon: vi.fn(),
	Menu: class {
		private menu = { items: [] as Array<{ title: string; disabled: boolean; run: () => void }>, hide: undefined as (() => void) | undefined };
		constructor() { state.menus.push(this.menu); }
		setUseNativeMenu(): this { return this; }
		addItem(build: (item: unknown) => void): this {
			const action = { title: '', disabled: false, run: () => undefined }; const item = { setTitle: (title: string) => { action.title = title; return item; }, setDisabled: (disabled: boolean) => { action.disabled = disabled; return item; }, onClick: (run: () => void) => { action.run = run; return item; } }; build(item); this.menu.items.push(action); return this;
		}
		onHide(hide: () => void): this { this.menu.hide = hide; return this; }
		showAtPosition(): void { /* Rendering stays outside this menu contract. */ }
	}
}));
let document: UiDocument;
beforeEach(() => { document = installDom(vi.stubGlobal); state.menus.length = 0; });
afterEach(() => vi.unstubAllGlobals());
const options = (): ReaderToolbarOptions => ({ page: 1, pages: 5, scale: 1, selectedTarget: 'canvas', scrollMode: 'continuous', invert: 'auto', canBack: false, canForward: true, onTargetChange: vi.fn(), onZoomOut: vi.fn(), onZoomIn: vi.fn(), onZoomSet: vi.fn(), onFitWidth: vi.fn(), onFitHeight: vi.fn(), onFitPage: vi.fn(), onRotate: vi.fn(), onScrollMode: vi.fn(), onInvert: vi.fn(), onBack: vi.fn(), onForward: vi.fn(), onSearch: vi.fn(), onToggleHighlights: vi.fn(), onCrop: vi.fn(), onToggleTargetPanel: vi.fn(), onColor: vi.fn(), onGoToPage: async () => undefined, onCopyPage: vi.fn(), onCopySelection: vi.fn(), onOpenNavigation: vi.fn(), onOpenSettings: vi.fn() });
function collapse(toolbar: UiNode, width: number): void {
	const overflow = readerToolbarOverflow(width);
	for (const control of toolbar.querySelectorAll('[data-rd-overflow]')) {
		const priority = control.dataset.rdOverflow;
		control.style.display = overflow === 'tight' || (overflow === 'secondary' && priority === 'secondary') ? 'none' : 'block';
	}
}
describe('responsive reader toolbar actions', () => {
	it.each([480, 640, 900, 1024])('keeps hidden actions available and history disabled consistent at %ipx', width => {
		const toolbar = document.body.createDiv(); const callbacks = options(); const controls = createReaderToolbar(toolbar as unknown as HTMLElement, callbacks); collapse(toolbar, width);
		const more = toolbar.querySelector('[aria-label="更多工具"]'); more?.click(); const menu = state.menus[state.menus.length - 1];
		const titles = menu.items.map(item => item.title);
		if (width === 480) expect(titles).toEqual(expect.arrayContaining(['适合整页', '向右旋转 90°', '向左旋转 90°', '切换为单页模式', '夜间反相：跟随主题', '夜间反相：开', '夜间反相：关']));
		if (width <= 980) {
			expect(titles).toContain('设置');
			const back = menu.items.find(item => item.title === '返回上一位置'); expect(back?.disabled).toBe(true); back?.run(); expect(callbacks.onBack).not.toHaveBeenCalled();
			controls.updateHistory(true, false); more?.click(); const updated = state.menus[state.menus.length - 1]; expect(updated.items.find(item => item.title === '返回上一位置')?.disabled).toBe(false); expect(updated.items.find(item => item.title === '前往下一位置')?.disabled).toBe(true);
		} else expect(menu.items).toHaveLength(0);
	});
	it('records the visible More entry before opening the target overlay and restores it', () => {
		const toolbar = document.body.createDiv(); const callbacks = options(); const shared: { disclosure?: TargetPanelDisclosure } = {}; const close = document.body.createEl('button');
		callbacks.onToggleTargetPanel = () => shared.disclosure?.open(document.body.createDiv() as unknown as HTMLElement, close as unknown as HTMLElement);
		const controls = createReaderToolbar(toolbar as unknown as HTMLElement, callbacks); const disclosure = new TargetPanelDisclosure(controls.targetPanelToggle, 'target'); shared.disclosure = disclosure; collapse(toolbar, 480);
		const more = toolbar.querySelector('[aria-label="更多工具"]'); more?.click(); state.menus[state.menus.length - 1].items.find(item => item.title === '摘录管理')?.run();
		expect(document.activeElement).toBe(close); disclosure.close(() => undefined); expect(document.activeElement).toBe(more);
	});
	it('finds a hidden ancestor so collapsed-group copy actions cannot disappear', () => {
		const toolbar = document.body.createDiv(); createReaderToolbar(toolbar as unknown as HTMLElement, options());
		const copy = toolbar.querySelector('[aria-label="复制选中文本"]'); if (copy?.parentElement) copy.parentElement.style.display = 'none'; toolbar.querySelector('[aria-label="更多工具"]')?.click();
		expect(state.menus[state.menus.length - 1].items.map(item => item.title)).toContain('复制选中文本');
	});
});
