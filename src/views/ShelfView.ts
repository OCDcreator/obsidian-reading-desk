import type { LibraryBook, LibraryCategory, LibraryList } from '../types/contracts';
import { ShelfSearchController, sortCategories } from './shelf/ShelfViewModel';
import { button, element, errorMessage, input } from '../ui/shelf/ShelfDom';
import type { ShelfViewHost } from '../ui/shelf/ShelfHost';
import { CONTINUE_LIMIT, hasShelfFilters, pageBooks, queryBooks, type ShelfQuery } from '../ui/shelf/ShelfQuery';
import { createShelfFilters } from '../ui/shelf/ShelfFilters';
import { createBookCard, createBookTable, type ShelfBookContext } from '../ui/shelf/ShelfBooks';
import { ShelfDialog } from '../ui/shelf/ShelfDialog';
import { openBatchEditor } from '../ui/shelf/ShelfBatchEditor';
import { openRelinkDialog } from '../ui/shelf/ShelfRelink';
import { ShelfAnnotationSearch } from '../ui/shelf/ShelfAnnotationSearch';
export type { ShelfViewHost } from '../ui/shelf/ShelfHost';

/** A framework-free shelf surface. LibraryIndex/AnnotationStore remain the sources. */
export class ShelfView {
	private container?: HTMLElement;
	private books: LibraryBook[] = [];
	private categories: LibraryCategory[] = [];
	private lists: LibraryList[] = [];
	private query: ShelfQuery = { query: '', sort: 'title' };
	private mode: 'cards' | 'table' | 'annotations' = 'cards';
	private page = 1;
	private selected = new Set<string>();
	private loading = false;
	private generation = 0;
	private error?: string;
	private content?: HTMLElement;
	private toolbar?: HTMLElement;
	private search?: HTMLInputElement;
	private batchCount?: HTMLElement;
	private batchButton?: HTMLButtonElement;
	private dialog?: ShelfDialog;
	private readonly searchController = new ShelfSearchController();
	private readonly annotationSearch: ShelfAnnotationSearch;
	constructor(private readonly host: ShelfViewHost) { this.annotationSearch = new ShelfAnnotationSearch(host); }

	async render(container: HTMLElement): Promise<void> { this.container = container; this.ensureShell(); await this.reload(); }
	destroy(): void {
		this.generation++; this.dialog?.close(false); this.annotationSearch.destroy();
		this.container?.replaceChildren(); this.container = undefined; this.content = undefined; this.toolbar = undefined;
	}
	private ensureShell(): void {
		const root = this.container; if (!root || this.content) return;
		root.replaceChildren(); root.className = 'rd-shelf';
		const header = element('header', 'rd-shelf-header'); header.append(element('h1', 'rd-shelf-heading', '书架'));
		const actions = element('div', 'rd-shelf-actions'); actions.append(button('扫描书库', '重新扫描书库', () => void this.scan()));
		if (this.host.openSettings) actions.append(button('设置', '打开 Reading Desk 设置', () => void this.host.openSettings?.())); header.append(actions);
		this.search = input('search', '搜索书架'); this.search.placeholder = '搜索标题、作者或标签'; this.search.className = 'rd-shelf-search';
		this.search.addEventListener('compositionstart', () => this.searchController.beginComposition());
		this.search.addEventListener('compositionend', () => this.applySearch(true)); this.search.addEventListener('input', () => this.applySearch(false));
		this.toolbar = element('div', 'rd-shelf-toolbar'); this.toolbar.append(this.search);
		const modes = element('div', 'rd-view-switch'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', '书架视图');
		for (const [mode, label] of [['cards', '卡片视图'], ['table', '表格视图'], ['annotations', '摘录与评论']] as const) {
			const control = button(label, label, () => { this.mode = mode; this.annotationSearch.destroy(); this.paint(); });
			control.dataset.shelfMode = mode; modes.append(control);
		}
		this.toolbar.append(modes); this.content = element('div', 'rd-shelf-results'); root.append(header, this.toolbar, this.content);
	}
	private applySearch(completed: boolean): void {
		const value = this.search?.value ?? '';
		const next = completed ? this.searchController.endComposition(value) : this.searchController.input(value);
		if (next !== null) { this.query.query = next; this.page = 1; this.paint(); }
	}
	private async reload(initial = true): Promise<void> {
		const generation = ++this.generation;
		if (initial) { this.loading = true; this.paint(); }
		try {
			const [books, categories, lists] = await Promise.all([this.host.getBooks(), this.host.getCategories(), this.host.getLists?.() ?? []]);
			if (generation !== this.generation || !this.container) return;
			this.books = books; this.categories = sortCategories(categories); this.lists = lists;
			const ids = new Set(books.map(book => book.id)); this.selected = new Set([...this.selected].filter(id => ids.has(id))); this.error = undefined;
		} catch (error) { if (generation === this.generation) this.error = errorMessage(error, '无法加载书架'); }
		finally { if (generation === this.generation) { this.loading = false; this.paint(); } }
	}
	private paint(): void {
		const root = this.content; if (!root) return;
		if (this.search) this.search.hidden = this.mode === 'annotations';
		// Restore the equivalent control after metadata/filter refreshes rather than stealing focus.
		const active = root.ownerDocument.activeElement as HTMLElement | null;
		const label = active && root.contains(active) ? active.getAttribute('aria-label') : null;
		const editor = active && root.contains(active) ? active.dataset.editor : undefined;
		const selection = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : undefined;
		root.replaceChildren();
		for (const control of Array.from(this.toolbar?.querySelectorAll<HTMLElement>('[data-shelf-mode]') ?? [])) control.setAttribute('aria-pressed', String(control.dataset.shelfMode === this.mode));
		if (this.loading) root.append(this.state('正在加载书架…', 'status'));
		else if (this.error) {
			const state = this.state(this.error, 'alert'); state.append(button('重试', '重试加载书架', () => void this.reload())); root.append(state);
		} else if (this.mode === 'annotations') root.append(this.annotationSearch.render(this.books));
		else root.append(this.createContent());
		const controls = Array.from(root.querySelectorAll<HTMLElement>('input, select, button, article'));
		const equivalent = editor ? controls.find(node => node.dataset.editor === editor) : label ? controls.find(node => node.getAttribute('aria-label') === label) : undefined;
		equivalent?.focus();
		if (equivalent instanceof HTMLInputElement && selection && equivalent.type === 'text') equivalent.setSelectionRange(selection[0], selection[1]);
	}
	private createContent(): HTMLElement {
		const content = element('div', 'rd-shelf-content'); const context = this.bookContext();
		if (!hasShelfFilters(this.query)) {
			const books = this.books.filter(book => !book.missing && book.progress > 0 && book.progress < 1).sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0)).slice(0, CONTINUE_LIMIT);
			if (books.length) {
				const rail = element('section', 'rd-continue-reading'); rail.setAttribute('aria-label', '继续阅读'); rail.append(element('h2', 'rd-section-title', '继续阅读'));
				const items = element('div', 'rd-continue-reading-list'); for (const book of books) items.append(createBookCard(book, context, true)); rail.append(items); content.append(rail);
			}
		}
		content.append(this.createCategoryPanel(), createShelfFilters(this.books, this.lists, this.query, patch => { Object.assign(this.query, patch); this.page = 1; this.paint(); }));
		const books = queryBooks(this.books, this.query); const window = pageBooks(books, this.page); this.page = window.page;
		const summary = element('div', 'rd-shelf-summary'); summary.append(element('span', '', '显示 ' + window.items.length + ' / ' + window.total + ' 本'));
		if (hasShelfFilters(this.query)) summary.append(button('清除筛选', '清除所有书架筛选', () => this.clearFilters())); content.append(summary, this.createSelectionBar(window.items, books));
		if (!books.length) {
			const empty = this.state(this.books.length ? '没有符合当前筛选的图书。' : '书库尚无图书。设置文件夹后扫描书库。', 'status');
			if (!this.books.length) empty.append(button('扫描书库', '扫描空书库', () => void this.scan())); content.append(empty);
		} else if (this.mode === 'table') content.append(createBookTable(window.items, context));
		else { const grid = element('div', 'rd-shelf-grid'); grid.setAttribute('aria-label', '图书卡片'); for (const book of window.items) grid.append(createBookCard(book, context)); content.append(grid); }
		content.append(this.createPagination(window.pages)); return content;
	}
	private createCategoryPanel(): HTMLElement {
		const panel = element('section', 'rd-category-panel'); panel.setAttribute('aria-label', '图书分类');
		const category = (id: string | undefined, name: string): void => {
			const control = button(name, name, () => { this.query.categoryId = id; this.page = 1; this.paint(); });
			control.classList.add('rd-category-chip'); control.setAttribute('aria-pressed', String(this.query.categoryId === id)); panel.append(control);
		}; category(undefined, '全部 ' + this.books.length);
		for (const item of this.categories) category(item.id, item.name + ' ' + this.books.filter(book => book.categoryId === item.id).length);
		const manage = button('管理分类', '管理分类', () => this.manageCategories(manage)); panel.append(manage); return panel;
	}
	private createSelectionBar(visible: LibraryBook[], filtered: LibraryBook[]): HTMLElement {
		const bar = element('div', 'rd-shelf-selection-bar');
		this.batchCount = element('span', '', '已选 ' + this.selected.size + ' 本'); this.batchCount.setAttribute('aria-live', 'polite');
		this.batchButton = button('批量整理', '批量整理已选图书', () => {
			if (!this.container || !this.batchButton) return;
			this.dialog?.close(false); this.dialog = openBatchEditor(this.container, this.batchButton, this.books.filter(book => this.selected.has(book.id)), this.categories, this.lists, this.host, () => this.reload(false));
		}); this.batchButton.disabled = !this.selected.size || !this.host.batchUpdate;
		const choose = (items: LibraryBook[]): void => { for (const book of items) this.selected.add(book.id); this.syncSelection(); };
		bar.append(this.batchCount, button('选择本页', '批量选择本页', () => choose(visible)), button('选择筛选结果', '批量选择全部 ' + filtered.length + ' 本筛选结果', () => choose(filtered)), button('取消选择', '取消全部批量选择', () => { this.selected.clear(); this.syncSelection(); }), this.batchButton);
		if (this.host.createList) {
			const create = button('新建阅读列表', '新建阅读列表', () => this.createList(create)); bar.append(create);
		}
		return bar;
	}
	private syncSelection(): void {
		if (this.batchCount) this.batchCount.textContent = '已选 ' + this.selected.size + ' 本';
		if (this.batchButton) this.batchButton.disabled = !this.selected.size || !this.host.batchUpdate;
		for (const node of Array.from(this.content?.querySelectorAll<HTMLElement>('[data-book-id]') ?? [])) node.classList.toggle('is-selected', this.selected.has(node.dataset.bookId ?? ''));
		for (const node of Array.from(this.content?.querySelectorAll<HTMLInputElement>('[data-select-book]') ?? [])) node.checked = this.selected.has(node.dataset.selectBook ?? '');
	}
	private bookContext(): ShelfBookContext {
		return { host: this.host, categories: this.categories, lists: this.lists, selected: this.selected,
			onSelect: (id, checked) => { if (checked) this.selected.add(id); else this.selected.delete(id); this.syncSelection(); },
			onOpen: book => void this.openBook(book), onRelink: (book, trigger) => this.relink(book, trigger), onChanged: () => void this.reload(false) };
	}
	private createPagination(pages: number): HTMLElement {
		const nav = element('nav', 'rd-shelf-pagination'); nav.setAttribute('aria-label', '书架分页');
		const go = (page: number): void => { this.page = page; this.paint(); this.content?.querySelector<HTMLElement>('.rd-shelf-card, .rd-library-table button')?.focus(); };
		const prev = button('上一页', '上一页图书', () => go(this.page - 1)); prev.disabled = this.page <= 1;
		const next = button('下一页', '下一页图书', () => go(this.page + 1)); next.disabled = this.page >= pages;
		nav.append(prev, element('span', '', this.page + ' / ' + pages + ' 页 · 每页最多 40 本'), next); return nav;
	}
	private manageCategories(trigger: HTMLElement): void {
		if (!this.container) return; this.dialog?.close(false); const dialog = new ShelfDialog(this.container, '管理分类', trigger); this.dialog = dialog;
		const name = input('text', '新分类名称'); const status = this.state('', 'status');
		const order = element('ol', 'rd-category-order');
		const drawOrder = (): void => {
			order.replaceChildren();
			this.categories.forEach((category, index) => {
				const row = element('li', 'rd-category-order-row', category.name);
				for (const [delta, label] of [[-1, '上移'], [1, '下移']] as const) {
					const move = button(label, category.name + label, async () => {
						const reordered = [...this.categories]; const [moved] = reordered.splice(index, 1); reordered.splice(index + delta, 0, moved);
						try { await this.host.reorderCategories(reordered.map(item => item.id)); await this.reload(false); drawOrder(); Array.from(order.querySelectorAll<HTMLButtonElement>('button')).find(control => control.getAttribute('aria-label') === category.name + label)?.focus(); }
						catch (error) { status.textContent = errorMessage(error); }
					}); move.disabled = index + delta < 0 || index + delta >= this.categories.length; row.append(move);
				} order.append(row);
			});
		}; drawOrder();
		const add = async (): Promise<void> => {
			if (!name.value.trim()) return;
			try { await this.host.addCategory(name.value.trim()); name.value = ''; await this.reload(false); drawOrder(); status.textContent = '分类已保存'; name.focus(); }
			catch (error) { status.textContent = errorMessage(error); }
		};
		name.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); void add(); } });
		dialog.body.append(name, button('新增分类', '新增分类', () => void add()), order, status); dialog.focusFirst();
	}
	private createList(trigger: HTMLElement): void {
		if (!this.container) return; this.dialog?.close(false); const dialog = new ShelfDialog(this.container, '新建阅读列表', trigger); this.dialog = dialog;
		const name = input('text', '阅读列表名称'); const status = this.state('', 'status');
		const save = button('创建列表', '创建阅读列表', async () => {
			if (!name.value.trim()) return; save.disabled = true;
			try { await this.host.createList?.(name.value.trim()); await this.reload(false); dialog.close(); }
			catch (error) { status.textContent = errorMessage(error); save.disabled = false; }
		}); dialog.body.append(name, save, status); dialog.focusFirst();
	}
	private relink(book: LibraryBook, trigger: HTMLElement): void {
		if (!this.container) return; this.dialog?.close(false); this.dialog = openRelinkDialog(this.container, trigger, book, this.host, () => this.reload(false));
	}
	private async openBook(book: LibraryBook): Promise<void> {
		try { await this.host.openBook(book); } catch (error) { this.error = errorMessage(error, '无法打开图书'); this.paint(); }
	}
	private async scan(): Promise<void> {
		try { await this.host.scan(); await this.reload(); } catch (error) { this.error = errorMessage(error, '扫描书库失败'); this.paint(); }
	}
	private clearFilters(): void { this.query = { query: '', sort: this.query.sort }; this.page = 1; if (this.search) this.search.value = ''; this.paint(); }
	private state(message: string, role: string): HTMLElement { const state = element('div', 'rd-shelf-state', message); state.setAttribute('role', role); return state; }
}
