import type { LibraryBook, LibraryCategory } from '../../types/contracts';
import type { ShelfBookContext } from '../../ui/shelf/ShelfBooks';
import { selectionControl } from '../../ui/shelf/ShelfBooks';
import { bindBookEditor } from '../../ui/shelf/ShelfBookEditor';
import { button, element, input, isItemActivation } from '../../ui/shelf/ShelfDom';
import { formatFileSize, formatProgress } from './ShelfViewModel';
export type BookCardHost = ShelfBookContext;
export type CoverVariant = 'card' | 'continue' | 'ledger' | 'focus';

/** Accepted A layout, with 0.5 controls bound to the same per-leaf drafts. */
export function createShelfCard(book: LibraryBook, category: LibraryCategory | undefined, context: BookCardHost): HTMLElement {
	const card = element('article', 'rd-shelf-card'); activateCard(card, book, context, '打开 ' + book.title);
	card.classList.toggle('is-selected', context.selected.has(book.id));
	const cover = createCover(book, category, 'card', context);
	if (context.selectionMode) { const tools = element('div', 'rd-cover-tools'); tools.append(selectionControl(book, context)); cover.append(tools); }
	const title = element('p', 'rd-book-title', book.title); title.title = book.title;
	const details = element('div', 'rd-book-details');
	details.append(title, createAuthorLine(book, context), element('p', 'rd-book-meta', (book.pageCount ? book.pageCount + ' 页' : '页数未提供') + ' · ' + formatFileSize(book.fileSize)), createProgressRow(book));
	if (book.missing) { const relink = button('重新关联文件', '重新关联 ' + book.title, () => context.onRelink(book, relink)); details.append(relink); }
	card.append(cover, details); return card;
}
export function createContinueCard(book: LibraryBook, context: BookCardHost): HTMLElement {
	const card = element('article', 'rd-continue-card'); activateCard(card, book, context, '继续阅读 ' + book.title, false);
	const copy = element('div', 'rd-continue-copy'); const title = element('p', 'rd-continue-title', book.title); title.title = book.title;
	copy.append(title, element('p', 'rd-continue-author', book.author || '作者未填写'), createProgressRow(book));
	card.append(createCover(book, undefined, 'continue', context), copy); return card;
}
export function createCover(book: LibraryBook, category: LibraryCategory | undefined, variant: CoverVariant, context: BookCardHost): HTMLElement {
	const cover = element('div', 'rd-book-cover rd-book-cover--' + variant);
	const fallback = (): void => { cover.querySelector('img')?.remove(); if (!cover.querySelector('.rd-book-cover-unavailable')) cover.append(element('span', 'rd-book-cover-unavailable', '无可用封面')); };
	const url = book.coverPath ? context.host.resolveCoverUrl?.(book.coverPath) ?? book.coverPath : null;
	if (url) { const image = element('img'); image.src = url; image.alt = book.title + ' 封面'; image.loading = 'lazy'; image.decoding = 'async'; image.addEventListener('error', fallback, { once: true }); cover.append(image); } else fallback();
	if (category && variant === 'card') { const badge = element('span', 'rd-cover-category-badge', category.name); badge.title = '分类：' + category.name; cover.append(badge); }
	return cover;
}
export function createProgressRow(book: LibraryBook): HTMLElement {
	const row = element('div', 'rd-progress-row'); const bar = element('div', 'rd-progress'); const value = formatProgress(book.progress);
	bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', book.title + ' 阅读进度');
	bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', value.replace('%', ''));
	const fill = element('span', 'rd-progress-fill'); fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, book.progress)) + ')';
	bar.append(fill); row.append(bar, element('span', 'rd-progress-value', value)); return row;
}
export function isEditorTarget(event: Event): boolean { return !!(event.target as HTMLElement | null)?.closest('input, select, textarea, button, label, a, summary, details, [role="button"]'); }
function activateCard(card: HTMLElement, book: LibraryBook, context: BookCardHost, label: string, selectable = true): void {
	card.tabIndex = 0; card.dataset.bookId = book.id; card.setAttribute('aria-label', book.missing ? '重新关联 ' + book.title : label);
	const open = (): void => {
		if (context.selectionMode && selectable) context.onSelect(book.id, !context.selected.has(book.id));
		else if (book.missing) context.onRelink(book, card); else context.onOpen(book);
	};
	card.addEventListener('click', event => { if (!isEditorTarget(event)) open(); });
	card.addEventListener('keydown', event => { if (isItemActivation(event)) { event.preventDefault(); open(); } });
}
function createAuthorLine(book: LibraryBook, context: BookCardHost): HTMLElement {
	const line = element('div', 'rd-book-author rd-author-editable');
	const edit = (focus = true): void => {
		if (line.querySelector('input')) return;
		line.replaceChildren(); const control = input('text', book.title + ' 的作者', book.author); control.className = 'rd-author-input'; control.placeholder = '作者姓名';
		line.append(control); bindBookEditor(control, line, book, 'author', context, value => ({ author: value.trim() }), paint); if (focus) control.focus();
	};
	const paint = (): void => {
		line.replaceChildren(); const control = button(book.author || '点击添加作者信息', book.author ? '编辑 ' + book.title + ' 的作者' : '为 ' + book.title + ' 添加作者', () => edit());
	control.className = 'rd-author-trigger'; if (!book.author) control.classList.add('is-placeholder'); line.append(control);
	};
	if (context.drafts.read(book.id, 'author')) edit(false); else paint(); return line;
}
