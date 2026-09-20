import { createReaderButton } from '../../reader/ReaderPageControl';
import type { SearchHit } from '../../reader/ReaderSearchService';

export interface ReaderSearchPanelHost {
	/** Runs the full-document search; called on Enter or input debounce. */
	run(query: string): Promise<SearchHit[]>;
	/** Navigates to one hit. */
	goTo(hit: SearchHit): Promise<void>;
}

/**
 * Docked search bar: query input, prev/next hit navigation, live position and a
 * capped results list. Lives under the toolbar so it never covers the page.
 */
export class ReaderSearchPanel {
	private container: HTMLElement | null = null;
	private input: HTMLInputElement | null = null;
	private status: HTMLElement | null = null;
	private list: HTMLElement | null = null;
	private hits: SearchHit[] = [];
	private cursor = -1;
	private open = false;
	private running: Promise<void> = Promise.resolve();

	constructor(private readonly host: ReaderSearchPanelHost) { }

	mount(parent: HTMLElement): void {
		if (this.container) return;
		const container = parent.createDiv({ cls: 'rd-search-panel', attr: { 'aria-label': 'PDF 全文搜索' } });
		this.container = container;
		const bar = container.createDiv({ cls: 'rd-search-panel__bar' });
		const input = bar.createEl('input', { type: 'search', cls: 'rd-input', attr: { placeholder: '搜索本书全文…', 'aria-label': '搜索关键词' } });
		this.input = input;
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void this.step(event.shiftKey ? -1 : 1);
			}
		});
		let debounce: ReturnType<typeof setTimeout> | null = null;
		input.addEventListener('input', () => {
			if (debounce !== null) clearTimeout(debounce);
			debounce = setTimeout(() => void this.refresh(), 220);
		});
		createReaderButton(bar, '上一个结果', () => void this.step(-1), 'chevron-up');
		createReaderButton(bar, '下一个结果', () => void this.step(1), 'chevron-down');
		this.status = bar.createSpan({ cls: 'rd-search-panel__status', attr: { role: 'status' }, text: '' });
		createReaderButton(bar, '关闭搜索', () => this.close(), 'x');
		this.list = container.createDiv({ cls: 'rd-search-panel__list' });
		container.classList.add('is-hidden');
	}

	toggle(): void {
		this.open ? this.close() : this.show();
	}

	isOpen(): boolean { return this.open; }

	/** Current query, used to re-mark hits after page re-renders. */
	currentQuery(): string { return this.input?.value.trim() ?? ''; }

	show(): void {
		this.open = true;
		this.container?.classList.remove('is-hidden');
		this.input?.focus();
	}

	close(): void {
		this.open = false;
		this.container?.classList.add('is-hidden');
	}

	/** Re-highlights the current query on a freshly rendered page host. */
	markActiveOnHost(apply: (hit: SearchHit | null) => void): void {
		apply(this.cursor >= 0 && this.cursor < this.hits.length ? this.hits[this.cursor] : null);
	}

	private async refresh(): Promise<void> {
		const query = this.input?.value.trim() ?? '';
		this.running = this.running.then(async () => {
			const hits = query ? await this.host.run(query) : [];
			if ((this.input?.value.trim() ?? '') !== query) return;
			this.hits = hits;
			this.cursor = hits.length ? 0 : -1;
			this.renderList();
			this.renderStatus();
			if (hits.length) await this.host.goTo(hits[0]);
		});
		await this.running;
	}

	private async step(delta: number): Promise<void> {
		if (!this.hits.length) return void this.refresh();
		this.cursor = (this.cursor + delta + this.hits.length) % this.hits.length;
		this.renderStatus();
		this.renderList();
		await this.host.goTo(this.hits[this.cursor]);
	}

	private renderStatus(): void {
		if (!this.status) return;
		this.status.textContent = this.hits.length
			? `${this.cursor + 1} / ${this.hits.length} 处`
			: (this.input?.value.trim() ? '没有匹配结果' : '');
	}

	private renderList(): void {
		if (!this.list) return;
		this.list.replaceChildren();
		const capped = this.hits.slice(0, 60);
		for (const hit of capped) {
			const row = this.list.createEl('button', {
				cls: `rd-search-panel__hit${this.hits.indexOf(hit) === this.cursor ? ' is-active' : ''}`,
				type: 'button',
				attr: { 'aria-label': `第 ${hit.page} 页：${hit.snippet}` }
			});
			row.createSpan({ cls: 'rd-search-panel__hit-page', text: `第 ${hit.page} 页` });
			row.createSpan({ cls: 'rd-search-panel__hit-snippet', text: hit.snippet });
			row.addEventListener('click', () => {
				this.cursor = this.hits.indexOf(hit);
				this.renderStatus();
				this.renderList();
				void this.host.goTo(hit);
			});
		}
		if (this.hits.length > capped.length) {
			this.list.createSpan({ cls: 'rd-search-panel__more', text: `其余 ${this.hits.length - capped.length} 处结果未列出，可用上/下一个继续跳转。` });
		}
	}
}
