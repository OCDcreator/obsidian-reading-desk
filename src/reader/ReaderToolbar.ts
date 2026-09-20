import type { PdfHighlight, TargetType } from '../types/contracts';
import { createReaderPalette } from './ReaderPalette';
import { createReaderButton, createReaderPageControl } from './ReaderPageControl';

interface ReaderToolbarOptions {
	page: number;
	pages: number;
	selectedTarget: TargetType;
	onTargetChange: (target: TargetType) => void;
	onZoomOut: () => void;
	onZoomIn: () => void;
	onFitWidth: () => void;
	onFitHeight: () => void;
	onToggleHighlights: () => void;
	onCrop: () => void;
	onToggleTargetPanel: () => void;
	onColor: (color: PdfHighlight['color']) => void;
	onGoToPage: (page: number) => Promise<void>;
	onCopyPage: () => void;
	onOpenNavigation: () => void;
}

export interface ReaderToolbarControls {
	drawerToggle: HTMLButtonElement;
	targetPanelToggle: HTMLButtonElement;
	copyPage: HTMLButtonElement;
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

	const fitGroup = group(parent, 'fit', '显示适配');
	const zoom = overflow(createReaderButton(fitGroup, '缩放', () => showMenu(zoom, [['缩小', options.onZoomOut], ['放大', options.onZoomIn]]), 'zoom-in'), 'secondary');
	createReaderButton(fitGroup, '适合宽度', options.onFitWidth, 'move-horizontal');
	createReaderButton(fitGroup, '适合高度', options.onFitHeight, 'move-vertical');

	const pageGroup = group(parent, 'page', '页码');
	createReaderPageControl(pageGroup, { page: options.page, pages: options.pages, goTo: options.onGoToPage });
	const copyPage = overflow(createReaderButton(pageGroup, '复制本页链接', options.onCopyPage, 'link'), 'secondary');
	createReaderPalette(group(parent, 'color', '颜色'), options.onColor);
	const more = createReaderButton(parent, '更多工具', () => {
		const isHidden = (button: HTMLButtonElement): boolean => getComputedStyle(button).display === 'none';
		const items: Array<[string, () => void]> = [];
		if (isHidden(target)) items.push(['Canvas 目标', () => options.onTargetChange('canvas')], ['Excalidraw 目标', () => options.onTargetChange('excalidraw')], ['Markdown 目标', () => options.onTargetChange('markdown')]);
		if (isHidden(targetPanelToggle)) items.push(['摘录管理', options.onToggleTargetPanel]);
		if (isHidden(drawerToggle)) items.push(['高亮列表', options.onToggleHighlights]);
		if (isHidden(crop)) items.push(['裁剪', options.onCrop]);
		if (isHidden(zoom)) items.push(['缩小', options.onZoomOut], ['放大', options.onZoomIn]);
		if (isHidden(copyPage)) items.push(['复制本页链接', options.onCopyPage]);
		showMenu(more, items);
	}, 'ellipsis');
	more.addClass('rd-reader-toolbar__more');
	return { drawerToggle, targetPanelToggle, copyPage };
}
import { Menu } from 'obsidian';
