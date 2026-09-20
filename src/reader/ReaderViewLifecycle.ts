export interface ReaderRestoreState { pdfPath?: string; page?: number; }

/** Coordinates Obsidian's unspecified onOpen/setState ordering without duplicate loads. */
export class ReaderViewLifecycle {
	private opened = false;
	private closed = false;
	private loadedKey = '';
	private activeKey = '';
	private active: Promise<void> | null = null;
	private generation = 0;

	onOpen(state: ReaderRestoreState, open: (path: string, page: number) => Promise<void>): Promise<void> {
		this.opened = true;
		return this.restore(state, open);
	}

	onState(state: ReaderRestoreState, open: (path: string, page: number) => Promise<void>): Promise<void> {
		return this.opened ? this.restore(state, open) : Promise.resolve();
	}

	markLoaded(path: string, page: number): void { this.loadedKey = this.key(path, page); }
	close(): void { this.closed = true; this.generation += 1; this.activeKey = ''; this.active = null; }

	private restore(state: ReaderRestoreState, open: (path: string, page: number) => Promise<void>): Promise<void> {
		const path = typeof state.pdfPath === 'string' ? state.pdfPath : '';
		const page = Math.max(1, Math.round(state.page ?? 1));
		const key = this.key(path, page);
		if (this.closed || !path || key === this.loadedKey) return Promise.resolve();
		if (key === this.activeKey && this.active) return this.active;
		const generation = ++this.generation;
		this.activeKey = key;
		const active = open(path, page)
			.then(() => { if (!this.closed && generation === this.generation) this.loadedKey = key; })
			.finally(() => {
				if (generation !== this.generation) return;
				this.activeKey = '';
				this.active = null;
			});
		this.active = active;
		return active;
	}

	private key(path: string, page: number): string { return `${path}\u0000${page}`; }
}
