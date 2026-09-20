export interface ProgressRecord {
	path: string;
	progress: number;
}

export interface ProgressRecordSink {
	/** Persists one book progress; called at most once per debounce window. */
	write(record: ProgressRecord): Promise<void>;
}

/**
 * Collapses rapid per-render progress writes (every page turn) into one trailing
 * persistence per window so large libraries stop rewriting data.json per keypress.
 */
export class ProgressFlusher {
	private pending: ProgressRecord | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly sink: ProgressRecordSink, private readonly delayMs = 1200) { }

	record(path: string, progress: number): void {
		this.pending = { path, progress };
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.flush(), this.delayMs);
	}

	async flush(): Promise<void> {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		const record = this.pending;
		this.pending = null;
		if (!record) return;
		await this.sink.write(record);
	}

	dispose(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pending = null;
	}
}
