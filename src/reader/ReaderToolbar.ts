import { Menu } from 'obsidian';
import type { PdfHighlight, TargetType } from '../types/contracts';
import { createReaderPalette } from './ReaderPalette';
import { createReaderButton, createReaderPageControl, createReaderZoomControl, type ReaderPageControl, type ReaderZoomControl } from './ReaderPageControl';
import { INVERT_LABELS, type InvertSetting } from './ReaderViewerOptions';

export type ReaderScrollMode = 'continuous' | 'single';

interface ReaderToolbarOptions {
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

function showMenu(button: HTMLElement, items: Array<[string, () => void]>): void {
	const menu = new Menu().setUseNativeMenu(false);
	for (const [label, action] of items) menu.addItem(item => item.setTitle(label).onClick(action));
	const bounds = button.getBoundingClientRect();
	menu.showAtPosition({ x: bounds.left, y: bounds.bottom }, button.ownerDocument);
}

function overflow(button: HTMLButtonElement, priority: 'secondary' | 'tight'): HTMLButtonElement {
	button.dataset.rdOverflow = priority;
	return button;
}

export function createReaderToolbar(parent: HTMLElement, options: ReaderToolbarOptions): ReaderToolbarControls {
	const targetGroup = group(parent, 'target', '目标与摘录');
	const target = overflow(createReaderButton(targetGroup, `摘录目标类型：${options.selectedTarget}`, () => showMenu(target, [
		['Canvas 目标', () => options.onTargetChange('canvas')],
		['Excalidraw 目标', () => options.onTargetChange('excalidraw')],
		['Markdown 目标', () => options.onTargetChange('markdown')]
	]), { canvas: 'layout-dashboard', excalidraw: 'pencil', markdown: 'file-text' }[options.selectedTarget]), 'tight');
	const targetPanelToggle = overflow(createReaderButton(targetGroup, '摘录管理', options.onToggleTargetPanel, 'files'), 'secondary');
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
	const display = overflow(createReaderButton(fitGroup, '显示选项', () => showMenu(display, [
		['适合整页', options.onFitPage],
		['向右旋转 90°', () => options.onRotate(90)],
		['向左旋转 90°', () => options.onRotate(-90)],
		[options.scrollMode === 'continuous' ? '切换为单页模式' : '切换为连续滚动', () => options.onScrollMode(options.scrollMode === 'continuous' ? 'single' : 'continuous')],
		...INVERT_LABELS.filter(([mode]) => mode !== options.invert).map(([mode, label]) => [label, () => options.onInvert(mode)] as [string, () => void])
	]), 'sliders-horizontal'), 'tight');

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
		const isHidden = (button: HTMLButtonElement): boolean => getComputedStyle(button).display === 'none';
		const items: Array<[string, () => void]> = [];
		if (isHidden(target)) items.push(['Canvas 目标', () => options.onTargetChange('canvas')], ['Excalidraw 目标', () => options.onTargetChange('excalidraw')], ['Markdown 目标', () => options.onTargetChange('markdown')]);
		if (isHidden(targetPanelToggle)) items.push(['摘录管理', options.onToggleTargetPanel]);
		if (isHidden(drawerToggle)) items.push(['高亮列表', options.onToggleHighlights]);
		if (isHidden(crop)) items.push(['裁剪', options.onCrop]);
		if (isHidden(back)) items.push(['返回上一位置', options.onBack]);
		if (isHidden(forward)) items.push(['前往下一位置', options.onForward]);
		if (getComputedStyle(zoomGroup).display === 'none') items.push(['缩小', options.onZoomOut], ['放大', options.onZoomIn]);
		if (isHidden(copyPage)) items.push(['复制本页链接', options.onCopyPage]);
		if (isHidden(copySelection)) items.push(['复制选中文本', options.onCopySelection]);
		if (isHidden(settings)) items.push(['设置', options.onOpenSettings]);
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
