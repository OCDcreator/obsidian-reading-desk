import { scaleToFitHeight, scaleToFitWidth } from './PdfRenderer';

export type ReaderFitMode = 'width' | 'height' | 'manual';
export interface ReaderBox { clientWidth: number; clientHeight: number; }
export interface ReaderInsets { horizontal: number; vertical: number; }

export function fitInsets(stage: HTMLElement): ReaderInsets {
	const style = stage.ownerDocument.defaultView?.getComputedStyle(stage);
	return {
		horizontal: Number.parseFloat(style?.paddingLeft ?? '0') + Number.parseFloat(style?.paddingRight ?? '0'),
		vertical: Number.parseFloat(style?.paddingTop ?? '0') + Number.parseFloat(style?.paddingBottom ?? '0')
	};
}

/** Uses the bounded Reader body for height, never the document-sized PDF element. */
export function availableFitExtent(mode: Exclude<ReaderFitMode, 'manual'>, stage: ReaderBox, body: ReaderBox, insets: ReaderInsets): number {
	return mode === 'width'
		? Math.max(0, stage.clientWidth - insets.horizontal)
		: Math.max(0, body.clientHeight - insets.vertical);
}

export function fitScale(mode: ReaderFitMode, currentScale: number, rendered: { width: number; height: number }, stage: ReaderBox, body: ReaderBox, insets: ReaderInsets): number {
	if (mode === 'manual') return currentScale;
	const available = availableFitExtent(mode, stage, body, insets);
	return mode === 'width'
		? scaleToFitWidth(currentScale, rendered.width, available)
		: scaleToFitHeight(currentScale, rendered.height, available);
}

export function observeReaderFit(body: HTMLElement, measure: () => number, onResize: () => void): () => void {
	if (typeof ResizeObserver === 'undefined') return () => undefined;
	let lastSize = measure();
	const observer = new ResizeObserver(() => {
		const size = measure();
		if (size < 1 || Math.abs(size - lastSize) < 1) return;
		lastSize = size;
		onResize();
	});
	observer.observe(body);
	return () => observer.disconnect();
}

export class FitFrameScheduler {
	private pending: number | null = null;
	constructor(private readonly view: Window) { }
	schedule(action: () => void): void {
		if (this.pending !== null) return;
		this.pending = this.view.requestAnimationFrame(() => { this.pending = null; action(); });
	}
	stop(): void {
		if (this.pending !== null) this.view.cancelAnimationFrame(this.pending);
		this.pending = null;
	}
}
