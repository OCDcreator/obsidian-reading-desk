import type { ShelfViewState } from '../../types/contracts';
import type { ShelfViewHost } from './ShelfHost';
import { button, element, errorMessage } from './ShelfDom';

/** Coalesces view preferences only; book drafts and library metadata stay elsewhere. */
export class ShelfStatePersistence {
	readonly root = element('div', 'rd-setting-save-feedback');
	private readonly status = element('span', 'rd-setting-save-status');
	private readonly retry: HTMLButtonElement;
	private timer?: ReturnType<typeof setTimeout>;
	private pending?: { state: ShelfViewState; version: number; signature: string };
	private running?: Promise<void>;
	private version = 0;
	private saved = '';
	private attempted = 0;

	constructor(private readonly host: Pick<ShelfViewHost, 'saveShelfState'>) {
		this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
		this.retry = button('重试保存视图', '重试保存书架视图', () => void this.flush());
		this.retry.hidden = true; this.root.append(this.status, this.retry); this.root.hidden = true;
	}
	initialize(state: ShelfViewState): void { this.saved = JSON.stringify(state); }
	message(message: string): void { this.root.hidden = false; this.status.textContent = message; }
	record(state: ShelfViewState): void {
		if (!this.host.saveShelfState) return;
		const signature = JSON.stringify(state);
		if (signature === (this.pending?.signature ?? this.saved)) return;
		this.pending = { state: structuredClone(state), version: ++this.version, signature };
		this.message('书架视图尚未保存'); this.retry.hidden = true;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 500);
	}
	flush(): Promise<void> {
		if (this.timer) clearTimeout(this.timer); this.timer = undefined;
		if (this.running) return this.running.then(() => this.pending && this.pending.version > this.attempted ? this.flush() : undefined);
		this.running = this.drain().finally(() => { this.running = undefined; });
		return this.running;
	}
	private async drain(): Promise<void> {
		while (this.pending && this.host.saveShelfState) {
			const current = this.pending; this.attempted = current.version;
			this.message('正在保存书架视图…'); this.retry.hidden = true;
			try {
				await this.host.saveShelfState(structuredClone(current.state));
				this.saved = current.signature;
				if (this.pending.version === current.version) {
					this.pending = undefined; this.message('书架视图已保存');
				}
			} catch (error) {
				if (this.pending.version === current.version) {
					this.message('书架视图保存失败：' + errorMessage(error)); this.retry.hidden = false; break;
				}
			}
		}
	}
}
