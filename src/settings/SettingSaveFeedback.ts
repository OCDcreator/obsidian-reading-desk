/** Local save lifecycle: keeps the edited control, its draft and focus in place. */
export class SettingSaveFeedback {
	private readonly status: HTMLElement;
	private readonly retry: HTMLButtonElement;
	private version = 0;
	private queue: Promise<void> = Promise.resolve();
	private latest?: () => Promise<unknown>;
	constructor(private readonly row: HTMLElement) {
		const wrapper = row.ownerDocument.createElement('div'); wrapper.className = 'rd-setting-save-feedback';
		this.status = row.ownerDocument.createElement('span'); this.status.className = 'rd-setting-save-status';
		this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.status.setAttribute('aria-atomic', 'true');
		this.retry = row.ownerDocument.createElement('button'); this.retry.type = 'button'; this.retry.className = 'rd-button';
		this.retry.textContent = '重试保存'; this.retry.setAttribute('aria-label', '重试保存此设置'); this.retry.hidden = true;
		this.retry.addEventListener('click', () => { if (this.latest) void this.save(this.latest); });
		wrapper.append(this.status, this.retry); row.append(wrapper);
	}
	save(operation: () => Promise<unknown>): Promise<void> {
		this.latest = operation; const version = ++this.version;
		this.status.textContent = '保存中…'; this.status.className = 'rd-setting-save-status is-saving'; this.retry.hidden = true; this.row.setAttribute('aria-busy', 'true');
		this.queue = this.queue.catch(() => undefined).then(async () => {
			// Only the latest queued draft needs to be persisted.
			if (version !== this.version) return;
			try {
				await operation();
				if (version === this.version) { this.status.textContent = '已保存'; this.status.className = 'rd-setting-save-status is-success'; }
			} catch (error) {
				if (version === this.version) {
					this.status.textContent = '保存失败：' + (error instanceof Error ? error.message : '请重试');
					this.status.className = 'rd-setting-save-status is-error'; this.retry.hidden = false;
				}
			} finally { if (version === this.version) this.row.removeAttribute('aria-busy'); }
		}); return this.queue;
	}
}
