export type ReaderDensity = 'wide' | 'medium' | 'narrow';

export function readerDensity(width: number): ReaderDensity {
	if (width >= 980) return 'wide';
	if (width >= 680) return 'medium';
	return 'narrow';
}

export function readerToolbarOverflow(width: number): 'none' | 'secondary' | 'tight' {
	if (width <= 500) return 'tight';
	if (width <= 980) return 'secondary';
	return 'none';
}

/** Mirrors container-query breakpoints as a testable DOM state for host layouts. */
export function observeReaderDensity(root: HTMLElement): () => void {
	const apply = (width: number): void => { root.dataset.rdSize = readerDensity(width); root.dataset.rdToolbarOverflow = readerToolbarOverflow(width); };
	apply(root.clientWidth);
	if (typeof ResizeObserver === 'undefined') return () => undefined;
	const observer = new ResizeObserver(entries => apply(entries[0]?.contentRect.width ?? root.clientWidth));
	observer.observe(root);
	return () => observer.disconnect();
}
