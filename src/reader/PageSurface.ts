import type { PageViewport } from 'pdfjs-dist';
import type { PdfHighlight } from '../types/contracts';
import type { PdfRenderer } from './PdfRenderer';

export interface PageSurfaceCallbacks {
	/** Resolves the highlights that should be painted for the current document. */
	getHighlights(): PdfHighlight[];
	/** The visually current page changed through scrolling or navigation. */
	onPageChange(page: number): void;
	/** A finished page render; selectable=false flags a scanned (text-less) page. */
	onTextSignal(page: number, selectable: boolean): void;
}

export interface GoToOptions {
	smooth?: boolean;
}

export interface PageSurface {
	readonly mode: 'single' | 'continuous';
	readonly stage: HTMLElement;
	/** Full refresh at the renderer's current scale/rotation. */
	render(): Promise<void>;
	/** Navigates so that the given page is the visible anchor. */
	goToPage(page: number, options?: GoToOptions): Promise<void>;
	/** Tracks an external current-page change (e.g. link jump) without forcing scroll. */
	setPage(page: number): void;
	getPage(): number;
	viewportForPage(page: number): PageViewport | null;
	hostForPage(page: number): HTMLElement | null;
	/** Repaints annotation layers on rendered pages. */
	repaintHighlights(): void;
	/** Scrolls a highlight mark into view; returns false when it is not rendered. */
	scrollToHighlight(highlightId: string): boolean;
	/** Called after scale/rotation changed but before render() to resize placeholders. */
	relayoutPending(): void;
	destroy(): void;
}

export interface PageSurfaceIO {
	pdf: PdfRenderer;
	pageCount: number;
	initialPage: number;
	callbacks: PageSurfaceCallbacks;
}

/**
 * Single-page surface: exactly one rendered page host with per-page scroll memory,
 * so recolor/delete/scale refreshes no longer dump the reader back to page top.
 */
export class SinglePageSurface implements PageSurface {
	readonly mode = 'single' as const;
	readonly stage: HTMLElement;
	private readonly host: HTMLElement;
	private readonly io: PageSurfaceIO;
	private page: number;
	private viewport: PageViewport | null = null;
	private readonly scrollMemory = new Map<number, { top: number; left: number }>();

	constructor(io: PageSurfaceIO) {
		this.io = io;
		this.page = io.initialPage;
		this.stage = document.createElement('div');
		this.stage.className = 'rd-pdf-stage';
		this.host = document.createElement('div');
		this.host.className = 'rd-pdf-page-host';
		this.host.dataset.page = String(this.page);
		this.host.setAttribute('role', 'region');
		this.stage.append(this.host);
	}

	async render(): Promise<void> {
		this.rememberScroll();
		this.host.dataset.page = String(this.page);
		this.host.setAttribute('aria-label', `PDF 第 ${this.page} 页`);
		const result = await this.io.pdf.renderPage(this.page, this.host, this.io.callbacks.getHighlights());
		if (!result) return;
		this.viewport = result.viewport;
		this.io.callbacks.onTextSignal(this.page, result.textSelectable);
		this.restoreScroll();
		this.io.callbacks.onPageChange(this.page);
	}

	async goToPage(page: number, options?: GoToOptions): Promise<void> {
		const next = Math.max(1, Math.min(Math.max(this.io.pageCount, 1), Math.round(page)));
		if (next === this.page) return;
		this.rememberScroll();
		this.page = next;
		await this.render();
		if (options?.smooth === false) return;
	}

	setPage(page: number): void {
		this.page = Math.max(1, Math.min(Math.max(this.io.pageCount, 1), Math.round(page)));
	}

	getPage(): number { return this.page; }

	viewportForPage(page: number): PageViewport | null {
		return page === this.page ? this.viewport : null;
	}

	hostForPage(page: number): HTMLElement | null {
		return page === this.page ? this.host : null;
	}

	repaintHighlights(): void {
		if (!this.viewport) return;
		this.io.pdf.paintHighlights(this.host, this.viewport, this.pageHighlights());
	}

	scrollToHighlight(highlightId: string): boolean {
		const mark = this.host.querySelector<HTMLElement>(`[data-highlight-id="${highlightId}"]`);
		if (!mark) return false;
		mark.scrollIntoView({ block: 'center' });
		return true;
	}

	relayoutPending(): void { /* The single host resizes itself on render. */ }

	destroy(): void {
		this.scrollMemory.clear();
		this.stage.remove();
	}

	private pageHighlights(): PdfHighlight[] {
		return this.io.callbacks.getHighlights().filter(highlight => highlight.page === this.page - 1);
	}

	private rememberScroll(): void {
		this.scrollMemory.set(this.page, { top: this.stage.scrollTop, left: this.stage.scrollLeft });
	}

	private restoreScroll(): void {
		const saved = this.scrollMemory.get(this.page);
		this.stage.scrollTop = saved?.top ?? 0;
		this.stage.scrollLeft = saved?.left ?? 0;
	}
}
