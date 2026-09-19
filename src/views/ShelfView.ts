import type { LibraryBook, LibraryCategory } from '../types/contracts';
import {
	categoryBookCount,
	filterBooks,
	formatFileSize,
	formatProgress,
	parseTags,
	ShelfSearchController,
	sortCategories,
	shouldShowContinueReading,
	type ShelfDisplayMode
} from './shelf/ShelfViewModel';

type Awaitable<T> = T | Promise<T>;

export interface ShelfViewHost {
	getBooks(): Awaitable<LibraryBook[]>;
	getCategories(): Awaitable<LibraryCategory[]>;
	addCategory(name: string): Awaitable<LibraryCategory>;
	reorderCategories(ids: string[]): Awaitable<void>;
	updateBook(id: string, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'tags' | 'rating' | 'categoryId'>>): Awaitable<void>;
	openBook(book: LibraryBook): Awaitable<void>;
	scan(): Awaitable<void>;
	resolveCoverUrl?(coverPath: string): string | null;
}

/** A framework-free shelf surface. Its host owns persistence and navigation. */
export class ShelfView {
	private container?: HTMLElement;
	private books: LibraryBook[] = [];
	private categories: LibraryCategory[] = [];
	private query = '';
	private categoryId?: string;
	private mode: ShelfDisplayMode = 'cards';
	private selectedBookId?: string;
	private loading = false;
	private error?: string;
	private header?: HTMLElement;
	private toolbar?: HTMLElement;
	private modeHost?: HTMLElement;
	private content?: HTMLElement;
	private search?: HTMLInputElement;
	private readonly searchController = new ShelfSearchController();

	constructor(private readonly host: ShelfViewHost) { }

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
			const [books, categories] = await Promise.all([this.host.getBooks(), this.host.getCategories()]);
			this.books = books;
			this.categories = sortCategories(categories);
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
		if (this.content && this.content.parentElement === container) return;
		container.replaceChildren();
		container.className = 'rd-shelf';
		this.header = this.createHeader();
		this.toolbar = this.createToolbar();
		this.content = element('div', 'rd-shelf-results');
		container.append(this.header, this.toolbar, this.content);
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
		header.append(element('div', 'rd-shelf-heading', '书架'));
		const actions = element('div', 'rd-shelf-actions');
		actions.append(button('扫描书库', '重新扫描书库', () => void this.scan()));
		header.append(actions);
		return header;
	}

	private createToolbar(): HTMLElement {
		const toolbar = element('div', 'rd-shelf-toolbar');
		toolbar.setAttribute('role', 'search');
		this.search = documentInput('search', '搜索标题、作者或标签');
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
		group.append(
			this.modeButton('cards', '卡片视图'),
			this.modeButton('table', '表格视图')
		);
		return group;
	}

	private modeButton(mode: ShelfDisplayMode, label: string): HTMLButtonElement {
		const control = button(label, label, () => {
			this.mode = mode;
			this.paint();
		});
		control.classList.add('rd-view-switch-button');
		control.setAttribute('aria-pressed', String(this.mode === mode));
		if (this.mode === mode) control.classList.add('is-selected');
		return control;
	}

	private createContent(): HTMLElement {
		const content = element('div', 'rd-shelf-content');
		const continuing = shouldShowContinueReading({ query: this.query, categoryId: this.categoryId }) ? this.createContinueReading() : undefined;
		if (continuing) content.append(continuing);
		content.append(this.createCategoryPanel());
		const books = filterBooks(this.books, { query: this.query, categoryId: this.categoryId });
		if (books.length === 0) content.append(this.createEmptyState());
		else content.append(this.mode === 'cards' ? this.createCardGrid(books) : this.createTable(books));
		return content;
	}

	private createContinueReading(): HTMLElement | undefined {
		const books = this.books
			.filter(book => book.progress > 0 && book.progress < 1)
			.sort((left, right) => (right.lastReadAt ?? 0) - (left.lastReadAt ?? 0));
		if (books.length === 0) return undefined;
		const section = element('section', 'rd-continue-reading');
		section.setAttribute('aria-label', '继续阅读');
		section.append(element('h2', 'rd-section-title', '继续阅读'));
		const cards = element('div', 'rd-continue-reading-list');
		for (const book of books) cards.append(this.createCard(book));
		section.append(cards);
		return section;
	}

	private createCategoryPanel(): HTMLElement {
		const panel = element('section', 'rd-category-panel');
		panel.setAttribute('aria-label', '图书分类');
		const chips = element('div', 'rd-category-chips');
		chips.append(this.categoryChip(undefined, `全部 ${this.books.length}`));
		for (const category of this.categories) {
			chips.append(this.categoryChip(category.id, `${category.name} ${categoryBookCount(this.books, category.id)}`));
		}
		panel.append(chips, this.createCategoryManager());
		return panel;
	}

	private categoryChip(categoryId: string | undefined, label: string): HTMLButtonElement {
		const control = button(label, label, () => {
			this.categoryId = categoryId;
			this.paint();
		});
		control.classList.add('rd-category-chip');
		control.setAttribute('aria-pressed', String(this.categoryId === categoryId));
		if (this.categoryId === categoryId) control.classList.add('is-selected');
		return control;
	}

	private createCategoryManager(): HTMLElement {
		const manager = element('div', 'rd-category-manager');
		const input = documentInput('text', '新分类名称');
		input.className = 'rd-category-input';
		input.setAttribute('aria-label', '新分类名称');
		const add = async (): Promise<void> => {
			const name = input.value.trim();
			if (!name) return;
			try {
				await this.host.addCategory(name);
				input.value = '';
				await this.reload();
			} catch (error) {
				this.error = errorMessage(error, '无法添加分类');
				this.paint();
			}
		};
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void add();
			}
		});
		manager.append(input, button('新增分类', '新增分类', () => void add()));
		if (this.categories.length > 0) manager.append(this.createCategoryOrder());
		return manager;
	}

	private createCategoryOrder(): HTMLElement {
		const list = element('ol', 'rd-category-order');
		list.setAttribute('aria-label', '分类排序');
		this.categories.forEach((category, index) => {
			const row = element('li', 'rd-category-order-row');
			row.append(element('span', 'rd-category-name', category.name));
			const controls = element('span', 'rd-category-order-actions');
			controls.append(
				this.reorderButton(category, index, -1, '上移'),
				this.reorderButton(category, index, 1, '下移')
			);
			row.append(controls);
			list.append(row);
		});
		return list;
	}

	private reorderButton(category: LibraryCategory, index: number, offset: number, label: string): HTMLButtonElement {
		const control = button(label, `${category.name}${label}`, () => void this.reorderCategory(index, offset));
		control.disabled = index + offset < 0 || index + offset >= this.categories.length;
		return control;
	}

	private async reorderCategory(index: number, offset: number): Promise<void> {
		const reordered = [...this.categories];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(index + offset, 0, moved);
		try {
			await this.host.reorderCategories(reordered.map(category => category.id));
			await this.reload();
		} catch (error) {
			this.error = errorMessage(error, '无法调整分类顺序');
			this.paint();
		}
	}

	private createCardGrid(books: LibraryBook[]): HTMLElement {
		const grid = element('div', 'rd-shelf-grid');
		grid.setAttribute('aria-label', '图书卡片');
		for (const book of books) grid.append(this.createCard(book));
		return grid;
	}

	private createCard(book: LibraryBook): HTMLElement {
		const card = element('article', 'rd-shelf-card');
		card.tabIndex = 0;
		card.setAttribute('aria-label', `打开 ${book.title}`);
		card.addEventListener('click', () => void this.openBook(book));
		card.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				void this.openBook(book);
			}
		});
		if (this.selectedBookId === book.id) card.classList.add('is-selected');
		const cover = element('div', 'rd-book-cover');
		const coverUrl = book.coverPath ? this.host.resolveCoverUrl?.(book.coverPath) ?? book.coverPath : null;
		if (coverUrl) {
			const image = card.ownerDocument.createElement('img');
			image.src = coverUrl;
			image.alt = `${book.title} 封面`;
			image.addEventListener('error', () => {
				image.remove();
				cover.append(element('span', 'rd-book-cover-unavailable', '无可用封面'));
			});
			cover.append(image);
		} else cover.append(element('span', 'rd-book-cover-unavailable', '无可用封面'));
		const details = element('div', 'rd-book-details');
		details.append(
			element('h2', 'rd-book-title', book.title),
			element('p', 'rd-book-author', book.author || '作者未填写'),
			element('p', 'rd-book-meta', bookMeta(book)),
			this.createProgress(book),
			this.createCardCategoryControl(book)
		);
		card.append(cover, details);
		return card;
	}

	private createProgress(book: LibraryBook): HTMLElement {
		const group = element('div', 'rd-progress-group');
		const bar = element('div', 'rd-progress');
		bar.setAttribute('role', 'progressbar');
		bar.setAttribute('aria-label', `${book.title} 阅读进度`);
		bar.setAttribute('aria-valuemin', '0');
		bar.setAttribute('aria-valuemax', '100');
		bar.setAttribute('aria-valuenow', String(Math.round(book.progress * 100)));
		const fill = element('span', 'rd-progress-fill');
		fill.style.width = formatProgress(book.progress);
		bar.append(fill);
		group.append(bar, element('span', 'rd-progress-label', `阅读进度 ${formatProgress(book.progress)}`));
		return group;
	}

	private createCardCategoryControl(book: LibraryBook): HTMLElement {
		const wrapper = element('label', 'rd-book-category');
		wrapper.append('分类');
		wrapper.addEventListener('click', event => event.stopPropagation());
		const select = wrapper.ownerDocument.createElement('select');
		select.setAttribute('aria-label', `${book.title} 的分类`);
		select.append(option(select.ownerDocument, '', '未分类'));
		for (const category of this.categories) select.append(option(select.ownerDocument, category.id, category.name));
		select.value = book.categoryId ?? '';
		select.addEventListener('click', event => event.stopPropagation());
		select.addEventListener('change', () => void this.updateBook(book, { categoryId: select.value || undefined }));
		wrapper.append(select);
		return wrapper;
	}

	private createTable(books: LibraryBook[]): HTMLElement {
		const table = element('table', 'rd-library-table') as HTMLTableElement;
		table.setAttribute('aria-label', '图书表格');
		const head = table.createTHead().insertRow();
		for (const label of ['标题', '作者', '标签', '评分', '页数', '大小', '进度']) {
			const cell = table.ownerDocument.createElement('th');
			cell.scope = 'col';
			cell.textContent = label;
			head.append(cell);
		}
		const body = table.createTBody();
		for (const book of books) body.append(this.createTableRow(table.ownerDocument, book));
		return table;
	}

	private createTableRow(document: Document, book: LibraryBook): HTMLTableRowElement {
		const row = document.createElement('tr');
		row.tabIndex = 0;
		row.setAttribute('aria-label', `选择 ${book.title}`);
		row.addEventListener('click', () => {
			this.selectedBookId = book.id;
			this.paint();
		});
		row.addEventListener('keydown', event => {
			if (event.key === 'Enter') void this.openBook(book);
		});
		if (this.selectedBookId === book.id) row.classList.add('is-selected');
		row.insertCell().append(button(book.title, `打开 ${book.title}`, () => void this.openBook(book)));
		row.insertCell().append(this.inlineTextEditor(document, book, 'author', '作者'));
		row.insertCell().append(this.inlineTextEditor(document, book, 'tags', '标签'));
		row.insertCell().append(this.ratingEditor(document, book));
		row.insertCell().textContent = book.pageCount ? `${book.pageCount} 页` : '页数未提供';
		row.insertCell().textContent = formatFileSize(book.fileSize);
		row.insertCell().textContent = formatProgress(book.progress);
		return row;
	}

	private inlineTextEditor(document: Document, book: LibraryBook, field: 'author' | 'tags', label: string): HTMLInputElement {
		const input = document.createElement('input');
		input.className = 'rd-table-editor';
		input.value = field === 'tags' ? book.tags.join('，') : book.author;
		input.setAttribute('aria-label', `${book.title} 的${label}`);
		const save = (): void => {
			const value = field === 'tags' ? parseTags(input.value) : input.value.trim();
			if (sameFieldValue(book, field, value)) return;
			void this.updateBook(book, { [field]: value });
		};
		input.addEventListener('blur', save);
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				input.blur();
			}
		});
		input.addEventListener('click', event => event.stopPropagation());
		return input;
	}

	private ratingEditor(document: Document, book: LibraryBook): HTMLSelectElement {
		const select = document.createElement('select');
		select.className = 'rd-rating-select';
		select.setAttribute('aria-label', `${book.title} 的评分`);
		select.append(option(document, '', '未评分'));
		for (let value = 1; value <= 10; value += 1) select.append(option(document, String(value), `${value} 分`));
		select.value = book.rating ? String(book.rating) : '';
		select.addEventListener('click', event => event.stopPropagation());
		select.addEventListener('change', () => void this.updateBook(book, { rating: select.value ? Number(select.value) : undefined }));
		return select;
	}

	private createLoadingState(): HTMLElement {
		const state = element('div', 'rd-shelf-state rd-shelf-loading', '正在加载书架…');
		state.setAttribute('role', 'status');
		state.setAttribute('aria-live', 'polite');
		return state;
	}

	private createEmptyState(): HTMLElement {
		const message = this.query || this.categoryId ? '没有符合当前筛选的图书。' : '书架中还没有图书。请扫描已配置的书库文件夹。';
		const state = element('div', 'rd-shelf-state rd-shelf-empty', message);
		state.setAttribute('role', 'status');
		return state;
	}

	private createErrorState(): HTMLElement {
		const state = element('div', 'rd-shelf-state rd-shelf-error');
		state.setAttribute('role', 'alert');
		state.append(element('p', 'rd-shelf-error-message', this.error ?? '书架发生未知错误。'));
		state.append(button('重试', '重试加载书架', () => void this.reload()));
		return state;
	}

	private async updateBook(book: LibraryBook, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'tags' | 'rating' | 'categoryId'>>): Promise<void> {
		try {
			await this.host.updateBook(book.id, patch);
			Object.assign(book, patch);
			this.paint();
		} catch (error) {
			this.error = errorMessage(error, '无法保存图书信息');
			this.paint();
		}
	}

	private async openBook(book: LibraryBook): Promise<void> {
		this.selectedBookId = book.id;
		this.paint();
		try {
			await this.host.openBook(book);
		} catch (error) {
			this.error = errorMessage(error, '无法打开图书');
			this.paint();
		}
	}

	private async scan(): Promise<void> {
		try {
			await this.host.scan();
			await this.reload();
		} catch (error) {
			this.error = errorMessage(error, '扫描书库失败');
			this.paint();
		}
	}
}

function element(tag: string, className: string, text?: string): HTMLElement {
	const value = document.createElement(tag);
	value.className = className;
	if (text !== undefined) value.textContent = text;
	return value;
}

function button(text: string, label: string, onClick: () => void): HTMLButtonElement {
	const control = document.createElement('button');
	control.type = 'button';
	control.className = 'rd-button';
	control.textContent = text;
	control.setAttribute('aria-label', label);
	control.addEventListener('click', event => {
		event.stopPropagation();
		onClick();
	});
	return control;
}

function documentInput(type: string, placeholder: string): HTMLInputElement {
	const input = document.createElement('input');
	input.type = type;
	input.placeholder = placeholder;
	return input;
}

function option(document: Document, value: string, label: string): HTMLOptionElement {
	const item = document.createElement('option');
	item.value = value;
	item.textContent = label;
	return item;
}

function bookMeta(book: LibraryBook): string {
	const pages = book.pageCount ? `${book.pageCount} 页` : '页数未提供';
	return `${pages} · ${formatFileSize(book.fileSize)}`;
}

function sameFieldValue(book: LibraryBook, field: 'author' | 'tags', value: string | string[]): boolean {
	if (field === 'author') return book.author === value;
	return book.tags.join('\u0000') === (value as string[]).join('\u0000');
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
