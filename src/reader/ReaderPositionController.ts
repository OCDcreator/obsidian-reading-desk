import type { PageSurface } from './PageSurface';
import type { PdfRenderer } from './PdfRenderer';
import type { PdfHighlight } from '../types/contracts';
import { ReaderHistory, type ReaderLocation } from './ReaderHistory';
import { abortableReaderTask, isReaderAbort, throwIfReaderAborted } from './ReaderCancellation';
import { ReaderLinkPreview } from './ReaderLinkPreview';
import type { PdfLinkDestination } from './PdfLinks';

export interface ReaderPositionIO {
	surface(): PageSurface | null;
	pdf(): PdfRenderer;
	page(): number;
	pageCount(): number;
	setPage(page: number): void;
	history: ReaderHistory;
	changed(page: number): void;
	showTarget(path: string, objectId?: string): Promise<void>;
	onError(message: string): void;
}
export class ReaderPositionController {
	private request: AbortController | null = null;
	private navigating = false;
	private epoch = 0;
	private readonly preview = new ReaderLinkPreview();
	private readonly bound = new WeakSet<HTMLElement>();
	constructor(private readonly io: ReaderPositionIO) { }
	cancel(): void { this.epoch += 1; this.request?.abort(); this.request = null; this.navigating = false; this.preview.close(); }
	capture(): ReaderLocation {
		const page = this.io.page(); const surface = this.io.surface(); const host = surface?.hostForPage(page);
		if (!surface || !host) return { page };
		const bounds = host.getBoundingClientRect(); const stage = surface.stage.getBoundingClientRect();
		return { page, x: bounds.width > 0 ? Math.max(0, Math.min(1, (stage.left - bounds.left) / bounds.width)) : 0,
			y: bounds.height > 0 ? Math.max(0, Math.min(1, (stage.top - bounds.top) / bounds.height)) : 0 };
	}
	recordPageChanged(): void { if (!this.navigating) this.io.history.replace(this.capture()); }
	private restore(location: ReaderLocation, surface: PageSurface): void {
		const host = surface.hostForPage(location.page); if (!host) return;
		const bounds = host.getBoundingClientRect(); const stage = surface.stage.getBoundingClientRect();
		surface.stage.scrollTop += bounds.top - stage.top + (location.y ?? 0) * bounds.height;
		surface.stage.scrollLeft += bounds.left - stage.left + (location.x ?? 0) * bounds.width;
	}
	async goTo(page: number, options: { jump?: boolean; smooth?: boolean; signal?: AbortSignal; location?: ReaderLocation } = {}): Promise<HTMLElement | null> {
		throwIfReaderAborted(options.signal);
		const surface = this.io.surface(); if (!surface) return null;
		this.epoch += 1; this.preview.close();
		this.request?.abort(); const request = new AbortController(); this.request = request;
		const abort = (): void => request.abort(); options.signal?.addEventListener('abort', abort, { once: true });
		const bounded = Math.max(1, Math.min(this.io.pageCount(), Number.isFinite(page) ? Math.round(page) : this.io.page()));
		if (options.jump) { this.io.history.replace(this.capture()); this.io.history.push(options.location ?? { page: bounded }); }
		this.navigating = true; this.io.setPage(bounded);
		try {
			await abortableReaderTask(surface.goToPage(bounded, { smooth: options.smooth, signal: request.signal }), request.signal);
			const host = await abortableReaderTask(surface.ensurePageRendered(bounded, request.signal), request.signal);
			throwIfReaderAborted(request.signal);
			if (surface !== this.io.surface()) return null;
			if (options.location) this.restore(options.location, surface);
			this.io.changed(bounded);
			this.io.history.replace(this.capture());
			return host;
		} finally {
			options.signal?.removeEventListener('abort', abort);
			if (this.request === request) this.navigating = false;
		}
	}
	async focusHighlight(highlight: PdfHighlight, openTarget = true): Promise<void> {
		const epoch = this.epoch + 1;
		const host = await this.goTo(highlight.page + 1, { jump: true, smooth: false });
		if (!host || epoch !== this.epoch || this.request?.signal.aborted) return;
		const mark = Array.from(host.querySelectorAll<HTMLElement>('[data-highlight-id]')).find(node => node.dataset.highlightId === highlight.id);
		mark?.scrollIntoView({ block: 'center', behavior: 'auto' }); this.io.history.replace(this.capture());
		if (openTarget && highlight.target) await this.io.showTarget(highlight.target.path, highlight.target.objectId);
	}
	async history(direction: -1 | 1): Promise<void> {
		this.io.history.replace(this.capture());
		const location = direction === -1 ? this.io.history.back() : this.io.history.forward();
		if (location) await this.goTo(location.page, { smooth: false, location });
	}
	async destination(destination: PdfLinkDestination): Promise<void> {
		this.epoch += 1;
		this.request?.abort();
		const request = new AbortController(); this.request = request;
		const pdf = this.io.pdf();
		const viewport = await abortableReaderTask(pdf.pageViewport(destination.page), request.signal);
		throwIfReaderAborted(request.signal);
		if (this.io.pdf() !== pdf) return;
		const point = destination.x === undefined && destination.y === undefined ? [0, 0] : viewport.convertToViewportPoint(destination.x ?? viewport.viewBox[0], destination.y ?? viewport.viewBox[3]);
		await this.goTo(destination.page, { jump: true, smooth: false, location: { page: destination.page, x: Math.max(0, Math.min(1, point[0] / viewport.width)), y: Math.max(0, Math.min(1, point[1] / viewport.height)) } });
	}
	bindLinks(stage: HTMLElement): void {
		if (this.bound.has(stage)) return; this.bound.add(stage);
		stage.addEventListener('click', event => {
			const control = (event.target as Element).closest<HTMLElement>('[data-pdf-link], [data-pdf-preview]');
			if (!control || !stage.contains(control)) return;
			event.preventDefault(); event.stopPropagation();
			try {
				const destination = JSON.parse(control.dataset.pdfLink ?? control.dataset.pdfPreview ?? '') as PdfLinkDestination;
				if (!Number.isInteger(destination.page) || destination.page < 1 || destination.page > this.io.pageCount()) return;
				const action = event.shiftKey || control.dataset.pdfPreview ? this.preview.show(stage.parentElement ?? stage, this.io.pdf(), destination, control, () => this.destination(destination)) : this.destination(destination);
				void action.catch(error => { if (!isReaderAbort(error)) this.io.onError('PDF 链接无法载入，请重试。'); });
			} catch { /* Ignore malformed controls. */ }
		});
	}
}
