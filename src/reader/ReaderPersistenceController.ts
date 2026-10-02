import type { ReaderBookmark, ReaderSavedPosition } from '../types/contracts';
import { createId } from '../utils/ids';
export interface ReaderStoredState { bookId: string; path: string; position?: ReaderSavedPosition; bookmarks: ReaderBookmark[]; }
export interface ReaderStatePort {
	read(path: string): ReaderStoredState | null;
	savePosition(bookId: string, position: ReaderSavedPosition): Promise<void>;
	saveBookmark(bookId: string, bookmark: ReaderBookmark): Promise<void>;
	removeBookmark(bookId: string, id: string): Promise<void>;
}
export interface ReaderPersistenceIO {
	port?: ReaderStatePort;
	capture(): Omit<ReaderSavedPosition, 'updatedAt'> | null;
	restore(position: ReaderSavedPosition): Promise<void>;
	error(message: string): void;
}
let lastTimestamp = 0;
function timestamp(): number { lastTimestamp = Math.max(Date.now(), lastTimestamp + 1); return lastTimestamp; }
/** Per-leaf scheduling; every queued write carries the book identity captured at open. */
export class ReaderPersistenceController {
	private state: ReaderStoredState | null = null;
	private ready = false;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private stopScroll: (() => void) | null = null;
	private readonly pending = new Map<string, ReaderSavedPosition>();
	private writes: Promise<void> = Promise.resolve();
	constructor(private readonly io: ReaderPersistenceIO) { }
	begin(path: string): ReaderSavedPosition | undefined {
		this.ready = false; this.unbind();
		this.state = this.io.port?.read(path) ?? null;
		return this.state?.position;
	}
	pause(): void { this.ready = false; this.unbind(); }
	activate(stage: HTMLElement): void { this.ready = true; this.observe(stage); }
	observe(stage: HTMLElement): void {
		this.unbind();
		const changed = (): void => this.changed(); stage.addEventListener('scroll', changed, { passive: true });
		this.stopScroll = () => stage.removeEventListener('scroll', changed);
	}
	changed(): void {
		if (!this.ready || !this.state) return;
		const value = this.io.capture(); if (!value) return;
		this.pending.set(this.state.bookId, { ...value, updatedAt: timestamp() });
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 400);
	}
	async flush(): Promise<void> {
		if (this.timer !== null) clearTimeout(this.timer); this.timer = null;
		const port = this.io.port; if (!port) return;
		const entries = Array.from(this.pending);
		const write = this.writes.then(async () => {
			for (const [bookId, position] of entries) {
				if (this.pending.get(bookId) !== position) continue;
				try { await port.savePosition(bookId, position); if (this.pending.get(bookId) === position) this.pending.delete(bookId); }
				catch { this.io.error('阅读位置尚未保存，可在书签页重试。'); }
			}
		});
		this.writes = write.catch(() => undefined); await write;
	}
	async leave(): Promise<void> { this.unbind(); this.ready = false; await this.flush(); }
	rename(oldPath: string, newPath: string): void { if (this.state?.path === oldPath) this.state.path = newPath; }
	private unbind(): void { this.stopScroll?.(); this.stopScroll = null; }
	bookmarks(): ReaderBookmark[] {
		const state = this.state; if (!state) return [];
		const current = this.io.port?.read(state.path);
		return current?.bookId === state.bookId ? current.bookmarks : state.bookmarks;
	}
	available(): boolean { return !!this.state && !!this.io.port; }
	async addBookmark(name: string): Promise<void> {
		const state = this.state; const position = this.io.capture(); const clean = name.trim();
		if (!state || !position || !clean) throw new Error('请输入书签名称并打开书库中的 PDF。');
		const now = timestamp();
		await this.io.port?.saveBookmark(state.bookId, { id: createId('bookmark'), name: clean.slice(0, 160), position: { ...position, updatedAt: now }, createdAt: now, updatedAt: now });
	}
	async renameBookmark(id: string, name: string): Promise<void> {
		const state = this.state; const bookmark = this.bookmarks().find(item => item.id === id); const clean = name.trim();
		if (!state || !bookmark || !clean) throw new Error('书签已变更或名称为空。');
		await this.io.port?.saveBookmark(state.bookId, { ...bookmark, name: clean.slice(0, 160), updatedAt: timestamp() });
	}
	async removeBookmark(id: string): Promise<void> { if (this.state) await this.io.port?.removeBookmark(this.state.bookId, id); }
	async jumpBookmark(id: string): Promise<void> { const bookmark = this.bookmarks().find(item => item.id === id); if (bookmark) await this.io.restore(bookmark.position); }
}
