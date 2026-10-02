import { isReaderAbort } from './ReaderCancellation';

type ThumbnailRender = (canvas: HTMLCanvasElement, page: number, signal: AbortSignal) => Promise<boolean | void> | void;
interface ThumbnailEntry {
	page: number;
	visible: boolean;
	request: AbortController | null;
	render: ThumbnailRender;
	release(canvas: HTMLCanvasElement): void;
}
/** Keep observing: leaving the sidebar window releases pixels; returning renders again. */
export class ThumbnailObserverLifecycle {
	private observer: IntersectionObserver | null = null;
	private disposed = false;
	private active = 0;
	private readonly pending = new Set<HTMLCanvasElement>();
	private readonly entries = new Map<HTMLCanvasElement, ThumbnailEntry>();

	constructor(private readonly createObserver: (callback: IntersectionObserverCallback, root: HTMLElement) => IntersectionObserver) { }

	observe(canvas: HTMLCanvasElement, page: number, root: HTMLElement, render: ThumbnailRender, release: (canvas: HTMLCanvasElement) => void = () => undefined): void {
		if (this.disposed) return;
		this.entries.set(canvas, { page, visible: false, request: null, render, release });
		this.observer ??= this.createObserver(entries => {
			if (this.disposed) return;
			for (const entry of [...entries].sort((left, right) => Number(left.isIntersecting) - Number(right.isIntersecting))) {
				const target = entry.target as HTMLCanvasElement;
				const state = this.entries.get(target); if (!state) continue;
				state.visible = entry.isIntersecting;
				if (state.visible) this.requestRender(target);
				else this.release(target, state);
			}
		}, root);
		canvas.dataset.page = String(page);
		this.observer.observe(canvas);
	}

	private requestRender(canvas: HTMLCanvasElement): void {
		const state = this.entries.get(canvas);
		if (!state || !state.visible || state.request || canvas.dataset.rendered === '1') return;
		this.pending.add(canvas); this.pump();
	}
	private pump(): void {
		for (const canvas of this.pending) {
			if (this.active >= 2 || this.disposed) return;
			this.pending.delete(canvas);
			const state = this.entries.get(canvas); if (!state?.visible) continue;
			this.active += 1; this.render(canvas, state);
		}
	}
	private render(canvas: HTMLCanvasElement, state: ThumbnailEntry): void {
		if (state.request || canvas.dataset.rendered === '1') return;
		const request = new AbortController(); state.request = request;
		delete canvas.dataset.renderError;
		Promise.resolve().then(() => state.render(canvas, state.page, request.signal)).then(rendered => {
			if (!this.disposed && state.visible && !request.signal.aborted && rendered !== false) canvas.dataset.rendered = '1';
		}).catch(error => {
			if (!this.disposed && state.visible && !request.signal.aborted && !isReaderAbort(error)) {
				canvas.dataset.renderError = '1'; canvas.title = '预览未载入，移出后返回可重试。';
			}
		}).finally(() => {
			if (state.request === request) state.request = null;
			this.active -= 1;
			if (!this.disposed && state.visible && request.signal.aborted) this.requestRender(canvas);
			this.pump();
		});
	}

	private release(canvas: HTMLCanvasElement, state: ThumbnailEntry): void {
		this.pending.delete(canvas); state.request?.abort(); state.release(canvas); delete canvas.dataset.rendered;
	}

	destroy(): void {
		this.disposed = true;
		this.observer?.disconnect(); this.observer = null;
		for (const [canvas, state] of this.entries) this.release(canvas, state);
		this.entries.clear(); this.pending.clear();
	}
}

/** Scroll-based fallback preserves the same window lifecycle without IntersectionObserver. */
export function createThumbnailObserver(callback: IntersectionObserverCallback, root: HTMLElement): IntersectionObserver {
	const Observer = root.ownerDocument.defaultView?.IntersectionObserver;
	if (Observer) return new Observer(callback, { root, rootMargin: '160px 0px' });
	const targets = new Set<Element>(); let disposed = false; let scheduled = false;
	const check = (): void => {
		scheduled = false; if (disposed) return;
		const bounds = root.getBoundingClientRect();
		const entries = Array.from(targets, target => {
			const box = target.getBoundingClientRect();
			return { target, isIntersecting: box.bottom >= bounds.top - 160 && box.top <= bounds.bottom + 160 } as IntersectionObserverEntry;
		});
		callback(entries, observer);
	};
	const schedule = (): void => { if (!scheduled && !disposed) { scheduled = true; queueMicrotask(check); } };
	const observer = {
		observe: (target: Element) => { targets.add(target); schedule(); },
		unobserve: (target: Element) => { targets.delete(target); },
		disconnect: () => { disposed = true; targets.clear(); root.removeEventListener('scroll', schedule); root.ownerDocument.defaultView?.removeEventListener('resize', schedule); }
	} as unknown as IntersectionObserver;
	root.addEventListener('scroll', schedule, { passive: true }); root.ownerDocument.defaultView?.addEventListener('resize', schedule);
	return observer;
}
