import type { PdfOutlineEntry, PdfRenderer } from './PdfRenderer';
import { createId } from '../utils/ids';

export type ReaderNavigationMode = 'thumbnails' | 'outline';
export interface OutlineNode extends PdfOutlineEntry { children: OutlineNode[]; }
export type OutlineLoadState = 'loading' | 'ready' | 'error';
type ThumbnailRender = (canvas: HTMLCanvasElement, page: number) => void;

export class ThumbnailObserverLifecycle {
	private observer: IntersectionObserver | null = null;
	private disposed = false;

	constructor(private readonly createObserver: (callback: IntersectionObserverCallback, root: HTMLElement) => IntersectionObserver) { }

	observe(canvas: HTMLCanvasElement, page: number, root: HTMLElement, render: ThumbnailRender): void {
		if (this.disposed) return;
		this.observer ??= this.createObserver(entries => {
			if (this.disposed) return;
			for (const entry of entries) {
				if (!entry.isIntersecting || entry.target.tagName !== 'CANVAS') continue;
				const visibleCanvas = entry.target as HTMLCanvasElement;
				this.observer?.unobserve(visibleCanvas);
				render(visibleCanvas, Number(visibleCanvas.dataset.page));
			}
		}, root);
		canvas.dataset.page = String(page);
		this.observer.observe(canvas);
	}

	destroy(): void {
		this.disposed = true;
		this.observer?.disconnect();
		this.observer = null;
	}
}

export function buildOutlineTree(entries: readonly PdfOutlineEntry[]): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const nodes = new Map<string, OutlineNode>();
	for (const entry of entries) {
		for (let depth = 1; depth <= entry.path.length; depth += 1) {
			const path = entry.path.slice(0, depth);
			const key = path.join('\u0000');
			const existing = nodes.get(key);
			if (existing) {
				if (depth === entry.path.length) existing.page = entry.page;
				continue;
			}
			const node: OutlineNode = { title: path[path.length - 1], page: entry.page, path, children: [] };
			nodes.set(key, node);
			const parent = nodes.get(path.slice(0, -1).join('\u0000'));
			(parent?.children ?? roots).push(node);
		}
	}
	return roots;
}

export function activeOutlinePath(entries: readonly PdfOutlineEntry[], currentPage: number): string[] {
	let selected: PdfOutlineEntry | undefined;
	for (const entry of entries) {
		if (entry.page <= currentPage && (!selected || entry.page > selected.page || entry.path.length > selected.path.length && entry.page === selected.page)) selected = entry;
	}
	return selected ? [...selected.path] : [];
}

export class ReaderNavigation {
	private mode: ReaderNavigationMode;
	private outline: readonly PdfOutlineEntry[] = [];
	private outlineState: OutlineLoadState = 'loading';
	private outlineError = '';
	private container: HTMLElement | null = null;
	private thumbnailLifecycle: ThumbnailObserverLifecycle | null = null;
	private readonly panelId = createId('rd-pdf-navigation-panel');
	private readonly tabIds = { thumbnails: createId('rd-pdf-thumbnails-tab'), outline: createId('rd-pdf-outline-tab') };

	constructor(private readonly pdf: PdfRenderer, private readonly pages: number, private readonly currentPage: () => number, private readonly goTo: (page: number) => Promise<void>, mode: ReaderNavigationMode = 'thumbnails', private readonly onModeChange?: (mode: ReaderNavigationMode) => void) { this.mode = mode; }
	private switchMode(mode: ReaderNavigationMode): void {
		this.mode = mode;
		this.onModeChange?.(mode);
	}
	getMode(): ReaderNavigationMode { return this.mode; }

	render(container: HTMLElement): void {
		this.thumbnailLifecycle?.destroy();
		this.thumbnailLifecycle = null;
		this.container = container;
		container.replaceChildren();
		container.className = 'rd-reader-navigation';
		container.setAttribute('aria-label', 'PDF 导航');
		const tabs = container.createDiv({ cls: 'rd-reader-navigation__tabs', attr: { role: 'tablist', 'aria-label': 'PDF 导航方式' } });
		this.tab(tabs, 'thumbnails', '缩略图');
		this.tab(tabs, 'outline', '目录');
		const panel = container.createDiv({ cls: 'rd-reader-navigation__panel', attr: { id: this.panelId, role: 'tabpanel', tabindex: '0', 'aria-labelledby': this.tabIds[this.mode] } });
		if (this.mode === 'thumbnails') this.renderThumbnails(panel);
		else this.renderOutline(panel);
	}

	/** Mirrors the host PDF sidebar's thumbnail paper width so the leaf reads as native chrome. */
	private static readonly THUMBNAIL_WIDTH = 148;

	/** Refreshes the page marker and the outline's current-section marker after page changes. */
	revealPage(page: number): void {
		if (!this.container) return;
		const zeroBased = page - 1;
		const activeKey = activeOutlinePath(this.outline, zeroBased).join('\u0000');
		for (const button of Array.from(this.container.querySelectorAll<HTMLElement>('[data-nav-page]'))) {
			const isOutline = button.dataset.outlineKey !== undefined;
			const isCurrent = isOutline ? button.dataset.outlineKey === activeKey : Number(button.dataset.navPage) === zeroBased;
			button.setAttribute('aria-current', isCurrent ? (isOutline ? 'location' : 'page') : 'false');
			if (isCurrent) button.scrollIntoView({ block: 'nearest' });
		}
	}

	setOutline(entries: readonly PdfOutlineEntry[], state: OutlineLoadState, error = ''): void {
		this.outline = entries;
		this.outlineState = state;
		this.outlineError = error;
		if (this.container && this.mode === 'outline') this.render(this.container);
	}

	destroy(): void {
		this.thumbnailLifecycle?.destroy();
		this.thumbnailLifecycle = null;
		this.container = null;
	}

	private tab(parent: HTMLElement, mode: ReaderNavigationMode, label: string): void {
		const selected = this.mode === mode;
		const button = parent.createEl('button', { cls: 'rd-reader-navigation__tab', text: label, attr: { id: this.tabIds[mode], role: 'tab', 'aria-controls': this.panelId, 'aria-selected': String(selected), tabindex: selected ? '0' : '-1' } });
		button.type = 'button';
		button.addEventListener('click', () => { this.switchMode(mode); if (this.container) this.render(this.container); });
		button.addEventListener('keydown', event => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			this.switchMode(mode === 'outline' ? 'thumbnails' : 'outline');
			if (this.container) { this.render(this.container); this.container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus(); }
		});
	}

	private renderThumbnails(panel: HTMLElement): void {
		if (!this.pages) { this.status(panel, '暂无可预览页面。'); return; }
		const list = panel.createEl('ol', { cls: 'rd-reader-thumbnails' });
		const render = (canvas: HTMLCanvasElement, page: number): void => {
			void this.pdf.renderThumbnail(page, canvas, ReaderNavigation.THUMBNAIL_WIDTH).then(() => {
				canvas.dataset.rendered = '1';
			}).catch(() => {
				canvas.replaceWith(Object.assign(document.createElement('span'), { className: 'rd-reader-thumbnail__error', textContent: '预览失败' }));
			});
		};
		const Observer = panel.ownerDocument.defaultView?.IntersectionObserver;
		if (Observer) this.thumbnailLifecycle = new ThumbnailObserverLifecycle((callback, root) => new Observer(callback, { root, rootMargin: '160px 0px' }));
		for (let page = 1; page <= this.pages; page += 1) {
			const item = list.createEl('li');
			const button = item.createEl('button', { cls: 'rd-reader-thumbnail', attr: { 'aria-label': `跳到第 ${page} 页`, 'aria-current': page === this.currentPage() ? 'page' : 'false', 'data-nav-page': String(page - 1), 'data-page-label': String(page) } });
			button.type = 'button';
			const canvas = button.createEl('canvas', { attr: { 'aria-hidden': 'true', 'data-page': String(page) } });
			button.addEventListener('click', () => void this.goTo(page));
			if (this.thumbnailLifecycle) this.thumbnailLifecycle.observe(canvas, page, panel, render);
			else render(canvas, page);
		}
		const current = list.querySelector('.rd-reader-thumbnail[aria-current="page"]');
		current?.scrollIntoView({ block: 'nearest' });
	}

	private renderOutline(panel: HTMLElement): void {
		if (this.outlineState === 'loading') { this.status(panel, '正在载入 PDF 目录…'); return; }
		if (this.outlineState === 'error') { this.status(panel, this.outlineError || 'PDF 目录载入失败，请重新打开文件。', true); return; }
		if (!this.outline.length) { this.status(panel, '此 PDF 没有可用目录，可切换到缩略图导航。'); return; }
		const activePath = activeOutlinePath(this.outline, this.currentPage() - 1);
		this.appendOutlineList(panel, buildOutlineTree(this.outline), activePath);
	}

	private appendOutlineList(parent: HTMLElement, nodes: readonly OutlineNode[], activePath: readonly string[]): void {
		const list = parent.createEl('ul', { cls: 'rd-reader-outline' });
		for (const node of nodes) {
			const item = list.createEl('li');
			const key = node.path.join('\u0000');
			const active = key === activePath.join('\u0000');
			const button = item.createEl('button', { cls: 'rd-reader-outline__item', attr: { 'aria-current': active ? 'location' : 'false', title: `${node.title}，第 ${node.page + 1} 页`, 'data-nav-page': String(node.page), 'data-outline-key': key } });
			button.type = 'button';
			button.createEl('span', { text: node.title });
			button.createEl('span', { cls: 'rd-reader-outline__page', text: `p.${node.page + 1}` });
			button.addEventListener('click', () => void this.goTo(node.page + 1));
			if (node.children.length) this.appendOutlineList(item, node.children, activePath);
		}
	}

	private status(parent: HTMLElement, message: string, error = false): void {
		parent.createEl('p', { cls: error ? 'rd-error' : 'rd-empty', text: message, attr: { role: error ? 'alert' : 'status' } });
	}
}
