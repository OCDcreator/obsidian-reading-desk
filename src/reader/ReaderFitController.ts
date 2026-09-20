import type { PdfRenderer } from './PdfRenderer';
import type { PageSurface } from './PageSurface';
import { afterLayout } from './ReaderChromeMetrics';
import { availableFitExtent, FitFrameScheduler, fitInsets, fitScale, observeReaderFit, type ReaderFitMode } from './ReaderFit';

export interface ReaderFitControllerIO {
	pdf(): PdfRenderer;
	surface(): PageSurface | null;
	/** The reader body whose resize triggers refits. */
	body(): HTMLElement | null;
	/** Current anchor page for viewport lookups. */
	page(): number;
	/** Repaints preview bindings after a re-render. */
	rebindPreviews(): void;
	/** Notifies the toolbar zoom input after scale changes. */
	onScaleChanged(scale: number): void;
}

/** Owns fit mode, scale bookkeeping and resize-driven refits for one reader view. */
export class ReaderFitController {
	private mode: ReaderFitMode = 'width';
	private stopTracking: (() => void) | null = null;
	private scheduler: FitFrameScheduler | null = null;
	private lastFittedSize = 0;

	constructor(private readonly io: ReaderFitControllerIO) { }

	getMode(): ReaderFitMode { return this.mode; }

	setManualScale(scale: number): void {
		this.mode = 'manual';
		this.io.pdf().setScale(scale);
		this.io.onScaleChanged(this.io.pdf().getScale());
	}

	async fitTo(mode: ReaderFitMode, force = false): Promise<void> {
		this.mode = mode;
		await this.apply(force);
	}

	/** Re-runs the active fit after surfaces re-rendered at the current scale. */
	async refit(force = false): Promise<void> {
		await this.apply(force);
	}

	startObserver(): void {
		const body = this.io.body();
		if (!body) return;
		this.stopTracking = observeReaderFit(body, () => {
			const surface = this.io.surface();
			const liveBody = this.io.body();
			if (this.mode === 'manual' || !surface?.stage || !liveBody) return 0;
			return availableFitExtent(this.mode, surface.stage, liveBody, fitInsets(surface.stage));
		}, () => {
			const view = body.ownerDocument.defaultView;
			if (view) (this.scheduler ??= new FitFrameScheduler(view)).schedule(() => void this.apply());
		});
	}

	stop(): void {
		this.stopTracking?.();
		this.stopTracking = null;
		this.scheduler?.stop();
		this.scheduler = null;
		this.lastFittedSize = 0;
	}

	private async apply(force = false): Promise<void> {
		const surface = this.io.surface();
		const body = this.io.body();
		if (this.mode === 'manual' || !surface || !body) return;
		const stage = surface.stage;
		const pageEl = surface.hostForPage(this.io.page());
		if (pageEl) await afterLayout(pageEl);
		const viewport = surface.viewportForPage(this.io.page()) ?? this.io.pdf().getRenderedViewport();
		if (!viewport) return;
		const insets = fitInsets(stage);
		const available = availableFitExtent(this.mode, stage, body, insets);
		const nextScale = fitScale(this.mode, this.io.pdf().getScale(), viewport, stage, body, insets);
		if (!force && Math.abs(nextScale - this.io.pdf().getScale()) < 0.005) {
			this.lastFittedSize = available;
			return;
		}
		this.io.pdf().setScale(nextScale);
		this.io.onScaleChanged(this.io.pdf().getScale());
		surface.relayoutPending();
		await surface.render();
		this.io.rebindPreviews();
		await afterLayout(stage);
		this.lastFittedSize = availableFitExtent(this.mode, stage, body, fitInsets(stage));
	}
}
