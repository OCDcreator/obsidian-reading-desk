import type { LibraryBook } from '../../types/contracts';
import { createCover, createProgressRow, isEditorTarget, type BookCardHost } from './BookCard';
import { selectionControl, categoryControl, metadataEditor } from '../../ui/shelf/ShelfBooks';
import { bindBookEditor } from '../../ui/shelf/ShelfBookEditor';
import { button, element, input, select } from '../../ui/shelf/ShelfDom';
import { STATUS_LABELS } from '../../ui/shelf/ShelfQuery';
import { formatFileSize, parseTags } from './ShelfViewModel';

/** C keeps the accepted eight bibliographic columns; 0.5 metadata lives in a row disclosure. */
export function createLedgerRow(book: LibraryBook, context: BookCardHost): HTMLTableRowElement {
	const row = element('tr'); row.tabIndex = 0; row.dataset.bookId = book.id;
	row.classList.toggle('is-selected', context.selected.has(book.id)); row.setAttribute('aria-label', '打开 ' + book.title);
	const open = (): void => { if (context.selectionMode) context.onSelect(book.id, !context.selected.has(book.id)); else if (book.missing) context.onRelink(book, row); else context.onOpen(book); };
	row.addEventListener('click', event => { if (!isEditorTarget(event)) open(); });
	row.addEventListener('keydown', event => { if (event.target === row && !event.isComposing && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } });
	if (context.selectionMode) row.insertCell().append(selectionControl(book, context)); row.insertCell().append(bookCell(book, context));
	row.insertCell().append(metadataEditor(book, 'author', context)); row.insertCell().append(categoryControl(book, context));
	const tagsCell = row.insertCell(); const tags = input('text', book.title + ' 的标签', book.tags.join('，')); tags.className = 'rd-table-editor'; tags.placeholder = '添加标签';
	tagsCell.append(tags); bindBookEditor(tags, tagsCell, book, 'tags', context, value => ({ tags: parseTags(value) }));
	const ratingCell = row.insertCell(); const rating = select(book.title + ' 的评分', [['', '未评分'], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), i + 1 + ' 分'] as [string, string])], String(book.rating ?? '')); rating.className = 'rd-rating-select';
	ratingCell.append(rating); bindBookEditor(rating, ratingCell, book, 'rating', context, value => ({ rating: value ? Number(value) : undefined }));
	row.insertCell().append(createProgressRow(book)); row.insertCell().textContent = book.pageCount ? book.pageCount + ' 页' : '页数未提供'; row.insertCell().textContent = formatFileSize(book.fileSize);
	return row;
}
function bookCell(book: LibraryBook, context: BookCardHost): HTMLElement {
	const entry = element('div', 'rd-ledger-book'); const copy = element('div', 'rd-ledger-book-text');
	const title = button(book.title, '打开 ' + book.title, () => context.onOpen(book)); title.classList.add('rd-ledger-title'); title.disabled = !!book.missing;
	copy.append(title, element('span', 'rd-ledger-path', book.path));
	const more = element('details', 'rd-ledger-more'); const summary = element('summary', '', '更多信息'); summary.setAttribute('aria-label', book.title + ' 的更多信息');
	const fields = element('div', 'rd-ledger-more-fields'); fields.append(metadataEditor(book, 'title', context));
	const stateWrapper = element('div'); const status = select(book.title + ' 的状态', Object.entries(STATUS_LABELS), book.readingStatus ?? 'unread');
	stateWrapper.append(status); bindBookEditor(status, stateWrapper, book, 'readingStatus', context, value => ({ readingStatus: value as LibraryBook['readingStatus'] }));
	fields.append(stateWrapper, element('span', '', '格式：' + book.format.toUpperCase()), element('span', '', '阅读列表：' + (context.lists.filter(list => book.listIds?.includes(list.id)).map(list => list.name).join('、') || '未加入列表')));
	if (book.missing) { const relink = button('重新关联文件', '重新关联 ' + book.title, () => context.onRelink(book, relink)); fields.append(relink); more.open = true; }
	if (context.drafts.read(book.id, 'title') || context.drafts.read(book.id, 'readingStatus')) more.open = true;
	more.append(summary, fields); more.addEventListener('click', event => event.stopPropagation()); more.addEventListener('keydown', event => event.stopPropagation());
	copy.append(more); entry.append(createCover(book, undefined, 'ledger', context), copy); return entry;
}
