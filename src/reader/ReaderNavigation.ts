import { setIcon } from 'obsidian';
import type { PdfOutlineEntry, PdfRenderer } from './PdfRenderer';
import {
	activeOutlinePath,
	ancestorKeys,
	buildDisplayTree,
	matchTypeahead,
	outlineKey,
	outlineRows,
	pathKey,
	resolveOutlineKey,
	type OutlineNode,
	type OutlineRow,
	type OutlineStyle
} from './ReaderOutlineModel';
import { createId } from '../utils/ids';

export type ReaderNavigationMode = 'thumbnails' | 'outline';
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

interface OutlineHandles {
	item: HTMLElement;
	group: HTMLElement | null;
}

export class ReaderNavigation {
	private mode: ReaderNavigationMode;
	private outline: readonly PdfOutlineEntry[] = [];
	private outlineState: OutlineLoadState = 'loading';
	private outlineError = '';
	private outlineStyle: OutlineStyle;
	/** Collapsed parent keys; tree style only, and empty on first paint so nothing hides after upgrade. */
	private readonly collapsed = new Set<string>();
	private displayTree: OutlineNode[] = [];
	private handles = new Map<string, OutlineHandles>();
	private focusedKey: string | null = null;
	private typeaheadBuffer = '';
	private typeaheadAt = 0;
	private container: HTMLElement | null = null;
	private treeRoot: HTMLElement | null = null;
	private restoreFocusKey: string | null = null;
	private thumbnailLifecycle: ThumbnailObserverLifecycle | null = null;
	private readonly panelId = createId('rd-pdf-navigation-panel');
	private readonly tabIds = { thumbnails: createId('rd-pdf-thumbnails-tab'), outline: createId('rd-pdf-outline-tab') };

	constructor(private readonly pdf: PdfRenderer, private readonly pages: number, private readonly currentPage: () => number, private readonly goTo: (page: number) => Promise<void>, mode: ReaderNavigationMode = 'thumbnails', private readonly onModeChange?: (mode: ReaderNavigationMode) => void, outlineStyle: OutlineStyle = 'tree') {
		this.mode = mode;
		this.outlineStyle = outlineStyle;
	}

	private switchMode(mode: ReaderNavigationMode): void {
		this.mode = mode;
		this.onModeChange?.(mode);
	}
	getMode(): ReaderNavigationMode { return this.mode; }

	/** Outline presentation only; re-renders the open directory panel in place. */
	setOutlineStyle(style: OutlineStyle): void {
		if (this.outlineStyle === style) return;
		this.outlineStyle = style;
		if (this.container && this.mode === 'outline') this.render(this.container);
	}

	render(container: HTMLElement): void {
		this.thumbnailLifecycle?.destroy();
		this.thumbnailLifecycle = null;
		this.container = container;
		this.restoreFocusKey = this.focusedNodeKey(container);
		container.replaceChildren();
		container.className = 'rd-reader-navigation';
		container.setAttribute('aria-label', 'PDF 导航');
		const tabs = container.createDiv({ cls: 'rd-reader-navigation__tabs', attr: { role: 'tablist', 'aria-label': 'PDF 导航方式' } });
		this.tab(tabs, 'thumbnails', '缩略图');
		this.tab(tabs, 'outline', '目录');
		const panel = container.createDiv({ cls: 'rd-reader-navigation__panel', attr: { id: this.panelId, role: 'tabpanel', tabindex: '0', 'aria-labelledby': this.tabIds[this.mode] } });
		if (this.mode === 'thumbnails') this.renderThumbnails(panel);
		else this.renderOutline(panel);
		this.restoreFocusKey = null;
	}

	/** Mirrors the host PDF sidebar's thumbnail paper width so the leaf reads as native chrome. */
	private static readonly THUMBNAIL_WIDTH = 148;

	/** Refreshes the page marker and the outline's current-section marker after page changes. */
	revealPage(page: number): void {
		if (!this.container) return;
		const zeroBased = page - 1;
		const activeKey = pathKey(activeOutlinePath(this.outline, zeroBased));
		this.expandActiveAncestors(activeKey);
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
		this.handles = new Map();
		this.displayTree = [];
		this.treeRoot = null;
		this.restoreFocusKey = null;
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
		this.displayTree = buildDisplayTree(this.outline);
		this.handles = new Map();
		const tree = panel.createEl('ul', {
			cls: `rd-reader-outline rd-reader-outline--${this.outlineStyle}`,
			attr: { role: 'tree', 'aria-label': 'PDF 目录' }
		});
		this.treeRoot = tree;
		tree.addEventListener('keydown', event => this.onTreeKeydown(event));
		this.appendOutlineNodes(tree, this.displayTree);
		const rows = this.visibleRows();
		const activeKey = pathKey(activeOutlinePath(this.outline, this.currentPage() - 1));
		this.focusedKey = rows.some(row => row.key === activeKey) ? activeKey : rows[0]?.key ?? null;
		this.applyRovingTabindex();
		this.revealPage(this.currentPage());
		this.restoreFocus();
	}

	private appendOutlineNodes(parent: HTMLElement, nodes: readonly OutlineNode[]): void {
		for (const node of nodes) {
			const key = outlineKey(node);
			const hasChildren = node.children.length > 0;
			const expanded = hasChildren && (this.outlineStyle !== 'tree' || !this.collapsed.has(key));
			const label = `${node.title}，第 ${node.page + 1} 页`;
			const item = parent.createEl('li', {
				cls: 'rd-outline-node',
				attr: { role: 'treeitem', tabindex: '-1', 'aria-current': 'false', 'aria-label': label, title: label, 'data-outline-key': key, 'data-nav-page': String(node.page) }
			});
			if (hasChildren) item.setAttribute('aria-expanded', String(expanded));
			const row = item.createDiv({ cls: 'rd-outline-row' });
			const gutter = row.createSpan({ cls: 'rd-outline-gutter', attr: { 'aria-hidden': 'true' } });
			if (hasChildren && this.outlineStyle === 'tree') {
				setIcon(gutter, 'chevron-right');
				gutter.addEventListener('click', () => {
					// Chevron focus policy: when DOM focus is not inside the tree at all
					// (typically BODY), the clicked parent treeitem takes focus and the tab
					// stop; an item already focused inside the tree is never stolen.
					const active = gutter.ownerDocument?.activeElement ?? null;
					if (!this.treeRoot?.contains(active)) {
						this.focusedKey = key;
						this.applyRovingTabindex();
						item.focus();
					}
					this.toggleNode(key, this.handles.get(key)?.item.getAttribute('aria-expanded') !== 'true');
				});
			}
			row.createSpan({ cls: 'rd-outline-title', text: node.title });
			row.createEl('span', { cls: 'rd-reader-outline__page', text: `p.${node.page + 1}` });
			let group: HTMLElement | null = null;
			if (hasChildren) {
				group = item.createEl('ul', { cls: 'rd-outline-group', attr: { role: 'group' } });
				group.hidden = !expanded;
				this.appendOutlineNodes(group, node.children);
			}
			this.handles.set(key, { item, group });
			// Roving invariant: whichever treeitem holds DOM focus owns the tab stop.
			item.addEventListener('focus', () => {
				this.focusedKey = key;
				this.applyRovingTabindex();
			});
			// Jumping belongs to the visible row: `item` wraps the whole subtree, so a
			// li-level listener would fire once per ancestor on a descendant click.
			// Only an interactive chevron (tree-style parents) may swallow the jump.
			const gutterToggles = hasChildren && this.outlineStyle === 'tree';
			row.addEventListener('click', event => {
				const origin = event.target as { closest?: (selector: string) => unknown } | null;
				if (gutterToggles && origin?.closest?.('.rd-outline-gutter')) return;
				this.focusedKey = key;
				this.applyRovingTabindex();
				item.focus();
				void this.goTo(node.page + 1);
			});
		}
	}

	/** Tree-only fold state; bullet outlines stay expanded and ignore the set. */
	private toggleNode(key: string, expand: boolean): void {
		if (expand) this.collapsed.delete(key);
		else this.collapsed.add(key);
		const handle = this.handles.get(key);
		handle?.item.setAttribute('aria-expanded', String(expand));
		if (handle?.group) handle.group.hidden = !expand;
		if (!expand) this.liftFocusFromSubtree(key, handle);
	}

	/** A fold must never leave the tab stop or DOM focus inside the hidden subtree. */
	private liftFocusFromSubtree(key: string, handle: OutlineHandles | undefined): void {
		const focused = this.focusedKey;
		if (!focused || focused === key) return;
		if (!ancestorKeys(outlineRows(this.displayTree), focused).includes(key)) return;
		this.focusedKey = key;
		this.applyRovingTabindex();
		const active = handle?.item.ownerDocument?.activeElement ?? null;
		if (handle?.group && active && handle.group.contains(active)) handle.item.focus();
	}

	/** Outline key of the treeitem holding DOM focus inside this container, if any. */
	private focusedNodeKey(container: HTMLElement): string | null {
		const active = container.ownerDocument?.activeElement ?? null;
		if (!active || !container.contains(active)) return null;
		const node = (active as { closest?: (selector: string) => { getAttribute?: (name: string) => string | null } | null }).closest?.('.rd-outline-node');
		return node?.getAttribute?.('data-outline-key') ?? null;
	}

	/** Rebuilds replace the tree DOM: carry DOM focus and the tab stop to the same node. */
	private restoreFocus(): void {
		const restore = this.restoreFocusKey;
		this.restoreFocusKey = null;
		if (!restore) return;
		const handle = this.handles.get(restore);
		if (!handle || !this.visibleRows().some(row => row.key === restore)) return;
		this.focusedKey = restore;
		this.applyRovingTabindex();
		handle.item.focus();
	}

	/** The current section's ancestor path is always open, so the marker stays reachable. */
	private expandActiveAncestors(activeKey: string): void {
		if (!this.collapsed.size) return;
		const full = outlineRows(this.displayTree);
		for (const key of ancestorKeys(full, activeKey)) {
			if (!this.collapsed.delete(key)) continue;
			const handle = this.handles.get(key);
			handle?.item.setAttribute('aria-expanded', 'true');
			if (handle?.group) handle.group.hidden = false;
		}
	}

	private visibleRows(): OutlineRow[] {
		return outlineRows(this.displayTree, this.outlineStyle === 'tree' ? this.collapsed : new Set<string>());
	}

	/** Roving tabindex: exactly one visible treeitem owns the tab stop. */
	private applyRovingTabindex(): void {
		for (const [key, handle] of this.handles) handle.item.setAttribute('tabindex', key === this.focusedKey ? '0' : '-1');
	}

	private onTreeKeydown(event: KeyboardEvent): void {
		const rows = this.visibleRows();
		const index = rows.findIndex(row => row.key === this.focusedKey);
		if (index === -1) return;
		const action = resolveOutlineKey(event.key, rows, index, this.outlineStyle);
		if (action.kind !== 'none') {
			event.preventDefault();
			if (action.kind === 'move') this.focusRow(rows[action.index]);
			else if (action.kind === 'toggle') this.toggleNode(rows[action.index].key, action.expand);
			else void this.goTo(rows[index].node.page + 1);
			return;
		}
		if (event.key === ' ' || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
		const now = Date.now();
		this.typeaheadBuffer = now - this.typeaheadAt > 600 ? event.key : this.typeaheadBuffer + event.key;
		this.typeaheadAt = now;
		const match = matchTypeahead(rows, this.typeaheadBuffer, index);
		if (match === null) return;
		event.preventDefault();
		this.focusRow(rows[match]);
	}

	private focusRow(row: OutlineRow): void {
		this.focusedKey = row.key;
		this.applyRovingTabindex();
		this.handles.get(row.key)?.item.focus();
	}

	private status(parent: HTMLElement, message: string, error = false): void {
		parent.createEl('p', { cls: error ? 'rd-error' : 'rd-empty', text: message, attr: { role: error ? 'alert' : 'status' } });
	}
}
