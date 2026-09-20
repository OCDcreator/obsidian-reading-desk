export type ReaderDensity = 'wide' | 'medium' | 'narrow';

export function readerDensity(width: number): ReaderDensity {
	if (width >= 980) return 'wide';
	if (width >= 680) return 'medium';
	return 'narrow';
}

/** Mirrors container-query breakpoints as a testable DOM state for host layouts. */
export function observeReaderDensity(root: HTMLElement): () => void {
	const apply = (width: number): void => { root.dataset.rdSize = readerDensity(width); };
	apply(root.clientWidth);
	if (typeof ResizeObserver === 'undefined') return () => undefined;
	const observer = new ResizeObserver(entries => apply(entries[0]?.contentRect.width ?? root.clientWidth));
	observer.observe(root);
	return () => observer.disconnect();
}
