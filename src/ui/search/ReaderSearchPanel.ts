import { createReaderButton } from '../../reader/ReaderPageControl';
import type { SearchHit } from '../../reader/ReaderSearchService';
import { isReaderAbort } from '../../reader/ReaderCancellation';

export interface ReaderSearchPanelHost {
	run(query: string, signal?: AbortSignal): Promise<SearchHit[]>;
	goTo(hit: SearchHit, signal?: AbortSignal): Promise<void>;
	cancel?(): void;
	changed?(): void;
}
/** Latest request owns results and navigation, including repeated identical queries. */
export class ReaderSearchPanel {
	private container: HTMLElement | null = null;
	private input: HTMLInputElement | null = null;
	private status: HTMLElement | null = null;
	private list: HTMLElement | null = null;
	private hits: SearchHit[] = [];
	private cursor = -1;
	private open = false;
	private generation = 0;
	private request: AbortController | null = null;
	private debounce: ReturnType<typeof setTimeout> | null = null;
	private completedQuery = '';
	constructor(private readonly host: ReaderSearchPanelHost) { }
	mount(parent: HTMLElement): void {
		if (this.container?.isConnected) return;
		const query = this.input?.value ?? '';
		this.invalidate();
		const container = parent.createDiv({ cls: 'rd-search-panel', attr: { 'aria-label': 'PDF 全文搜索' } });
		this.container = container;
		const bar = container.createDiv({ cls: 'rd-search-panel__bar' });
		const input = bar.createEl('input', { type: 'search', cls: 'rd-input', attr: { placeholder: '搜索本书全文…', 'aria-label': '搜索关键词' } });
		this.input = input;
		input.value = query;
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') { event.preventDefault(); void this.step(event.shiftKey ? -1 : 1); }
			if (event.key === 'Escape') { event.preventDefault(); this.close(); }
		});
		input.addEventListener('input', () => {
			this.invalidate();
			this.hits = []; this.cursor = -1; this.completedQuery = '';
			this.renderList(); this.renderStatus(); this.host.changed?.();
			this.debounce = setTimeout(() => { this.debounce = null; void this.refresh(); }, 220);
		});
		createReaderButton(bar, '上一个结果', () => void this.step(-1), 'chevron-up');
		createReaderButton(bar, '下一个结果', () => void this.step(1), 'chevron-down');
		this.status = bar.createSpan({ cls: 'rd-search-panel__status', attr: { role: 'status' } });
		createReaderButton(bar, '关闭搜索', () => this.close(), 'x');
		this.list = container.createDiv({ cls: 'rd-search-panel__list' });
		container.classList.toggle('is-hidden', !this.open);
		this.renderList(); this.renderStatus();
		if (this.open && query) void this.refresh();
	}
	async search(query: string): Promise<void> {
		this.open = true; this.container?.classList.remove('is-hidden');
		if (this.input) { this.input.value = query; this.input.focus(); }
		await this.refresh();
	}
	toggle(): void { this.open ? this.close() : this.show(); }
	isOpen(): boolean { return this.open; }
	currentQuery(): string { return this.input?.value.trim() ?? ''; }
	currentHit(): SearchHit | null { return this.open ? this.hits[this.cursor] ?? null : null; }
	show(): void {
		this.open = true;
		this.container?.classList.remove('is-hidden');
		this.input?.focus();
		if (this.currentQuery()) void this.refresh();
	}
	close(): void {
		this.open = false;
		this.invalidate();
		this.container?.classList.add('is-hidden');
		this.container?.setAttribute('aria-busy', 'false');
		this.host.changed?.();
	}
	reset(): void {
		this.close();
		this.hits = []; this.cursor = -1; this.completedQuery = '';
		if (this.input) this.input.value = '';
		this.renderList(); this.renderStatus();
	}
	markActiveOnHost(apply: (hit: SearchHit | null) => void): void { apply(this.currentHit()); }
	private invalidate(): void {
		this.generation += 1;
		this.request?.abort(); this.request = null;
		if (this.debounce !== null) clearTimeout(this.debounce);
		this.debounce = null;
		this.host.cancel?.();
	}
	async refresh(): Promise<void> {
		if (!this.open) return;
		this.invalidate();
		const generation = this.generation;
		const request = new AbortController();
		this.request = request;
		const query = this.currentQuery();
		const current = (): boolean => this.open && this.generation === generation && !request.signal.aborted;
		if (this.status) this.status.textContent = query ? '正在搜索…' : '';
		this.container?.setAttribute('aria-busy', String(!!query));
		try {
			const hits = query ? await this.host.run(query, request.signal) : [];
			if (!current()) return;
			this.hits = hits; this.cursor = hits.length ? 0 : -1; this.completedQuery = query;
			this.renderList(); this.renderStatus(); this.host.changed?.();
			if (hits.length && current()) await this.host.goTo(hits[0], request.signal);
		} catch (error) {
			if (!current() || isReaderAbort(error)) return;
			this.hits = []; this.cursor = -1; this.completedQuery = '';
			this.renderList(); this.host.changed?.();
			if (this.status) this.status.textContent = '搜索失败，请重试。';
		} finally {
			if (current()) this.container?.setAttribute('aria-busy', 'false');
		}
	}
	async step(delta: number): Promise<void> {
		if (!this.open) return;
		if (!this.hits.length || this.completedQuery !== this.currentQuery()) return this.refresh();
		await this.select((this.cursor + delta + this.hits.length) % this.hits.length);
	}
	private async select(index: number): Promise<void> {
		if (!this.open || !this.hits[index]) return;
		this.invalidate();
		const generation = this.generation;
		const request = new AbortController(); this.request = request;
		this.cursor = index;
		this.renderStatus(); this.renderList(); this.host.changed?.();
		try { await this.host.goTo(this.hits[index], request.signal); }
		catch (error) { if (this.open && generation === this.generation && !isReaderAbort(error) && this.status) this.status.textContent = '定位失败，请重试。'; }
	}
	private renderStatus(): void {
		if (this.status) this.status.textContent = this.hits.length ? `${this.cursor + 1} / ${this.hits.length} 处` : (this.currentQuery() ? '没有匹配结果' : '');
	}
	private renderList(): void {
		if (!this.list) return;
		this.list.replaceChildren();
		const start = Math.max(0, Math.min(this.cursor - 30, this.hits.length - 60));
		for (let index = start; index < Math.min(start + 60, this.hits.length); index += 1) {
			const hit = this.hits[index];
			const row = this.list.createEl('button', { cls: `rd-search-panel__hit${index === this.cursor ? ' is-active' : ''}`, type: 'button', attr: { 'aria-label': `第 ${hit.page} 页：${hit.snippet}`, 'aria-current': String(index === this.cursor) } });
			row.createSpan({ cls: 'rd-search-panel__hit-page', text: `第 ${hit.page} 页` });
			row.createSpan({ cls: 'rd-search-panel__hit-snippet', text: hit.snippet });
			row.addEventListener('click', () => void this.select(index));
		}
	}
}
