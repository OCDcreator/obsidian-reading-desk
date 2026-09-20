import { Notice, setIcon } from 'obsidian';
import type { LibraryBook, LibraryCategory } from '../types/contracts';
import { createShelfCard, type BookCardHost } from './shelf/BookCard';
import { createCategoryChips } from './shelf/CategoryChips';
import { openCategoryManager } from './shelf/CategoryManagerModal';
import { createContinueReadingRail } from './shelf/ContinueReadingRail';
import { createLedgerSummary, createLedgerTable } from './shelf/LedgerView';
import { createNavigationLayout } from './shelf/NavigationLayout';
import { button, documentInput, element, errorMessage, linkButton, showActionMenu } from './shelf/ShelfDom';
import { SHELF_SORT_LABELS, sortBooks } from './shelf/ShelfSorting';
import {
	filterBooks,
	ledgerStats,
	ShelfSearchController,
	ShelfViewStateStore,
	shouldShowContinueReading,
	sortCategories,
	type ShelfFilters,
	type ShelfLayout,
	type ShelfSortMode
} from './shelf/ShelfViewModel';

type Awaitable<T> = T | Promise<T>;

export interface ShelfViewHost {
	getBooks(): Awaitable<LibraryBook[]>;
	getCategories(): Awaitable<LibraryCategory[]>;
	addCategory(name: string): Awaitable<LibraryCategory>;
	renameCategory(id: string, name: string): Awaitable<void>;
	removeCategory(id: string): Awaitable<void>;
	reorderCategories(ids: string[]): Awaitable<void>;
	updateBook(id: string, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'tags' | 'rating' | 'categoryId'>>): Awaitable<void>;
	openBook(book: LibraryBook): Awaitable<void>;
	scan(): Awaitable<void>;
	countHighlights(): Awaitable<number>;
	resolveCoverUrl?(coverPath: string): string | null;
	openSettings?(tab?: string): Awaitable<void>;
}

const LAYOUT_LABELS: Array<{ mode: ShelfLayout; label: string }> = [
	{ mode: 'cards', label: '卡片' },
	{ mode: 'ledger', label: '台账' },
	{ mode: 'navigation', label: '导航' }
];

/** A framework-free shelf surface. Its host owns persistence and navigation; this class only orchestrates. */
export class ShelfView {
	private container?: HTMLElement;
	private books: LibraryBook[] = [];
	private categories: LibraryCategory[] = [];
	private highlightCount = 0;
	private query = '';
	private categoryId?: string;
	private layout: ShelfLayout;
	private sortMode: ShelfSortMode;
	private historyOnly = false;
	private selectedBookId?: string;
	private loading = false;
	private error?: string;
	private header?: HTMLElement;
	private toolbar?: HTMLElement;
	private modeHost?: HTMLElement;
	private content?: HTMLElement;
	private search?: HTMLInputElement;
	private readonly searchController = new ShelfSearchController();
	private readonly stateStore: ShelfViewStateStore;

	constructor(private readonly host: ShelfViewHost) {
		this.stateStore = new ShelfViewStateStore(window.localStorage);
		this.layout = this.stateStore.readLayout();
		this.sortMode = this.stateStore.readSortMode();
	}

	async render(container: HTMLElement): Promise<void> {
		this.container = container;
		await this.reload();
	}

	destroy(): void {
		if (this.container) this.container.replaceChildren();
		this.container = undefined;
		this.header = undefined;
		this.toolbar = undefined;
		this.modeHost = undefined;
		this.content = undefined;
		this.search = undefined;
	}

	private async reload(): Promise<void> {
		this.loading = true;
		this.error = undefined;
		this.paint();
		try {
			const [books, categories, highlights] = await Promise.all([
				this.host.getBooks(),
				this.host.getCategories(),
				this.host.countHighlights()
			]);
			this.books = books;
			this.categories = sortCategories(categories);
			this.highlightCount = highlights;
		} catch (error) {
			this.error = errorMessage(error, '无法加载书架');
		} finally {
			this.loading = false;
			this.paint();
		}
	}

	private paint(): void {
		const container = this.container;
		if (!container) return;
		this.ensureShell(container);
		this.refreshModeSwitch();
		this.refreshContent();
	}

	private ensureShell(container: HTMLElement): void {
		if (this.content && this.content.closest('.rd-shelf') === container) return;
		container.replaceChildren();
		container.className = 'rd-shelf';
		const frame = element('div', 'rd-shelf-frame');
		this.header = this.createHeader();
		this.toolbar = this.createToolbar();
		this.content = element('div', 'rd-shelf-results');
		frame.append(this.header, this.toolbar, this.content);
		container.append(frame);
	}

	private refreshModeSwitch(): void {
		if (!this.modeHost) return;
		this.modeHost.replaceChildren(this.createModeSwitch());
	}

	private refreshContent(): void {
		if (!this.content) return;
		this.content.replaceChildren();
		if (this.error) this.content.append(this.createErrorState());
		else if (this.loading) this.content.append(this.createLoadingState());
		else this.content.append(this.createContent());
	}

	private createHeader(): HTMLElement {
		const header = element('header', 'rd-shelf-header');
		const titleWrap = element('div', 'rd-shelf-title-wrap');
		titleWrap.append(element('h1', 'rd-shelf-heading', '书架'), element('p', 'rd-shelf-subtitle', '原文、摘录与进度在同一处'));
		const actions = element('div', 'rd-shelf-actions');
		const scan = button('扫描书库', '重新扫描书库', () => void this.scan());
		scan.classList.add('rd-button--primary');
		scan.prepend(iconSpan('scan-line'));
		actions.append(scan);
		const importButton = button('导入', '打开设置中的数据与迁移', () => void this.host.openSettings?.('data'));
		importButton.prepend(iconSpan('import'));
		actions.append(importButton);
		actions.append(this.createMoreMenuButton());
		header.append(titleWrap, actions);
		return header;
	}

	private createMoreMenuButton(): HTMLButtonElement {
		const more = button('更多操作', '更多操作', () => showActionMenu(more, [
			{ label: '设置', onClick: () => void this.host.openSettings?.('library') },
			{ label: '扫描书库', onClick: () => void this.scan() }
		]));
		more.classList.add('rd-icon-button');
		more.replaceChildren(iconSpan('more-horizontal'));
		return more;
	}

	private createToolbar(): HTMLElement {
		const toolbar = element('div', 'rd-shelf-toolbar');
		toolbar.setAttribute('role', 'search');
		this.search = documentInput('search', '搜索书名、作者或标签');
		this.search.className = 'rd-shelf-search';
		this.search.value = this.query;
		this.search.setAttribute('aria-label', '搜索书架');
		this.search.addEventListener('compositionstart', () => this.searchController.beginComposition());
		this.search.addEventListener('compositionend', () => this.applySearch(this.search?.value ?? '', true));
		this.search.addEventListener('input', () => this.applySearch(this.search?.value ?? '', false));
		this.modeHost = element('div', 'rd-shelf-mode-host');
		toolbar.append(this.search, this.modeHost);
		return toolbar;
	}

	private applySearch(value: string, compositionEnded: boolean): void {
		const next = compositionEnded ? this.searchController.endComposition(value) : this.searchController.input(value);
		if (next === null) return;
		this.query = next;
		this.refreshContent();
	}

	private createModeSwitch(): HTMLElement {
		const group = element('div', 'rd-view-switch');
		group.setAttribute('role', 'group');
		group.setAttribute('aria-label', '书架视图');
		for (const { mode, label } of LAYOUT_LABELS) {
			const control = button(label, `${label}视图`, () => {
				this.layout = mode;
				this.stateStore.writeLayout(mode);
				this.paint();
			});
			control.classList.add('rd-view-switch-button');
			control.setAttribute('aria-pressed', String(this.layout === mode));
			if (this.layout === mode) control.classList.add('is-selected');
			group.append(control);
		}
		return group;
	}

	private createContent(): HTMLElement {
		const content = element('div', 'rd-shelf-content');
		const filters: ShelfFilters = { query: this.query, categoryId: this.categoryId, historyOnly: this.historyOnly };
		const filtered = sortBooks(filterBooks(this.books, filters), this.historyOnly ? 'recent' : this.sortMode);
		if (this.layout === 'navigation') {
			const section = element('section', 'rd-shelf-section');
			section.setAttribute('aria-label', '全部图书');
			section.append(createNavigationLayout({
				books: filtered,
				allBooks: this.books,
				categories: this.categories,
				selectedCategoryId: this.categoryId,
				mainHeading: this.createLibraryHeading(filtered.length, '全部图书'),
				host: { ...this.cardHost(), onSelectCategory: id => this.setCategoryFilter(id) }
			}));
			if (filtered.length === 0) section.append(this.createEmptyState());
			content.append(section);
			return content;
		}
		if (this.layout === 'cards' && shouldShowContinueReading(filters)) {
			const rail = createContinueReadingRail(this.books, this.historyOnly, {
				...this.cardHost(),
				onToggleHistory: () => this.setHistoryFilter(!this.historyOnly)
			});
			if (rail) content.append(rail);
		}
		content.append(this.createChips());
		const section = element('section', 'rd-shelf-section');
		section.setAttribute('aria-label', this.layout === 'ledger' ? '书目台账' : '全部图书');
		section.append(this.createLibraryHeading(filtered.length, this.layout === 'ledger' ? '书目台账' : '全部图书'));
		if (this.layout === 'ledger') content.append(createLedgerSummary(ledgerStats(this.books, this.highlightCount)));
		section.append(this.createResults(filtered));
		content.append(section);
		return content;
	}

	private createLibraryHeading(count: number, title: string): HTMLElement {
		const heading = element('div', 'rd-section-heading');
		const headingTitle = element('div', 'rd-section-title');
		headingTitle.append(element('h2', 'rd-section-heading-main', title));
		const note = this.historyOnly
			? `仅含阅读记录 · ${count} 本 · 按${SHELF_SORT_LABELS.recent}排序`
			: `${count} 本 · 按${SHELF_SORT_LABELS[this.sortMode]}排序${title === '书目台账' && this.hasActiveFilters() ? ' · 摘要为全库口径' : ''}`;
		if (this.historyOnly) {
			headingTitle.append(element('span', 'rd-section-note', note));
		} else {
			const toggle = button(note, `切换排序（当前：${SHELF_SORT_LABELS[this.sortMode]}）`, () => this.toggleSort());
			toggle.classList.add('rd-section-note', 'rd-section-note-button');
			headingTitle.append(toggle);
		}
		heading.append(headingTitle);
		if (title === '全部图书') heading.append(linkButton('管理分类', '打开分类管理面板', () => this.openManager()));
		return heading;
	}

	private createChips(): HTMLElement {
		return createCategoryChips({
			books: this.books,
			categories: this.categories,
			selectedId: this.categoryId,
			onSelect: id => this.setCategoryFilter(id),
			addCategory: async name => { await this.host.addCategory(name); await this.reload(); },
			renameCategory: async (id, name) => { await this.host.renameCategory(id, name); await this.reload(); },
			removeCategory: async id => { await this.host.removeCategory(id); await this.reload(); },
			reorderCategories: async ids => { await this.host.reorderCategories(ids); await this.reload(); },
			notify: message => this.notify(message)
		});
	}

	private openManager(): void {
		openCategoryManager({
			getBooks: () => this.books,
			getCategories: () => this.categories,
			addCategory: async name => { await this.host.addCategory(name); },
			renameCategory: async (id, name) => { await this.host.renameCategory(id, name); },
			removeCategory: async id => { await this.host.removeCategory(id); },
			reorderCategories: async ids => { await this.host.reorderCategories(ids); },
			notify: message => this.notify(message),
			refresh: () => this.reload()
		});
	}

	private createResults(filtered: LibraryBook[]): HTMLElement {
		if (filtered.length === 0) return this.createEmptyState();
		if (this.layout === 'ledger') return createLedgerTable(filtered, this.categories, this.cardHost());
		const grid = element('div', 'rd-shelf-grid');
		grid.setAttribute('aria-label', '图书卡片');
		for (const book of filtered) {
			grid.append(createShelfCard(book, this.categories.find(category => category.id === book.categoryId), this.cardHost()));
		}
		return grid;
	}

	private cardHost(): BookCardHost {
		return {
			resolveCoverUrl: path => this.host.resolveCoverUrl?.(path) ?? null,
			updateBook: (book, patch, onError) => this.updateBook(book, patch, onError),
			openBook: book => this.openBook(book)
		};
	}

	private setCategoryFilter(id?: string): void {
		this.categoryId = id;
		this.refreshContent();
	}

	private setHistoryFilter(active: boolean): void {
		this.historyOnly = active;
		this.refreshContent();
	}

	private toggleSort(): void {
		this.sortMode = this.sortMode === 'recent' ? 'title' : 'recent';
		this.stateStore.writeSortMode(this.sortMode);
		this.refreshContent();
	}

	private hasActiveFilters(): boolean {
		return !!this.query.trim() || !!this.categoryId || this.historyOnly;
	}

	/** Updates the selection in place so the focused row or card is not rebuilt under the user. */
	private selectBook(id: string): void {
		this.selectedBookId = id;
		const container = this.content;
		if (!container) return;
		for (const item of Array.from(container.querySelectorAll<HTMLElement>('[data-book-id]'))) {
			const bookId = item.dataset.bookId ?? id;
			const selected = this.selectedBookId === bookId;
			item.classList.toggle('is-selected', selected);
			if (item.tagName === 'TR') item.setAttribute('aria-selected', String(selected));
			else if (selected) item.setAttribute('aria-current', 'true');
			else item.removeAttribute('aria-current');
		}
	}

	private createLoadingState(): HTMLElement {
		const state = element('div', 'rd-shelf-state rd-shelf-loading', '正在加载书架…');
		state.setAttribute('role', 'status');
		state.setAttribute('aria-live', 'polite');
		return state;
	}

	private createEmptyState(): HTMLElement {
		const state = element('div', 'rd-shelf-state rd-shelf-empty');
		state.setAttribute('role', 'status');
		if (!this.query && !this.categoryId && !this.historyOnly) {
			state.textContent = '书架中还没有图书。请扫描已配置的书库文件夹。';
			return state;
		}
		if (this.historyOnly && !this.query && !this.categoryId) {
			state.textContent = '还没有任何阅读记录。打开一本书开始阅读后，这里会显示进度。';
			return state;
		}
		state.textContent = this.query
			? `没有与“${this.query}”匹配的图书。请清空上方搜索框，或选择其他分类。`
			: '当前分类下没有图书。请选择其他分类，或清除筛选。';
		state.append(button('清除筛选', '清除搜索与分类筛选', () => this.clearFilters()));
		return state;
	}

	private clearFilters(): void {
		this.query = '';
		this.categoryId = undefined;
		this.historyOnly = false;
		if (this.search) this.search.value = '';
		this.refreshContent();
	}

	private createErrorState(): HTMLElement {
		const state = element('div', 'rd-shelf-state rd-shelf-error');
		state.setAttribute('role', 'alert');
		state.append(element('p', 'rd-shelf-error-message', this.error ?? '书架发生未知错误。'));
		state.append(button('重试', '重试加载书架', () => void this.reload()));
		return state;
	}

	private async updateBook(
		book: LibraryBook,
		patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'tags' | 'rating' | 'categoryId'>>,
		onError?: (message: string) => void
	): Promise<void> {
		try {
			await this.host.updateBook(book.id, patch);
			Object.assign(book, patch);
			this.paint();
		} catch (error) {
			const message = errorMessage(error, '无法保存图书信息');
			if (onError) onError(message);
			else this.notify(message);
		}
	}

	private async openBook(book: LibraryBook): Promise<void> {
		this.selectBook(book.id);
		try {
			await this.host.openBook(book);
		} catch (error) {
			this.notify(errorMessage(error, '无法打开图书'));
		}
	}

	private async scan(): Promise<void> {
		try {
			await this.host.scan();
			await this.reload();
		} catch (error) {
			this.notify(errorMessage(error, '扫描书库失败'));
		}
	}

	private notify(message: string): void {
		new Notice(message);
	}
}

function iconSpan(icon: string): HTMLElement {
	const span = element('span', 'rd-button-icon');
	span.setAttribute('aria-hidden', 'true');
	setIcon(span, icon);
	return span;
}
