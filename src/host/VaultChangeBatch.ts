/** Coalesces host file events while keeping domain mutations serialized. */
export class VaultChangeBatch {
	private readonly paths = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private queue: Promise<void> = Promise.resolve();
	private disposed = false;

	constructor(private readonly apply: (paths: string[]) => Promise<void>, private readonly onError: (error: unknown) => void, private readonly delay = 120) { }

	add(path: string): void {
		if (this.disposed) return;
		this.paths.add(path);
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.delay);
	}

	flush(): Promise<void> {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		const paths = [...this.paths];
		this.paths.clear();
		if (paths.length && !this.disposed) {
			this.queue = this.queue.then(() => this.apply(paths)).catch(error => { this.onError(error); });
		}
		return this.queue;
	}

	dispose(): void {
		this.disposed = true;
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.paths.clear();
	}
}
