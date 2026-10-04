import type { LibraryBook, LibraryCategory, LibraryList, ShelfViewState } from '../types/contracts';
import { ShelfSearchController, sortCategories, ledgerStats, readLegacyShelfState } from './shelf/ShelfViewModel';
import { button, element, errorMessage, input } from '../ui/shelf/ShelfDom';
import type { ShelfViewHost } from '../ui/shelf/ShelfHost';
import { hasShelfFilters, pageBooks, queryBooks, type ShelfQuery } from '../ui/shelf/ShelfQuery';
import { createShelfFilters } from '../ui/shelf/ShelfFilters';
import { type ShelfBookContext } from '../ui/shelf/ShelfBooks';
import { ShelfDialog } from '../ui/shelf/ShelfDialog';
import { openBatchEditor } from '../ui/shelf/ShelfBatchEditor';
import { openRelinkDialog } from '../ui/shelf/ShelfRelink';
import { ShelfAnnotationSearch } from '../ui/shelf/ShelfAnnotationSearch';
import { ShelfBookDrafts } from '../ui/shelf/ShelfBookDrafts';
import { ShelfStatePersistence } from '../ui/shelf/ShelfStatePersistence';
import { openListManager } from '../ui/shelf/ShelfListManager';
import { createShelfCard } from './shelf/BookCard';
import { openShelfCategoryMenu } from './shelf/ShelfCategoryMenu';
import { createLedgerSummary, createLedgerTable } from './shelf/LedgerView';
import { createNavigationLayout } from './shelf/NavigationLayout';
import { createContinueReadingRail } from './shelf/ContinueReadingRail';
export type { ShelfViewHost } from '../ui/shelf/ShelfHost';

/** A framework-free shelf surface. LibraryIndex/AnnotationStore remain the sources. */
export class ShelfView {
	private container?: HTMLElement;
	private books: LibraryBook[] = [];
	private categories: LibraryCategory[] = [];
	private lists: LibraryList[] = [];
	private query: ShelfQuery = { query: '', sort: 'recent' };
	private mode: ShelfViewState['mode'] = 'cards';
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
	private readonly drafts = new ShelfBookDrafts();
	private readonly annotationSearch: ShelfAnnotationSearch;
	private readonly preferences: ShelfStatePersistence;
	private preferencesReady = false;
	private userStateChanged = false;
	private workflowExpanded = false;
	private selectionMode = false;
	private closeCategoryMenu?: () => void;
	private subtitle?: HTMLElement;
	constructor(private readonly host: ShelfViewHost) { this.annotationSearch = new ShelfAnnotationSearch(host); this.preferences = new ShelfStatePersistence(host); }

	async render(container: HTMLElement): Promise<void> { this.container = container; this.ensureShell(); await this.reload(); }
	destroy(): Promise<void> {
		if (this.preferencesReady || this.userStateChanged) this.preferences.record(this.viewState());
		this.generation++; this.closeCategoryMenu?.(); this.dialog?.close(false); this.annotationSearch.destroy(); this.drafts.clear();
		this.container?.replaceChildren(); this.container = undefined; this.content = undefined; this.toolbar = undefined;
		return this.preferences.flush();
	}
	private ensureShell(): void {
		const root = this.container; if (!root || this.content) return;
		root.replaceChildren(); root.className = 'rd-shelf';
		const frame = element('div', 'rd-shelf-frame'); const header = element('header', 'rd-shelf-header');
		const title = element('div', 'rd-shelf-title-wrap'); this.subtitle = element('p', 'rd-shelf-subtitle', '原文、摘录与进度在同一处'); title.append(element('h1', 'rd-shelf-heading', '书架'), this.subtitle); header.append(title);
		const actions = element('div', 'rd-shelf-actions'); const scan = button('扫描书库', '重新扫描书库', () => void this.scan()); scan.classList.add('rd-button--primary'); actions.append(scan);
		if (this.host.openSettings) actions.append(button('导入书籍', '导入书籍', () => void this.host.openSettings?.('data')), button('设置', '打开 Reading Desk 设置', () => void this.host.openSettings?.()));
		const annotations = button('摘录搜索', '摘录与评论', () => this.switchMode('annotations')); annotations.dataset.shelfMode = 'annotations'; actions.append(annotations); header.append(actions);
		this.search = input('search', '搜索书架'); this.search.placeholder = '搜索标题、作者或标签'; this.search.className = 'rd-shelf-search';
		this.search.addEventListener('compositionstart', () => this.searchController.beginComposition());
		this.search.addEventListener('compositionend', () => this.applySearch(true)); this.search.addEventListener('input', () => this.applySearch(false));
		this.toolbar = element('div', 'rd-shelf-toolbar'); this.toolbar.append(this.search);
		const modes = element('div', 'rd-view-switch'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', '书架视图');
		for (const [mode, label] of [['cards', '卡片视图'], ['table', '表格视图'], ['navigation', '导航视图']] as const) {
			const control = button(mode === 'table' ? '台账' : mode === 'cards' ? '卡片' : '导航', label, () => this.switchMode(mode));
			control.classList.add('rd-view-switch-button'); control.dataset.shelfMode = mode; modes.append(control);
		}
		this.toolbar.append(modes); this.content = element('div', 'rd-shelf-results'); frame.append(header, this.toolbar, this.preferences.root, this.content); root.append(frame);
	}
	private switchMode(mode: ShelfViewState['mode']): void { this.mode = mode; this.annotationSearch.destroy(); this.paintChanged(); }
	private applySearch(completed: boolean): void {
		const value = this.search?.value ?? '';
		const next = completed ? this.searchController.endComposition(value) : this.searchController.input(value);
		if (next !== null) { this.query.query = next; this.page = 1; this.paintChanged(); }
	}
	private async reload(initial = true): Promise<void> {
		const generation = ++this.generation;
		if (initial) { this.loading = true; this.paint(); }
		try {
			const [books, categories, lists, savedState] = await Promise.all([this.host.getBooks(), this.host.getCategories(), this.host.getLists?.() ?? [],
				this.readPreferences()]);
			if (generation !== this.generation || !this.container) return;
			this.books = books; this.categories = sortCategories(categories); this.lists = lists;
			this.restorePreferences(savedState);
			this.sanitizeFilters();
			const ids = new Set(books.map(book => book.id)); this.selected = new Set([...this.selected].filter(id => ids.has(id))); this.drafts.retainBooks(ids); this.error = undefined;
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
		this.drafts.clearBindings(); root.replaceChildren();
		for (const control of Array.from(this.container?.querySelectorAll<HTMLElement>('[data-shelf-mode]') ?? [])) {
			const selected = control.dataset.shelfMode === this.mode;
			control.setAttribute('aria-pressed', String(selected)); control.classList.toggle('is-selected', selected);
		}
		if (this.loading) root.append(this.state('正在加载书架…', 'status'));
		else if (this.error) {
			const state = this.state(this.error, 'alert'); state.append(button('重试', '重试加载书架', () => void this.reload())); root.append(state);
		} else if (this.mode === 'annotations') root.append(this.annotationSearch.render(this.books));
		else root.append(this.createContent());
		const controls = Array.from(root.querySelectorAll<HTMLElement>('input, select, button, article'));
		const equivalent = editor ? controls.find(node => node.dataset.editor === editor) : label ? controls.find(node => node.getAttribute('aria-label') === label) : undefined;
		equivalent?.focus();
		if (equivalent instanceof HTMLInputElement && selection && equivalent.type === 'text') equivalent.setSelectionRange(selection[0], selection[1]);
		if (this.preferencesReady && !this.loading && !this.error) this.preferences.record(this.viewState());
	}
	private async readPreferences(): Promise<ShelfViewState | undefined> {
		if (this.preferencesReady) return undefined;
		try { const saved = await this.host.readShelfState?.(); if (saved) return saved;
			const legacy = typeof localStorage === 'undefined' ? undefined : readLegacyShelfState(localStorage); if (legacy) { this.preferences.record(legacy); } return legacy; }
		catch (error) { this.preferences.message('无法读取书架视图：' + errorMessage(error)); return undefined; }
	}
	private restorePreferences(saved?: ShelfViewState): void {
		if (this.preferencesReady) return;
		const state: ShelfViewState = saved ?? { mode: 'cards', query: { query: '', sort: 'recent' }, page: 1 };
		this.preferences.initialize(state);
		if (!this.userStateChanged) { this.mode = state.mode; this.query = { ...state.query }; this.page = state.page; if (this.search) this.search.value = this.query.query; }
		this.preferencesReady = true;
	}
	private paintChanged(): void { this.userStateChanged = true; this.paint(); }
	private viewState(): ShelfViewState { return { mode: this.mode, query: { ...this.query }, page: this.page }; }
	private sanitizeFilters(): void {
		if (this.query.categoryId && !this.categories.some(item => item.id === this.query.categoryId)) delete this.query.categoryId;
		if (this.query.listId && !this.lists.some(item => item.id === this.query.listId)) delete this.query.listId;
		this.page = pageBooks(queryBooks(this.books, this.query), this.page).page;
	}
	private createContent(): HTMLElement {
		const content = element('div', 'rd-shelf-content'); const context = this.bookContext();
		const showRail = !hasShelfFilters({ ...this.query, historyOnly: false });
		const rail = showRail ? createContinueReadingRail(this.books.filter(book => !book.missing), !!this.query.historyOnly, { ...context, onToggleHistory: () => { this.query.historyOnly = !this.query.historyOnly; this.page = 1; this.paintChanged(); } }) : undefined;
		if (rail) content.append(rail);
		const books = queryBooks(this.books, this.query); const window = pageBooks(books, this.page); this.page = window.page;
		const heading = element('div', 'rd-section-heading'); const title = element('div', 'rd-section-title');
		title.append(element('h2', 'rd-section-heading-main', this.query.historyOnly ? '阅读记录' : this.mode === 'table' ? '书目台账' : '全部图书'), button(window.total + ' 本 · 按' + ({ recent: '最近阅读', title: '书名', author: '作者', rating: '评分', progress: '进度' }[this.query.historyOnly ? 'recent' : this.query.sort]) + '排序', '切换书架排序', () => { this.query.sort = this.query.sort === 'recent' ? 'title' : 'recent'; this.page = 1; this.paintChanged(); }));
		const sortControl = title.querySelector<HTMLButtonElement>('button'); sortControl?.classList.add('rd-section-note-button'); if (sortControl) sortControl.disabled = !!this.query.historyOnly;
		const actions = element('div', 'rd-shelf-actions'); const workflow = button('筛选与整理', '筛选与整理', () => { this.workflowExpanded = !this.workflowExpanded; this.paint(); }); workflow.setAttribute('aria-expanded', String(this.workflowExpanded)); actions.append(workflow, button(this.selectionMode ? '完成选择' : '批量选择', '切换批量选择', () => { this.selectionMode = !this.selectionMode; if (!this.selectionMode) this.selected.clear(); this.paint(); }));
		if (hasShelfFilters(this.query)) actions.append(button('清除筛选', '清除所有书架筛选', () => this.clearFilters())); heading.append(title, actions);
		const manage = button('管理分类', '管理分类', () => this.manageCategories(manage)); actions.append(manage);
		if (this.mode !== 'navigation') content.append(this.createCategoryPanel());
		const controls = element('div', 'rd-shelf-workflow'); controls.hidden = !this.workflowExpanded && !this.selectionMode;
		const filters = createShelfFilters(this.books, this.lists, this.query, patch => { Object.assign(this.query, patch); this.page = 1; this.paintChanged(); }); filters.hidden = !this.workflowExpanded; controls.append(filters, this.createSelectionBar(window.items, books)); content.append(controls);
		const empty = this.state(this.books.length ? '没有符合当前筛选的图书。' : '书库尚无图书。设置文件夹后扫描书库。', 'status');
		if (!this.books.length) empty.append(button('扫描书库', '扫描空书库', () => void this.scan()));
		if (this.mode === 'navigation') {
			content.append(createNavigationLayout({ books: window.items, allBooks: this.books, categories: this.categories, selectedCategoryId: this.query.categoryId, mainHeading: heading, emptyState: empty,
				host: { ...context, onSelectCategory: id => { this.query.categoryId = id; this.page = 1; this.paintChanged(); } } }));
		} else {
			if (this.mode === 'table') content.append(createLedgerSummary(ledgerStats(this.books, this.host.countHighlights?.() ?? 0)));
			content.append(heading);
			if (!books.length) content.append(empty);
			else if (this.mode === 'table') content.append(createLedgerTable(window.items, context));
			else { const grid = element('div', 'rd-shelf-grid'); grid.setAttribute('aria-label', '图书卡片'); for (const book of window.items) grid.append(createShelfCard(book, this.categories.find(item => item.id === book.categoryId), context)); content.append(grid); }
		}
		content.append(this.createPagination(window.pages)); return content;
	}
	private createCategoryPanel(): HTMLElement {
		const panel = element('section', 'rd-category-panel rd-category-chips'); panel.setAttribute('aria-label', '图书分类');
		const category = (id: string | undefined, name: string): void => {
			const control = button(name, name, () => { this.query.categoryId = id; this.page = 1; this.paintChanged(); });
			control.classList.add('rd-category-chip'); control.setAttribute('aria-pressed', String(this.query.categoryId === id)); control.classList.toggle('is-selected', this.query.categoryId === id); panel.append(control);
		}; category(undefined, '全部 ' + this.books.length);
		for (const item of this.categories) {
			category(item.id, item.name + ' ' + this.books.filter(book => book.categoryId === item.id).length);
			const chip = panel.lastElementChild as HTMLElement;
			const menu = (event: Event): void => { event.preventDefault(); if (!this.container) return; this.closeCategoryMenu?.(); this.closeCategoryMenu = openShelfCategoryMenu(this.container, chip, item, this.categories, this.host, () => this.reload(false)); };
			chip.addEventListener('contextmenu', menu); chip.addEventListener('keydown', event => { if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) menu(event); });
		}

		const create = button('+', '新建分类', () => this.manageCategories(create)); create.classList.add('rd-category-chip', 'rd-category-chip-add'); panel.append(create); return panel;
	}
	private createSelectionBar(visible: LibraryBook[], filtered: LibraryBook[]): HTMLElement {
		const bar = element('div', 'rd-shelf-selection-bar');
		this.batchCount = element('span', '', '已选 ' + this.selected.size + ' 本'); this.batchCount.setAttribute('aria-live', 'polite');
		this.batchButton = button('批量整理', '批量整理已选图书', () => {
			if (!this.container || !this.batchButton) return;
			this.dialog?.close(false); this.dialog = openBatchEditor(this.container, this.batchButton, this.books.filter(book => this.selected.has(book.id)), this.categories, this.lists, this.host, () => this.reload(false));
		}); this.batchButton.disabled = !this.selected.size || !this.host.batchUpdate;
		const choose = (items: LibraryBook[]): void => { this.selectionMode = true; for (const book of items) this.selected.add(book.id); this.paint(); };
		bar.append(this.batchCount, button('选择本页', '批量选择本页', () => choose(visible)), button('选择筛选结果', '批量选择全部 ' + filtered.length + ' 本筛选结果', () => choose(filtered)), button('取消选择', '取消全部批量选择', () => { this.selected.clear(); this.syncSelection(); }), this.batchButton);
		if (this.host.createList) {
			const create = button('新建阅读列表', '新建阅读列表', () => this.createList(create)); bar.append(create);
		}
		if (this.host.renameList || this.host.deleteList) {
			const manage = button('管理阅读列表', '管理阅读列表', () => {
				if (!this.container) return; this.dialog?.close(false);
				this.dialog = openListManager(this.container, manage, () => this.lists, () => this.books, this.host, () => this.reload(false));
			}); bar.append(manage);
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
		return { host: this.host, categories: this.categories, lists: this.lists, selected: this.selected, selectionMode: this.selectionMode, drafts: this.drafts,
			onSelect: (id, checked) => { if (checked) this.selected.add(id); else this.selected.delete(id); this.syncSelection(); },
			onOpen: book => void this.openBook(book), onRelink: (book, trigger) => this.relink(book, trigger), onChanged: () => void this.reload(false) };
	}
	private createPagination(pages: number): HTMLElement {
		const nav = element('nav', 'rd-shelf-pagination'); nav.setAttribute('aria-label', '书架分页');
		const go = (page: number): void => { this.page = page; this.paintChanged(); this.content?.querySelector<HTMLElement>('.rd-shelf-grid .rd-shelf-card, .rd-library-table input[data-select-book]')?.focus(); };
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
				const row = element('li', 'rd-category-order-row'); const title = element('span', '', category.name + ' · ' + this.books.filter(book => book.categoryId === category.id).length + ' 本'); row.append(title);
				for (const [delta, label] of [[-1, '上移'], [1, '下移']] as const) {
					const move = button(label, category.name + label, async () => {
						const reordered = [...this.categories]; const [moved] = reordered.splice(index, 1); reordered.splice(index + delta, 0, moved);
						try { await this.host.reorderCategories(reordered.map(item => item.id)); await this.reload(false); drawOrder(); Array.from(order.querySelectorAll<HTMLButtonElement>('button')).find(control => control.getAttribute('aria-label') === category.name + label)?.focus(); }
						catch (error) { status.textContent = errorMessage(error); }
					}); move.disabled = index + delta < 0 || index + delta >= this.categories.length; row.append(move);
				}
				if (this.host.renameCategory) row.append(button('改名', '重命名分类 ' + category.name, () => {
					const edit = input('text', '分类名称 ' + category.name, category.name); const save = button('保存', '保存分类名称 ' + category.name, async () => {
						try { await this.host.renameCategory?.(category.id, edit.value.trim()); await this.reload(false); drawOrder(); status.textContent = '分类已改名'; }
						catch (error) { status.textContent = errorMessage(error); }
					}); row.append(edit, save); edit.focus();
				}));
				if (this.host.removeCategory) {
					let armed = false; const remove = button('删除', '删除分类 ' + category.name, async () => {
						if (!armed) { armed = true; remove.textContent = '确认删除'; status.textContent = '删除后此分类的图书将变为未分类，图书会保留。'; return; }
						try { await this.host.removeCategory?.(category.id); await this.reload(false); drawOrder(); status.textContent = '分类已删除，图书已保留'; }
						catch (error) { status.textContent = errorMessage(error); }
					}); row.append(remove);
				}
				order.append(row);
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
	private clearFilters(): void { this.query = { query: '', sort: this.query.sort }; this.page = 1; if (this.search) this.search.value = ''; this.paintChanged(); }
	private state(message: string, role: string): HTMLElement { const state = element('div', 'rd-shelf-state', message); state.setAttribute('role', role); return state; }
}
