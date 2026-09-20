import type { LibraryBook, LibraryCategory } from '../../types/contracts';
import { createCover, createProgressRow, isEditorTarget, type BookCardHost } from './BookCard';
import { bindInlineInput, button, element, option } from './ShelfDom';
import { formatFileSize, parseTags, type LedgerStats } from './ShelfViewModel';

/** C 台账：统计摘要四格 + 高密度表格，作者/分类/评分/标签保持就地编辑。 */
export function createLedgerSummary(stats: LedgerStats): HTMLElement {
	const summary = element('section', 'rd-ledger-summary');
	summary.setAttribute('aria-label', '书库统计');
	summary.append(
		summaryCell(`${stats.totalBooks} 本`, '全部图书'),
		summaryCell(`${stats.readingBooks} 本`, '正在阅读'),
		summaryCell(`${stats.highlights} 条`, '原文摘录'),
		summaryCell(`${stats.averageProgress}%`, '平均阅读进度')
	);
	return summary;
}

export function createLedgerTable(books: LibraryBook[], categories: LibraryCategory[], host: BookCardHost): HTMLElement {
	const table = element('table', 'rd-library-table rd-ledger') as HTMLTableElement;
	table.setAttribute('aria-label', '图书台账');
	const head = table.createTHead().insertRow();
	for (const label of ['书名', '作者', '分类', '标签', '评分', '进度', '页数', '大小']) {
		const cell = table.ownerDocument.createElement('th');
		cell.scope = 'col';
		cell.textContent = label;
		head.append(cell);
	}
	const body = table.createTBody();
	for (const book of books) body.append(ledgerRow(table.ownerDocument, book, categories, host));
	return table;
}

function summaryCell(value: string, label: string): HTMLElement {
	const cell = element('div', 'rd-summary-cell');
	cell.append(element('strong', 'rd-summary-value', value), element('span', 'rd-summary-label', label));
	return cell;
}

function ledgerRow(document: Document, book: LibraryBook, categories: LibraryCategory[], host: BookCardHost): HTMLTableRowElement {
	const row = document.createElement('tr');
	row.tabIndex = 0;
	row.dataset.bookId = book.id;
	row.setAttribute('aria-label', `选择 ${book.title}`);
	row.addEventListener('click', event => {
		if (isEditorTarget(event)) return;
		void host.openBook(book);
	});
	row.addEventListener('keydown', event => {
		if (event.isComposing || isEditorTarget(event)) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void host.openBook(book);
		}
	});
	row.insertCell().append(ledgerBookCell(document, book, categories, host));
	row.insertCell().append(textEditor(document, book, 'author', '作者', host));
	row.insertCell().append(categoryEditor(document, book, categories, host));
	row.insertCell().append(textEditor(document, book, 'tags', '标签', host));
	row.insertCell().append(ratingEditor(document, book, host));
	row.insertCell().append(createProgressRow(book));
	row.insertCell().textContent = book.pageCount ? `${book.pageCount} 页` : '页数未提供';
	row.insertCell().textContent = formatFileSize(book.fileSize);
	return row;
}

function ledgerBookCell(document: Document, book: LibraryBook, categories: LibraryCategory[], host: BookCardHost): HTMLElement {
	const cell = element('div', 'rd-ledger-book');
	const category = categories.find(item => item.id === book.categoryId);
	cell.append(createCover(book, category, 'ledger', host));
	const text = element('div', 'rd-ledger-book-text');
	const title = button(book.title, `打开 ${book.title}`, () => void host.openBook(book));
	title.classList.add('rd-ledger-title');
	text.append(title, element('span', 'rd-ledger-path', book.path));
	cell.append(text);
	return cell;
}

function textEditor(document: Document, book: LibraryBook, field: 'author' | 'tags', label: string, host: BookCardHost): HTMLInputElement {
	const input = document.createElement('input');
	input.className = 'rd-table-editor';
	input.value = field === 'tags' ? book.tags.join('，') : book.author;
	input.placeholder = field === 'tags' ? '添加标签' : '点击添加作者信息';
	input.setAttribute('aria-label', `${book.title} 的${label}`);
	bindInlineInput(input, () => {
		const value = field === 'tags' ? parseTags(input.value) : input.value.trim();
		const unchanged = field === 'tags'
			? book.tags.join('\u0000') === (value as string[]).join('\u0000')
			: book.author === value;
		if (!unchanged) void host.updateBook(book, { [field]: value }, message => showEditorError(input, message));
	});
	input.addEventListener('click', event => event.stopPropagation());
	return input;
}

function categoryEditor(document: Document, book: LibraryBook, categories: LibraryCategory[], host: BookCardHost): HTMLElement {
	const wrapper = element('span', 'rd-ledger-category');
	const select = document.createElement('select');
	select.className = 'rd-ledger-category-select';
	select.setAttribute('aria-label', `${book.title} 的分类`);
	select.append(option(document, '', '未分类'));
	for (const category of categories) select.append(option(document, category.id, category.name));
	select.value = book.categoryId ?? '';
	select.addEventListener('click', event => event.stopPropagation());
	select.addEventListener('change', () => void host.updateBook(book, { categoryId: select.value || undefined }, message => showEditorError(select, message)));
	wrapper.append(select);
	return wrapper;
}

function ratingEditor(document: Document, book: LibraryBook, host: BookCardHost): HTMLSelectElement {
	const select = document.createElement('select');
	select.className = 'rd-rating-select';
	select.setAttribute('aria-label', `${book.title} 的评分`);
	select.append(option(document, '', '未评分'));
	for (let value = 1; value <= 10; value += 1) select.append(option(document, String(value), `${value} 分`));
	select.value = book.rating ? String(book.rating) : '';
	select.addEventListener('click', event => event.stopPropagation());
	select.addEventListener('change', () => void host.updateBook(
		book,
		{ rating: select.value ? Number(select.value) : undefined },
		message => showEditorError(select, message)
	));
	return select;
}

/** Surfaces an inline save failure beside the editor, keeping the row and its input intact. */
function showEditorError(input: HTMLElement, message: string): void {
	const cell = input.closest('td');
	if (!cell) return;
	cell.querySelector('.rd-table-error')?.remove();
	const note = input.ownerDocument.createElement('span');
	note.className = 'rd-table-error';
	note.setAttribute('role', 'alert');
	note.textContent = message;
	cell.append(note);
}
