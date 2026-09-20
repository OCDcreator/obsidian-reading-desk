import { effectiveInvert, type InvertSetting } from './ReaderViewerOptions';

/** Writes the effective paper-inversion state onto the reader root. */
export function applyReaderInvert(root: HTMLElement, invert: InvertSetting): void {
	const themeDark = root.ownerDocument.body.classList.contains('theme-dark')
		|| root.ownerDocument.documentElement.classList.contains('theme-dark');
	root.dataset.rdPdfInvert = effectiveInvert(invert, themeDark) ? 'on' : 'off';
}

/** Re-evaluates inversion whenever the host theme class flips. */
export function observeReaderTheme(root: HTMLElement, onChange: () => void): () => void {
	if (typeof MutationObserver === 'undefined') return () => undefined;
	const observer = new MutationObserver(onChange);
	observer.observe(root.ownerDocument.body, { attributes: true, attributeFilter: ['class'] });
	return () => observer.disconnect();
}
