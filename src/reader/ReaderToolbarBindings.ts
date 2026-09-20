import type { PdfHighlight, TargetType } from '../types/contracts';
import { createReaderToolbar, type ReaderToolbarControls } from './ReaderToolbar';
import type { InvertSetting } from './ReaderViewerOptions';
import type { ReaderFitMode } from './ReaderFit';

export type ReaderPaletteColor = PdfHighlight['color'];

/** Everything the toolbar needs from its reader view, as plain accessors. */
export interface ReaderToolbarView {
	page(): number;
	pages(): number;
	scale(): number;
	selectedTarget(): TargetType;
	scrollMode(): 'continuous' | 'single';
	invert(): InvertSetting;
	canBack(): boolean;
	canForward(): boolean;
	onTargetChange(target: TargetType): void;
	applyScale(scale: number): void;
	zoomStep(delta: number): void;
	fitTo(mode: ReaderFitMode): void;
	rotate(delta: 90 | -90): void;
	changeScrollMode(mode: 'continuous' | 'single'): void;
	changeInvert(mode: InvertSetting): void;
	navigateHistory(direction: -1 | 1): void;
	toggleSearch(): void;
	toggleDrawer(): void;
	enterCropMode(): void;
	toggleTargetPanel(): void;
	applyPalette(color: ReaderPaletteColor): void;
	goToPage(page: number): void;
	copyPageLink(): void;
	copySelectedText(): void;
	openNavigation(): void;
	openSettings(): void;
}

/** Builds the reader toolbar from a view contract, keeping ReaderView free of option wiring. */
export function bindReaderToolbar(toolbar: HTMLElement, view: ReaderToolbarView): ReaderToolbarControls {
	return createReaderToolbar(toolbar, {
		page: view.page(),
		pages: view.pages(),
		scale: view.scale(),
		selectedTarget: view.selectedTarget(),
		scrollMode: view.scrollMode(),
		invert: view.invert(),
		canBack: view.canBack(),
		canForward: view.canForward(),
		onTargetChange: target => view.onTargetChange(target),
		onZoomOut: () => view.zoomStep(-0.15),
		onZoomIn: () => view.zoomStep(0.15),
		onZoomSet: scale => view.applyScale(scale),
		onFitWidth: () => view.fitTo('width'),
		onFitHeight: () => view.fitTo('height'),
		onFitPage: () => view.fitTo('page'),
		onRotate: delta => view.rotate(delta),
		onScrollMode: mode => view.changeScrollMode(mode),
		onInvert: mode => view.changeInvert(mode),
		onBack: () => view.navigateHistory(-1),
		onForward: () => view.navigateHistory(1),
		onSearch: () => view.toggleSearch(),
		onToggleHighlights: () => view.toggleDrawer(),
		onCrop: () => view.enterCropMode(),
		onToggleTargetPanel: () => view.toggleTargetPanel(),
		onColor: color => view.applyPalette(color),
		onGoToPage: page => Promise.resolve(view.goToPage(page)),
		onCopyPage: () => view.copyPageLink(),
		onCopySelection: () => view.copySelectedText(),
		onOpenNavigation: () => view.openNavigation(),
		onOpenSettings: () => view.openSettings()
	});
}
