export interface ReaderLocation {
	page: number;
	/** Signed displayed page offsets, independent of scale; negative when the page starts below/right of the viewport. */
	x?: number;
	y?: number;
}

/**
 * Back/forward stack for in-reader jumps (outline, highlight links, search hits).
 * Linear page turns do not push; only real jumps do.
 */
export class ReaderHistory {
	private readonly backStack: ReaderLocation[] = [];
	private readonly forwardStack: ReaderLocation[] = [];
	private current: ReaderLocation | null = null;
	private readonly capacity: number;

	constructor(capacity = 50) {
		this.capacity = Math.max(2, capacity);
	}

	canBack(): boolean { return this.backStack.length > 0; }
	canForward(): boolean { return this.forwardStack.length > 0; }

	/** Records the position before a jump; truncates the forward branch. */
	push(location: ReaderLocation): void {
		if (this.current && this.current.page === location.page && (this.current.x ?? 0) === (location.x ?? 0) && (this.current.y ?? 0) === (location.y ?? 0)) return;
		if (this.current) {
			this.backStack.push(this.current);
			if (this.backStack.length > this.capacity) this.backStack.shift();
		}
		this.forwardStack.length = 0;
		this.current = { ...location };
	}

	/** Marks a new current location without pushing history (page turns, scroll). */
	replace(location: ReaderLocation): void {
		this.current = { ...location };
	}

	back(): ReaderLocation | null {
		const previous = this.backStack.pop();
		if (!previous) return null;
		if (this.current) this.forwardStack.push(this.current);
		this.current = previous;
		return { ...previous };
	}

	forward(): ReaderLocation | null {
		const next = this.forwardStack.pop();
		if (!next) return null;
		if (this.current) this.backStack.push(this.current);
		this.current = next;
		return { ...next };
	}

	reset(): void {
		this.backStack.length = 0;
		this.forwardStack.length = 0;
		this.current = null;
	}
}
