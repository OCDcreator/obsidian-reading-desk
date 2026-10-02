import type { LibraryBook, LibraryCategory, LibraryList } from '../../types/contracts';
import { formatFileSize, formatProgress, parseTags } from '../../views/shelf/ShelfViewModel';
import { button, element, input, isItemActivation, select } from './ShelfDom';
import type { ShelfViewHost } from './ShelfHost';
import type { ShelfBookDrafts } from './ShelfBookDrafts';
import { bindBookEditor } from './ShelfBookEditor';
import { STATUS_LABELS } from './ShelfQuery';

export interface ShelfBookContext {
	host: ShelfViewHost;
	categories: LibraryCategory[];
	lists: LibraryList[];
	selected: Set<string>;
	drafts: ShelfBookDrafts;
	onSelect(id: string, checked: boolean): void;
	onOpen(book: LibraryBook): void;
	onRelink(book: LibraryBook, trigger: HTMLElement): void;
	onChanged(): void;
}
export function createBookCover(book: LibraryBook, host: ShelfViewHost): HTMLElement {
	const cover = element('div', 'rd-book-cover');
	const fallback = (): void => {
		const type = element('div', 'rd-book-cover-type');
		type.append(element('span', 'rd-book-cover-format', book.format.toUpperCase()), element('strong', 'rd-book-cover-title', book.title), element('span', 'rd-book-cover-unavailable', '无可用封面'));
		type.title = book.title;
		cover.replaceChildren(type);
	};
	const url = book.coverPath ? host.resolveCoverUrl ? host.resolveCoverUrl(book.coverPath) : book.coverPath : null;
	if (!url) fallback();
	else {
		const image = element('img'); image.src = url; image.alt = book.title + ' 封面'; image.loading = 'lazy'; image.decoding = 'async';
		image.addEventListener('error', fallback, { once: true }); cover.append(image);
	}
	return cover;
}
export function createBookProgress(book: LibraryBook): HTMLElement {
	const group = element('div', 'rd-progress-group');
	const bar = element('div', 'rd-progress');
	bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', book.title + ' 阅读进度');
	bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
	bar.setAttribute('aria-valuenow', formatProgress(book.progress).replace('%', ''));
	const fill = element('span', 'rd-progress-fill'); fill.style.width = formatProgress(book.progress);
	bar.append(fill); group.append(bar, element('span', 'rd-progress-label', '阅读进度 ' + formatProgress(book.progress)));
	return group;
}
export function createBookCard(book: LibraryBook, context: ShelfBookContext, compact = false): HTMLElement {
	const card = element('article', compact ? 'rd-shelf-card rd-shelf-card--continue' : 'rd-shelf-card');
	card.tabIndex = 0; card.dataset.bookId = book.id;
	card.setAttribute('aria-label', (book.missing ? '重新关联 ' : '打开 ') + book.title);
	card.classList.toggle('is-selected', context.selected.has(book.id));
	const open = (): void => book.missing ? context.onRelink(book, card) : context.onOpen(book);
	card.addEventListener('click', event => { if (!(event.target as HTMLElement).closest('button, input, select, label, a')) open(); });
	card.addEventListener('keydown', event => { if (isItemActivation(event)) { event.preventDefault(); open(); } });
	const details = element('div', 'rd-book-details');
	const title = element('p', 'rd-book-title', book.title); title.title = book.title;
	details.append(title, createBookProgress(book));
	if (!compact) {
		details.append(element('p', 'rd-book-author', book.author || '作者未填写'), element('p', 'rd-book-meta', (book.pageCount ? book.pageCount + ' 页' : '页数未提供') + ' · ' + formatFileSize(book.fileSize)));
		const badges = element('div', 'rd-book-badges');
		badges.append(element('span', 'rd-book-badge', book.format.toUpperCase()), element('span', 'rd-book-badge', STATUS_LABELS[book.readingStatus ?? 'unread']));
		if (book.rating) badges.append(element('span', 'rd-book-badge', book.rating + ' 分'));
		if (book.missing) badges.append(element('span', 'rd-book-badge is-error', '源文件缺失'));
		for (const tag of book.tags.slice(0, 3)) badges.append(element('span', 'rd-book-badge', '#' + tag));
		if (book.tags.length > 3) badges.append(element('span', 'rd-book-badge', '+' + (book.tags.length - 3)));
		details.append(badges, selectionControl(book, context), categoryControl(book, context));
		if (book.missing) { const relink = button('重新关联文件', '重新关联 ' + book.title, () => context.onRelink(book, relink)); details.append(relink); }
	}
	card.append(createBookCover(book, context.host), details);
	return card;
}
function selectionControl(book: LibraryBook, context: ShelfBookContext): HTMLElement {
	const label = element('label', 'rd-book-selection'); const checkbox = input('checkbox', '批量选择 ' + book.title);
	checkbox.checked = context.selected.has(book.id);
	checkbox.dataset.selectBook = book.id;
	checkbox.addEventListener('change', () => context.onSelect(book.id, checkbox.checked));
	label.append(checkbox, '选择'); return label;
}
function categoryControl(book: LibraryBook, context: ShelfBookContext): HTMLElement {
	const wrapper = element('div', 'rd-book-category');
	const label = element('label', 'rd-book-category', '分类');
	const control = select(book.title + ' 的分类', [['', '未分类'], ...context.categories.map(category => [category.id, category.name] as [string, string])], book.categoryId ?? '');
	label.append(control); wrapper.append(label);
	bindBookEditor(control, wrapper, book, 'categoryId', context, value => ({ categoryId: value || undefined })); return wrapper;
}
export function createBookTable(books: LibraryBook[], context: ShelfBookContext): HTMLElement {
	const wrapper = element('div', 'rd-library-table-wrap');
	const table = element('table', 'rd-library-table'); table.setAttribute('aria-label', '图书表格');
	const head = table.createTHead().insertRow();
	for (const label of ['选择', '标题', '作者', '格式', '标签', '评分', '状态', '分类', '阅读列表', '进度']) {
		const cell = element('th', '', label); cell.scope = 'col'; head.append(cell);
	}
	const body = table.createTBody();
	for (const book of books) {
		const row = body.insertRow(); row.dataset.bookId = book.id; row.classList.toggle('is-selected', context.selected.has(book.id));
		row.insertCell().append(selectionControl(book, context));
		const titleCell = row.insertCell();
		const open = button(book.title, '打开 ' + book.title, () => context.onOpen(book)); open.disabled = !!book.missing;
		titleCell.append(open, metadataEditor(book, 'title', context));
		if (book.missing) { const relink = button('重新关联文件', '重新关联 ' + book.title, () => context.onRelink(book, relink)); titleCell.append(relink); }
		row.insertCell().append(metadataEditor(book, 'author', context));
		row.insertCell().textContent = book.format.toUpperCase();
		const tags = input('text', book.title + ' 的标签', book.tags.join('，')); tags.className = 'rd-table-editor';
		const tagsCell = row.insertCell(); tagsCell.append(tags); bindBookEditor(tags, tagsCell, book, 'tags', context, value => ({ tags: parseTags(value) }));
		const rating = select(book.title + ' 的评分', [['', '未评分'], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), (i + 1) + ' 分'] as [string, string])], String(book.rating ?? ''));
		const ratingCell = row.insertCell(); ratingCell.append(rating); bindBookEditor(rating, ratingCell, book, 'rating', context, value => ({ rating: value ? Number(value) : undefined }));
		const status = select(book.title + ' 的状态', Object.entries(STATUS_LABELS), book.readingStatus ?? 'unread');
		const statusCell = row.insertCell(); statusCell.append(status); bindBookEditor(status, statusCell, book, 'readingStatus', context, value => ({ readingStatus: value as LibraryBook['readingStatus'] }));
		row.insertCell().append(categoryControl(book, context));
		row.insertCell().textContent = context.lists.filter(list => book.listIds?.includes(list.id)).map(list => list.name).join('、') || '未加入列表';
		row.insertCell().textContent = formatProgress(book.progress);
	}
	wrapper.append(table); return wrapper;
}
function metadataEditor(book: LibraryBook, field: 'title' | 'author', context: ShelfBookContext): HTMLElement {
	const wrapper = element('div', 'rd-metadata-editor');
	const label = field === 'title' ? '标题' : '作者';
	const text = input('text', book.title + ' 的' + label, book[field]); text.className = 'rd-table-editor';
	wrapper.append(text); bindBookEditor(text, wrapper, book, field, context, value => ({ [field]: value.trim() }));
	if (book.metadataOverrides?.[field] !== undefined) {
		wrapper.append(element('span', 'rd-metadata-source', '人工' + label));
		const reset = button('恢复自动' + label, '恢复 ' + book.title + ' 的自动' + label, async () => {
			reset.disabled = true;
			await context.drafts.save(book.id, field, book.autoMetadata?.[field] ?? book[field], async () => context.host.clearMetadataOverride?.(book.id, [field]), context.onChanged, true);
			reset.disabled = !context.host.clearMetadataOverride;
		}); reset.disabled = !context.host.clearMetadataOverride; wrapper.append(reset);
	}
	return wrapper;
}
