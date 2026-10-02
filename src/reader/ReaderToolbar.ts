import { Menu } from 'obsidian';
import { rememberDisclosureTrigger } from '../ui/targets/TargetPanelDisclosure';
import type { PdfHighlight, TargetType } from '../types/contracts';
import { createReaderPalette } from './ReaderPalette';
import { createReaderButton, createReaderPageControl, createReaderZoomControl, type ReaderPageControl, type ReaderZoomControl } from './ReaderPageControl';
import { INVERT_LABELS, type InvertSetting } from './ReaderViewerOptions';

export type ReaderScrollMode = 'continuous' | 'single';

export interface ReaderToolbarOptions {
	page: number;
	pages: number;
	scale: number;
	selectedTarget: TargetType;
	scrollMode: ReaderScrollMode;
	invert: InvertSetting;
	canBack: boolean;
	canForward: boolean;
	onTargetChange: (target: TargetType) => void;
	onZoomOut: () => void;
	onZoomIn: () => void;
	onZoomSet: (scale: number) => void;
	onFitWidth: () => void;
	onFitHeight: () => void;
	onFitPage: () => void;
	onRotate: (delta: 90 | -90) => void;
	onScrollMode: (mode: ReaderScrollMode) => void;
	onInvert: (mode: InvertSetting) => void;
	onBack: () => void;
	onForward: () => void;
	onSearch: () => void;
	onToggleHighlights: () => void;
	onCrop: () => void;
	onToggleTargetPanel: () => void;
	onColor: (color: PdfHighlight['color']) => void;
	onGoToPage: (page: number) => Promise<void>;
	onCopyPage: () => void;
	onCopySelection: () => void;
	onOpenNavigation: () => void;
	onOpenSettings: () => void;
}

export interface ReaderToolbarControls {
	drawerToggle: HTMLButtonElement;
	targetPanelToggle: HTMLButtonElement;
	copyPage: HTMLButtonElement;
	copySelection: HTMLButtonElement;
	pageControl: ReaderPageControl;
	zoomControl: ReaderZoomControl;
	updateHistory(canBack: boolean, canForward: boolean): void;
}

function group(parent: HTMLElement, name: string, label: string): HTMLDivElement {
	return parent.createDiv({ cls: 'rd-reader-toolbar__group', attr: { 'data-rd-toolbar-group': name, 'aria-label': label, role: 'group' } });
}

export interface ReaderToolbarAction {
	label: string;
	run(): void;
	disabled?: boolean;
}

function showMenu(button: HTMLElement, items: ReaderToolbarAction[]): void {
	const menu = new Menu().setUseNativeMenu(false);
	for (const action of items) menu.addItem(item => item.setTitle(action.label).setDisabled(!!action.disabled).onClick(() => {
		if (!action.disabled) action.run();
	}));
	menu.onHide(() => {
		// A newly opened panel owns focus. Return only when focus stayed in the dismissed menu.
		const active = button.ownerDocument.activeElement;
		if (!active || active === button.ownerDocument.body || active.closest('.menu')) button.focus();
	});
	const bounds = button.getBoundingClientRect();
	menu.showAtPosition({ x: bounds.left, y: bounds.bottom }, button.ownerDocument);
}

const actions = (items: Array<[string, () => void]>): ReaderToolbarAction[] => items.map(([label, run]) => ({ label, run }));

/** Checks ancestors too: a whole toolbar group may have collapsed. */
export function toolbarControlHidden(control: HTMLElement): boolean {
	for (let node: HTMLElement | null = control; node; node = node.parentElement) {
		if (node.hidden || getComputedStyle(node).display === 'none') return true;
	}
	return false;
}

function overflow(button: HTMLButtonElement, priority: 'secondary' | 'tight'): HTMLButtonElement {
	button.dataset.rdOverflow = priority;
	return button;
}

export function createReaderToolbar(parent: HTMLElement, options: ReaderToolbarOptions): ReaderToolbarControls {
	const targetGroup = group(parent, 'target', '目标与摘录');
	const target = overflow(createReaderButton(targetGroup, `摘录目标类型：${options.selectedTarget}`, () => showMenu(target, actions([
		['Canvas 目标', () => options.onTargetChange('canvas')],
		['Excalidraw 目标', () => options.onTargetChange('excalidraw')],
		['Markdown 目标', () => options.onTargetChange('markdown')]
	])), { canvas: 'layout-dashboard', excalidraw: 'pencil', markdown: 'file-text' }[options.selectedTarget]), 'tight');
	const toggleTarget = (trigger: HTMLElement): void => {
		rememberDisclosureTrigger(targetPanelToggle, trigger);
		options.onToggleTargetPanel();
	};
	const targetPanelToggle = overflow(createReaderButton(targetGroup, '摘录管理', () => toggleTarget(targetPanelToggle), 'files'), 'secondary');
	createReaderButton(targetGroup, 'PDF 导航', options.onOpenNavigation, 'panel-left');

	const annotationGroup = group(parent, 'annotation', '标注');
	const drawerToggle = overflow(createReaderButton(annotationGroup, '高亮列表', options.onToggleHighlights, 'list'), 'tight');
	const crop = overflow(createReaderButton(annotationGroup, '裁剪', options.onCrop, 'crop'), 'secondary');

	const navigationGroup = group(parent, 'navigation', '定位');
	const back = overflow(createReaderButton(navigationGroup, '返回上一位置', options.onBack, 'arrow-left'), 'secondary');
	const forward = overflow(createReaderButton(navigationGroup, '前往下一位置', options.onForward, 'arrow-right'), 'secondary');
	back.disabled = !options.canBack;
	forward.disabled = !options.canForward;
	createReaderButton(navigationGroup, '全文搜索', options.onSearch, 'search');

	const fitGroup = group(parent, 'fit', '显示适配');
	createReaderButton(fitGroup, '适合宽度', options.onFitWidth, 'move-horizontal');
	createReaderButton(fitGroup, '适合高度', options.onFitHeight, 'move-vertical');
	const displayActions = actions([
		['适合整页', options.onFitPage],
		['向右旋转 90°', () => options.onRotate(90)],
		['向左旋转 90°', () => options.onRotate(-90)],
		[options.scrollMode === 'continuous' ? '切换为单页模式' : '切换为连续滚动', () => options.onScrollMode(options.scrollMode === 'continuous' ? 'single' : 'continuous')],
		...INVERT_LABELS.map(([mode, label]) => [label, () => options.onInvert(mode)] as [string, () => void])
	]);
	const display = overflow(createReaderButton(fitGroup, '显示选项', () => showMenu(display, displayActions), 'sliders-horizontal'), 'tight');

	const pageGroup = group(parent, 'page', '页码');
	const pageControl = createReaderPageControl(pageGroup, { page: options.page, pages: options.pages, goTo: options.onGoToPage });
	const copyPage = overflow(createReaderButton(pageGroup, '复制本页链接', options.onCopyPage, 'link'), 'secondary');
	const copySelection = overflow(createReaderButton(pageGroup, '复制选中文本', options.onCopySelection, 'copy'), 'secondary');

	const zoomGroup = group(parent, 'zoom', '缩放');
	// The whole zoom group collapses behind 更多工具 on narrow leaves.
	zoomGroup.dataset.rdOverflow = 'secondary';
	const zoomControl = createReaderZoomControl(zoomGroup, { scale: options.scale, setScale: options.onZoomSet, zoomOut: options.onZoomOut, zoomIn: options.onZoomIn });

	createReaderPalette(group(parent, 'color', '颜色'), options.onColor);
	const settings = overflow(createReaderButton(parent, '设置', options.onOpenSettings, 'settings'), 'secondary');
	const more = createReaderButton(parent, '更多工具', () => {
		const items: ReaderToolbarAction[] = [];
		const add = (control: HTMLButtonElement, label: string, run: () => void): void => {
			if (toolbarControlHidden(control)) items.push({ label, run, disabled: control.disabled });
		};
		if (toolbarControlHidden(target)) items.push(...actions([
			['Canvas 目标', () => options.onTargetChange('canvas')],
			['Excalidraw 目标', () => options.onTargetChange('excalidraw')],
			['Markdown 目标', () => options.onTargetChange('markdown')]
		]));
		add(targetPanelToggle, '摘录管理', () => toggleTarget(more));
		add(drawerToggle, '高亮列表', options.onToggleHighlights);
		add(crop, '裁剪', options.onCrop);
		add(back, '返回上一位置', options.onBack);
		add(forward, '前往下一位置', options.onForward);
		if (toolbarControlHidden(display)) items.push(...displayActions);
		if (toolbarControlHidden(zoomGroup)) items.push(...actions([
			['缩小', options.onZoomOut], ['放大', options.onZoomIn],
			['缩放 100%', () => options.onZoomSet(1)]
		]));
		add(copyPage, '复制本页链接', options.onCopyPage);
		add(copySelection, '复制选中文本', options.onCopySelection);
		add(settings, '设置', options.onOpenSettings);
		showMenu(more, items);
	}, 'ellipsis');
	more.addClass('rd-reader-toolbar__more');
	return {
		drawerToggle, targetPanelToggle, copyPage, copySelection, pageControl, zoomControl,
		updateHistory(canBack: boolean, canForward: boolean): void {
			back.disabled = !canBack;
			forward.disabled = !canForward;
		}
	};
}
