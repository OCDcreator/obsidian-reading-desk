const PREVIEW_CLASS = 'is-previewed';

/** Per-reader delegated hover/focus synchronization between marks and drawer rows. */
export class HighlightPreviewController {
	private roots: HTMLElement[] = [];
	private activeId = '';
	private readonly cleanups: Array<() => void> = [];

	constructor(private readonly jumpToTarget: (highlightId: string) => Promise<void> | void) { }

	bind(...roots: Array<HTMLElement | null>): void {
		this.destroy();
		this.roots = roots.filter((root): root is HTMLElement => !!root);
		for (const mark of Array.from(this.roots[0]?.querySelectorAll<HTMLElement>('[data-highlight-id]') ?? [])) mark.tabIndex = 0;
		for (const root of this.roots) {
			this.listen(root, 'mouseover', event => this.enter(event));
			this.listen(root, 'mouseout', event => this.leave(event));
			this.listen(root, 'focusin', event => this.enter(event));
			this.listen(root, 'focusout', event => this.leave(event));
			this.listen(root, 'keydown', event => this.keydown(event as KeyboardEvent));
		}
	}

	private keydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return;
		const item = this.item(event.target);
		if (!item?.dataset.highlightId || item.closest('.rd-highlight-row')) return;
		event.preventDefault();
		event.stopPropagation();
		void this.jumpToTarget(item.dataset.highlightId);
	}

	clear(): void {
		for (const root of this.roots) {
			for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-highlight-id]'))) node.classList.remove(PREVIEW_CLASS);
		}
		this.activeId = '';
	}

	destroy(): void {
		this.clear();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
		this.roots = [];
	}

	private enter(event: Event): void {
		const item = this.item(event.target);
		if (item?.dataset.highlightId) this.activate(item.dataset.highlightId);
	}

	private leave(event: Event): void {
		const item = this.item(event.target);
		if (!item?.dataset.highlightId || item.dataset.highlightId !== this.activeId) return;
		const related = this.item((event as MouseEvent | FocusEvent).relatedTarget);
		if (related?.dataset.highlightId === this.activeId) return;
		this.clear();
	}

	private activate(id: string): void {
		this.clear();
		this.activeId = id;
		for (const root of this.roots) {
			for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-highlight-id]'))) {
				if (node.dataset.highlightId === id) node.classList.add(PREVIEW_CLASS);
			}
		}
	}

	private item(value: EventTarget | null): HTMLElement | null {
		return value instanceof HTMLElement ? value.closest<HTMLElement>('[data-highlight-id]') : null;
	}

	private listen(root: HTMLElement, type: string, listener: EventListener): void {
		root.addEventListener(type, listener);
		this.cleanups.push(() => root.removeEventListener(type, listener));
	}
}
