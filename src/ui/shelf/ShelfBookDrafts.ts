export type ShelfBookField = 'title' | 'author' | 'tags' | 'rating' | 'categoryId' | 'readingStatus';
interface BookDraft {
	bookId: string;
	value: string;
	version: number;
	saving: boolean;
	error?: string;
	operation?: () => Promise<unknown>;
}

/** Per-leaf unsaved controls, never another book metadata source. */
export class ShelfBookDrafts {
	private readonly entries = new Map<string, BookDraft>();
	private readonly listeners = new Map<string, Set<() => void>>();
	private readonly queues = new Map<string, Promise<void>>();
	private readonly submitted = new Set<number>();
	private version = 0;

	key(bookId: string, field: ShelfBookField): string { return bookId + ':' + field; }
	read(bookId: string, field: ShelfBookField): Readonly<BookDraft> | undefined { return this.entries.get(this.key(bookId, field)); }
	value(bookId: string, field: ShelfBookField, fallback: string): string { return this.read(bookId, field)?.value ?? fallback; }
	edit(bookId: string, field: ShelfBookField, value: string, force = false): BookDraft {
		const key = this.key(bookId, field);
		const previous = this.entries.get(key);
		if (!force && previous?.value === value) return previous;
		const next = { bookId, value, version: ++this.version, saving: false };
		this.entries.set(key, next); this.notify(key); return next;
	}
	watch(bookId: string, field: ShelfBookField, listener: () => void): void {
		const key = this.key(bookId, field);
		const listeners = this.listeners.get(key) ?? new Set<() => void>();
		listeners.add(listener); this.listeners.set(key, listeners); listener();
	}
	clearBindings(): void { this.listeners.clear(); }
	retainBooks(ids: Set<string>): void {
		for (const [key, entry] of this.entries) if (!ids.has(entry.bookId)) this.entries.delete(key);
	}
	clear(): void { this.entries.clear(); this.clearBindings(); }

	save(bookId: string, field: ShelfBookField, value: string, operation: () => Promise<unknown>, changed: () => void, force = false): Promise<void> {
		const key = this.key(bookId, field);
		const draft = this.edit(bookId, field, value, force);
		if (this.submitted.has(draft.version)) return this.queues.get(key) ?? Promise.resolve();
		this.submitted.add(draft.version); draft.saving = true; draft.error = undefined; draft.operation = operation; this.notify(key);
		const pending = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
			try {
				await operation();
				if (this.entries.get(key)?.version === draft.version) this.entries.delete(key);
				changed();
			} catch (error) {
				if (this.entries.get(key)?.version === draft.version) {
					draft.error = error instanceof Error ? error.message : '无法保存图书信息，请重试';
					draft.saving = false;
				}
			} finally { this.submitted.delete(draft.version); this.notify(key); }
		});
		this.queues.set(key, pending);
		void pending.then(() => { if (this.queues.get(key) === pending) this.queues.delete(key); });
		return pending;
	}
	retry(bookId: string, field: ShelfBookField, changed: () => void): Promise<void> {
		const draft = this.read(bookId, field);
		return draft?.operation ? this.save(bookId, field, draft.value, draft.operation, changed) : Promise.resolve();
	}
	private notify(key: string): void { for (const listener of this.listeners.get(key) ?? []) listener(); }
}
