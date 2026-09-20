import type { LibraryBook, LibraryCategory } from '../../types/contracts';
import { createCover, createProgressRow, createShelfCard, type BookCardHost } from './BookCard';
import { button, element } from './ShelfDom';
import { categoryBookCount, focusBookFor, formatFileSize, lastReadPageOf } from './ShelfViewModel';

export interface NavigationLayoutHost extends BookCardHost {
	onSelectCategory(id?: string): void;
}

/** B 导航工作台：左侧 sticky 分类列 + 最近阅读重点卡 + 四列紧凑网格（复用同一书卡）。 */
export function createNavigationLayout(args: {
	books: LibraryBook[];
	allBooks: LibraryBook[];
	categories: LibraryCategory[];
	selectedCategoryId?: string;
	mainHeading: HTMLElement;
	host: NavigationLayoutHost;
}): HTMLElement {
	const layout = element('div', 'rd-shelf-navigation');
	layout.append(createNavigationSidebar(args.categories, args.allBooks, args.selectedCategoryId, args.host.onSelectCategory));
	const main = element('div', 'rd-nav-main');
	main.append(args.mainHeading);
	const focus = focusBookFor(args.books);
	if (focus) main.append(createFocusBook(focus, args.categories, args.host));
	const rest = args.books.filter(book => book.id !== focus?.id);
	if (rest.length === 0 && !focus) main.append(element('p', 'rd-shelf-state', '当前筛选下没有图书。'));
	if (rest.length > 0) {
		const grid = element('div', 'rd-shelf-grid rd-compact-grid');
		grid.setAttribute('aria-label', '图书卡片');
		for (const book of rest) grid.append(createShelfCard(book, args.categories.find(category => category.id === book.categoryId), args.host));
		main.append(grid);
	}
	layout.append(main);
	return layout;
}

function createNavigationSidebar(categories: LibraryCategory[], books: LibraryBook[], selectedId: string | undefined, onSelect: (id?: string) => void): HTMLElement {
	const sidebar = element('aside', 'rd-nav-sidebar');
	const intro = element('div', 'rd-nav-sidebar-intro');
	intro.append(element('h2', 'rd-visually-hidden', '分类导航'), element('p', 'rd-nav-sidebar-note', '按分类浏览书架'));
	const list = element('ul', 'rd-nav-category-list');
	list.setAttribute('aria-label', '分类导航');
	list.append(navCategoryItem(undefined, `全部图书`, books.length, selectedId, onSelect));
	for (const category of categories) {
		list.append(navCategoryItem(category.id, category.name, categoryBookCount(books, category.id), selectedId, onSelect));
	}
	sidebar.append(intro, list);
	return sidebar;
}

function navCategoryItem(categoryId: string | undefined, name: string, count: number, selectedId: string | undefined, onSelect: (id?: string) => void): HTMLElement {
	const item = element('li', 'rd-nav-category-item');
	const control = button(name, `按${name}筛选`, () => onSelect(categoryId));
	control.classList.add('rd-nav-category');
	control.append(element('span', 'rd-nav-category-count', String(count)));
	if (selectedId === categoryId) control.classList.add('is-selected');
	if (selectedId === categoryId) control.setAttribute('aria-current', 'true');
	item.append(control);
	return item;
}

function createFocusBook(book: LibraryBook, categories: LibraryCategory[], host: NavigationLayoutHost): HTMLElement {
	const section = element('section', 'rd-nav-focus');
	section.setAttribute('aria-label', `最近阅读：${book.title}`);
	section.append(createCover(book, categories.find(category => category.id === book.categoryId), 'focus', host));
	const copy = element('div', 'rd-nav-focus-copy');
	const page = lastReadPageOf(book);
	if (page !== undefined) copy.append(element('span', 'rd-nav-focus-page', `上次读到第 ${page} 页`));
	const title = element('h3', 'rd-nav-focus-title', book.title);
	title.title = book.title;
	copy.append(
		title,
		element('p', 'rd-nav-focus-meta', `${book.author || '作者未填写'} · ${book.pageCount ? `${book.pageCount} 页` : '页数未提供'} · ${formatFileSize(book.fileSize)}`),
		createProgressRow(book)
	);
	const open = button('继续阅读', `继续阅读 ${book.title}`, () => void host.openBook(book));
	open.classList.add('rd-nav-focus-open');
	copy.append(open);
	section.append(copy);
	return section;
}
