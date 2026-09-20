/**
 * The Reader toolbar wraps onto extra rows whenever the leaf is narrow, so the
 * sticky target panel cannot offset itself from a constant.
 */
export function trackToolbarHeight(root: HTMLElement, toolbar: HTMLElement): () => void {
	const apply = (): void => {
		root.style.setProperty('--rd-toolbar-height', `${toolbar.offsetHeight}px`);
	};
	apply();
	if (typeof ResizeObserver === 'undefined') return () => undefined;
	const observer = new ResizeObserver(apply);
	observer.observe(toolbar);
	return () => observer.disconnect();
}

/**
 * Anchors the fixed highlight drawer just below the toolbar. The drawer is
 * `position: fixed`, but Obsidian puts `contain: strict` on the workspace leaf, so
 * that leaf, not the viewport, is its containing block and viewport coordinates
 * would land the drawer over the toolbar. Calibrating against the overlay's own
 * resolved origin stays correct whatever containing block the host provides.
 */
export function anchorBelowToolbar(overlay: HTMLElement, toolbar: HTMLElement, gap = 8): void {
	const previous = overlay.style.top;
	overlay.style.top = '0px';
	const origin = overlay.getBoundingClientRect().top;
	overlay.style.top = previous;
	overlay.style.setProperty('--rd-drawer-top', `${Math.round(toolbar.getBoundingClientRect().bottom + gap - origin)}px`);
}

export function afterLayout(element: HTMLElement): Promise<void> {
	return new Promise(resolve => {
		const view = element.ownerDocument.defaultView;
		if (view) view.requestAnimationFrame(() => resolve());
		else resolve();
	});
}
