import type { PdfRenderer } from './PdfRenderer';
import { type InvertSetting } from './ReaderViewerOptions';
import { applyReaderInvert, observeReaderTheme } from './ReaderThemeInvert';
import type { ViewerSettings } from '../types/contracts';

export interface ReaderDisplayOptionsDeps {
	root(): HTMLElement;
	pdf(): PdfRenderer;
	/** Rebuilds the page surface after rotation or scroll-mode changes. */
	rebuildSurface(): Promise<void>;
	updateViewerSettings(patch: Partial<ViewerSettings>): Promise<void>;
}

/**
 * Owns viewer display state that survives in settings: scroll mode and paper
 * inversion, plus rotation (view-local). Applies the invert data attribute and
 * tracks host theme flips for the 'auto' mode.
 */
export class ReaderDisplayOptions {
	private mode: 'continuous' | 'single' = 'continuous';
	private invert: InvertSetting = 'auto';
	private rotation = 0;
	private stopThemeObserver: (() => void) | null = null;

	constructor(private readonly deps: ReaderDisplayOptionsDeps) { }

	restoreFrom(settings: ViewerSettings): void {
		this.mode = settings.scrollMode;
		this.invert = settings.invertPdf;
	}

	scrollMode(): 'continuous' | 'single' { return this.mode; }
	invertSetting(): InvertSetting { return this.invert; }

	applyInvert(): void {
		applyReaderInvert(this.deps.root(), this.invert);
	}

	startThemeTracking(): void {
		this.stopThemeObserver?.();
		this.stopThemeObserver = observeReaderTheme(this.deps.root(), () => this.applyInvert());
	}

	stop(): void {
		this.stopThemeObserver?.();
		this.stopThemeObserver = null;
	}

	async rotate(delta: 90 | -90): Promise<void> {
		this.rotation = (((this.rotation + delta) % 360) + 360) % 360;
		this.deps.pdf().setRotation(this.rotation);
		await this.deps.rebuildSurface();
	}

	async changeScrollMode(mode: 'continuous' | 'single'): Promise<void> {
		if (mode === this.mode) return;
		this.mode = mode;
		await this.deps.updateViewerSettings({ scrollMode: this.mode, invertPdf: this.invert });
		await this.deps.rebuildSurface();
	}

	async changeInvert(mode: InvertSetting): Promise<void> {
		if (mode === this.invert) return;
		this.invert = mode;
		await this.deps.updateViewerSettings({ scrollMode: this.mode, invertPdf: this.invert });
		this.applyInvert();
	}
}
