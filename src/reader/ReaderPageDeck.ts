import type { PageViewport } from 'pdfjs-dist';
import type { PageSurface, PageSurfaceIO, GoToOptions } from './PageSurface';

const DECK_GAP = 16;
const RENDER_CONCURRENCY = 2;
/** Pages kept rendered around the viewport before idle pages are dropped. */
const KEEP_AROUND = 4;
const IO_MARGIN = '160% 0px 160% 0px';

/**
 * Continuous-scroll surface: one virtualized column of real page hosts. Only pages
 * near the viewport hold a rendered canvas; the rest stay as sized placeholders so
 * thousand-page documents scroll without painting everything.
 */
export class ContinuousPageSurface implements PageSurface {
	readonly mode = 'continuous' as const;
	readonly stage: HTMLElement;
	private readonly deck: HTMLElement;
	private readonly io: PageSurfaceIO;
	private readonly hosts = new Map<number, HTMLElement>();
	private readonly rendered = new Set<number>();
	private readonly viewports = new Map<number, PageViewport>();
	private readonly pageTops: number[] = [];
	private pageWidth = 0;
	private pageRatio = 1.414;
	private currentPage: number;
	private intersection: IntersectionObserver | null = null;
	private scrollFrame: number | null = null;
	private readonly pending = new Set<number>();
	private active = 0;
	private destroyed = false;
	private structureReady = false;

	constructor(io: PageSurfaceIO) {
		this.io = io;
		this.currentPage = io.initialPage;
		this.stage = document.createElement('div');
		this.stage.className = 'rd-pdf-stage rd-pdf-stage--deck';
		this.deck = document.createElement('div');
		this.deck.className = 'rd-pdf-deck';
		this.stage.append(this.deck);
	}

	async render(): Promise<void> {
		if (this.destroyed) return;
		await this.measureFirstPage();
		this.ensureStructure();
		this.relayoutPending();
		this.observe();
		this.currentPage = this.clampPage(this.currentPage);
		this.stage.scrollTop = this.pageTops[this.currentPage - 1] ?? 0;
		this.requestRender(this.currentPage);
		this.io.callbacks.onPageChange(this.currentPage);
	}

	async goToPage(page: number, options?: GoToOptions): Promise<void> {
		const next = this.clampPage(page);
		if (!this.structureReady) {
			this.currentPage = next;
			return;
		}
		const top = this.pageTops[next - 1] ?? 0;
		const view = this.stage.ownerDocument.defaultView;
		this.stage.scrollTo({ top, behavior: options?.smooth && view ? 'smooth' : 'auto' });
		this.currentPage = next;
		this.requestRender(next);
		this.io.callbacks.onPageChange(next);
	}

	setPage(page: number): void {
		this.currentPage = this.clampPage(page);
		this.requestRender(this.currentPage);
	}

	getPage(): number { return this.currentPage; }

	viewportForPage(page: number): PageViewport | null { return this.viewports.get(page) ?? null; }

	hostForPage(page: number): HTMLElement | null { return this.hosts.get(page) ?? null; }

	repaintHighlights(): void {
		const highlights = this.io.callbacks.getHighlights();
		for (const page of this.rendered) {
			const host = this.hosts.get(page);
			const viewport = this.viewports.get(page);
			if (!host || !viewport) continue;
			this.io.pdf.paintHighlights(host, viewport, highlights.filter(highlight => highlight.page === page - 1));
		}
	}

	scrollToHighlight(highlightId: string): boolean {
		for (const page of this.rendered) {
			const host = this.hosts.get(page);
			const mark = host?.querySelector<HTMLElement>(`[data-highlight-id="${highlightId}"]`);
			if (!mark) continue;
			mark.scrollIntoView({ block: 'center' });
			return true;
		}
		return false;
	}

	relayoutPending(): void {
		if (!this.structureReady) return;
		this.syncPlaceholderSizes();
	}

	destroy(): void {
		this.destroyed = true;
		this.intersection?.disconnect();
		this.intersection = null;
		if (this.scrollFrame !== null) {
			this.stage.ownerDocument.defaultView?.cancelAnimationFrame(this.scrollFrame);
			this.scrollFrame = null;
		}
		this.pending.clear();
		for (const host of this.hosts.values()) host.remove();
		this.hosts.clear();
		this.rendered.clear();
		this.viewports.clear();
		this.stage.remove();
	}

	private clampPage(page: number): number {
		return Math.max(1, Math.min(Math.max(this.io.pageCount, 1), Math.round(page)));
	}

	private async measureFirstPage(): Promise<void> {
		if (this.pageWidth > 0) return;
		try {
			const viewport = await this.io.pdf.pageViewport(1);
			this.pageRatio = viewport.height / Math.max(1, viewport.width);
			this.pageWidth = viewport.width;
		} catch {
			this.pageWidth = 0;
		}
	}

	private ensureStructure(): void {
		if (this.structureReady) return;
		this.deck.replaceChildren();
		this.hosts.clear();
		this.rendered.clear();
		this.viewports.clear();
		for (let page = 1; page <= this.io.pageCount; page += 1) {
			const host = document.createElement('div');
			host.className = 'rd-pdf-page-host rd-pdf-page-host--placeholder';
			host.dataset.page = String(page);
			host.setAttribute('role', 'region');
			host.setAttribute('aria-label', `PDF 第 ${page} 页`);
			this.deck.append(host);
			this.hosts.set(page, host);
		}
		this.structureReady = true;
		this.syncPlaceholderSizes();
		this.attachScrollTracking();
	}

	private targetPageWidth(): number {
		if (this.pageWidth > 0) return this.pageWidth;
		const style = this.stage.ownerDocument.defaultView?.getComputedStyle(this.stage);
		const padding = Number.parseFloat(style?.paddingLeft ?? '24') + Number.parseFloat(style?.paddingRight ?? '24');
		return Math.max(120, this.stage.clientWidth - padding);
	}

	private syncPlaceholderSizes(): void {
		const width = this.targetPageWidth();
		let top = 0;
		this.pageTops.length = 0;
		for (let page = 1; page <= this.io.pageCount; page += 1) {
			this.pageTops.push(top);
			const host = this.hosts.get(page);
			if (host && !this.rendered.has(page)) {
				host.style.width = `${width}px`;
				host.style.height = `${Math.round(width * this.pageRatio)}px`;
			}
			top += Math.round(width * this.pageRatio) + DECK_GAP;
		}
	}

	private attachScrollTracking(): void {
		this.stage.addEventListener('scroll', () => this.schedulePageCheck(), { passive: true });
	}

	private schedulePageCheck(): void {
		if (this.scrollFrame !== null || this.destroyed) return;
		const view = this.stage.ownerDocument.defaultView;
		if (!view) return;
		this.scrollFrame = view.requestAnimationFrame(() => {
			this.scrollFrame = null;
			const page = this.nearestPageToCenter();
			if (page && page !== this.currentPage) {
				this.currentPage = page;
				this.requestRender(page);
				this.io.callbacks.onPageChange(page);
			}
		});
	}

	private nearestPageToCenter(): number | null {
		if (!this.pageTops.length) return null;
		const center = this.stage.scrollTop + this.stage.clientHeight / 2;
		let low = 0;
		let high = this.pageTops.length - 1;
		while (low < high) {
			const mid = (low + high + 1) >> 1;
			if (this.pageTops[mid] <= center) low = mid;
			else high = mid - 1;
		}
		return low + 1;
	}

	private observe(): void {
		if (this.intersection || typeof IntersectionObserver === 'undefined') return;
		this.intersection = new IntersectionObserver(entries => {
			for (const entry of entries) {
				const page = Number((entry.target as HTMLElement).dataset.page ?? '0');
				if (!page) continue;
				if (entry.isIntersecting) this.requestRender(page);
				else this.maybeRelease(page);
			}
		}, { root: this.stage, rootMargin: IO_MARGIN });
		for (const host of this.hosts.values()) this.intersection.observe(host);
	}

	private requestRender(page: number): void {
		if (this.destroyed || this.rendered.has(page) || this.pending.has(page)) return;
		if (page < 1 || page > this.io.pageCount) return;
		this.pending.add(page);
		void this.pump();
	}

	private async pump(): Promise<void> {
		while (this.active < RENDER_CONCURRENCY && this.pending.size > 0 && !this.destroyed) {
			// Render the pending page nearest the viewport first so scrolling feels instant.
			let selected: number | null = null;
			for (const candidate of this.pending) {
				if (selected === null || Math.abs(candidate - this.currentPage) < Math.abs(selected - this.currentPage)) selected = candidate;
			}
			if (selected === null) return;
			this.pending.delete(selected);
			this.active += 1;
			void this.renderHost(selected).finally(() => { this.active -= 1; void this.pump(); });
		}
	}

	private async renderHost(page: number): Promise<void> {
		const host = this.hosts.get(page);
		if (!host || this.destroyed) return;
		host.classList.add('is-rendering');
		const result = await this.io.pdf.renderPage(page, host, this.io.callbacks.getHighlights());
		host.classList.remove('is-rendering');
		if (!result || this.destroyed) return;
		const previous = host.offsetHeight;
		this.rendered.add(page);
		this.viewports.set(page, result.viewport);
		host.classList.remove('rd-pdf-page-host--placeholder');
		this.shiftSubsequentTops(page, result.viewport.height - previous);
		this.io.callbacks.onTextSignal(page, result.textSelectable);
	}

	private maybeRelease(page: number): void {
		if (!this.rendered.has(page)) return;
		if (Math.abs(page - this.currentPage) <= KEEP_AROUND) return;
		const host = this.hosts.get(page);
		if (!host) return;
		this.rendered.delete(page);
		this.viewports.delete(page);
		const width = this.targetPageWidth();
		const estimatedHeight = Math.round(width * this.pageRatio);
		const previous = host.offsetHeight;
		host.replaceChildren();
		host.classList.add('rd-pdf-page-host--placeholder');
		host.style.width = `${width}px`;
		host.style.height = `${estimatedHeight}px`;
		this.shiftSubsequentTops(page, estimatedHeight - previous);
	}

	private shiftSubsequentTops(page: number, delta: number): void {
		if (!delta) return;
		for (let index = page; index < this.pageTops.length; index += 1) this.pageTops[index] += delta;
	}
}
