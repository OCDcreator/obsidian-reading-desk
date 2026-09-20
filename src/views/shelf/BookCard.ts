import { setIcon } from 'obsidian';
import type { LibraryBook, LibraryCategory } from '../../types/contracts';
import { bindInlineInput, element } from './ShelfDom';
import { formatFileSize, formatProgress } from './ShelfViewModel';

export interface BookCardHost {
	resolveCoverUrl?(coverPath: string): string | null;
	updateBook(book: LibraryBook, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'tags' | 'rating' | 'categoryId'>>, onError?: (message: string) => void): Promise<void>;
	openBook(book: LibraryBook): Promise<void>;
}

/** A 布局书卡：满宽封面 + 固定信息槽（两行书名/单行作者/单行元数据/进度行），槽位保证全卡等高。 */
export function createShelfCard(book: LibraryBook, category: LibraryCategory | undefined, host: BookCardHost): HTMLElement {
	const card = element('article', 'rd-shelf-card');
	activateCard(card, book, host, `打开 ${book.title}`);
	const title = element('p', 'rd-book-title', book.title);
	title.title = book.title;
	const details = element('div', 'rd-book-details');
	details.append(
		title,
		createAuthorLine(book, host),
		createMetaLine(book),
		createProgressRow(book)
	);
	card.append(createCover(book, category, 'card', host), details);
	return card;
}

/** 继续阅读横卡：88px 封面 + 书名/作者/进度，不含分类与元数据编辑器。 */
export function createContinueCard(book: LibraryBook, host: BookCardHost): HTMLElement {
	const card = element('article', 'rd-continue-card');
	activateCard(card, book, host, `继续阅读 ${book.title}`);
	const title = element('p', 'rd-continue-title', book.title);
	title.title = book.title;
	const copy = element('div', 'rd-continue-copy');
	copy.append(title, element('p', 'rd-continue-author', book.author || '作者未填写'), createProgressRow(book));
	card.append(createCover(book, undefined, 'continue', host), copy);
	return card;
}

export type CoverVariant = 'card' | 'continue' | 'ledger' | 'focus';

export function createCover(book: LibraryBook, category: LibraryCategory | undefined, variant: CoverVariant, host: BookCardHost): HTMLElement {
	const cover = element('div', `rd-book-cover rd-book-cover--${variant}`);
	const coverUrl = book.coverPath ? host.resolveCoverUrl?.(book.coverPath) ?? book.coverPath : null;
	if (coverUrl) {
		const image = cover.ownerDocument.createElement('img');
		image.src = coverUrl;
		image.alt = `${book.title} 封面`;
		image.loading = 'lazy';
		image.decoding = 'async';
		image.addEventListener('error', () => {
			image.remove();
			cover.append(element('span', 'rd-book-cover-unavailable', '无可用封面'));
		});
		cover.append(image);
	} else cover.append(element('span', 'rd-book-cover-unavailable', '无可用封面'));
	if (category && variant === 'card') {
		const badge = element('span', 'rd-cover-category-badge', category.name);
		badge.title = `分类：${category.name}`;
		cover.append(badge);
	}
	return cover;
}

export function createProgressRow(book: LibraryBook): HTMLElement {
	const row = element('div', 'rd-progress-row');
	const bar = element('div', 'rd-progress');
	bar.setAttribute('role', 'progressbar');
	bar.setAttribute('aria-label', `${book.title} 阅读进度`);
	bar.setAttribute('aria-valuemin', '0');
	bar.setAttribute('aria-valuemax', '100');
	bar.setAttribute('aria-valuenow', String(Math.round(clamp01(book.progress) * 100)));
	const fill = element('span', 'rd-progress-fill');
	fill.style.transform = `scaleX(${clamp01(book.progress)})`;
	bar.append(fill);
	row.append(bar, element('span', 'rd-progress-value', formatProgress(book.progress)));
	return row;
}

function activateCard(card: HTMLElement, book: LibraryBook, host: BookCardHost, label: string): void {
	card.tabIndex = 0;
	card.dataset.bookId = book.id;
	card.setAttribute('aria-label', label);
	card.addEventListener('click', event => {
		if (isEditorTarget(event)) return;
		void host.openBook(book);
	});
	card.addEventListener('keydown', event => {
		if (event.isComposing || isEditorTarget(event)) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void host.openBook(book);
		}
	});
}

/** Clicks and keys inside an inline editor belong to the editor, never to the card's open action. */
export function isEditorTarget(event: Event): boolean {
	const target = event.target as HTMLElement | null;
	return !!target?.closest('input, select, textarea');
}

function createMetaLine(book: LibraryBook): HTMLElement {
	const line = element('p', 'rd-book-meta');
	const pages = element('span', 'rd-meta-item');
	pages.append(iconSpan('file-text'), ` ${book.pageCount ? `${book.pageCount} 页` : '页数未提供'}`);
	const size = element('span', 'rd-meta-item');
	size.append(iconSpan('hard-drive'), ` ${formatFileSize(book.fileSize)}`);
	line.append(pages, size);
	return line;
}

/** 作者行：缺失态是「点击添加作者信息」占位；点击就地变成输入框，Enter/失焦保存、Esc 取消。 */
function createAuthorLine(book: LibraryBook, host: BookCardHost): HTMLElement {
	const line = element('span', 'rd-book-author rd-author-editable');
	line.setAttribute('role', 'button');
	line.tabIndex = 0;
	paintAuthorLine(line, book);
	const edit = (): void => {
		const input = line.ownerDocument.createElement('input');
		input.type = 'text';
		input.className = 'rd-author-input';
		input.value = book.author;
		input.placeholder = '作者姓名';
		input.setAttribute('aria-label', `${book.title} 的作者`);
		line.replaceWith(input);
		input.focus();
		input.select();
		bindInlineInput(input, () => {
			const value = input.value.trim();
			if (value === book.author) input.replaceWith(line);
			else void host.updateBook(book, { author: value });
		});
	};
	line.addEventListener('click', event => {
		event.stopPropagation();
		edit();
	});
	line.addEventListener('keydown', event => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			edit();
		}
	});
	return line;
}

function paintAuthorLine(line: HTMLElement, book: LibraryBook): void {
	if (book.author) {
		line.textContent = book.author;
		line.classList.remove('is-placeholder');
		line.removeAttribute('aria-label');
	} else {
		line.textContent = '点击添加作者信息';
		line.classList.add('is-placeholder');
		line.setAttribute('aria-label', `为 ${book.title} 添加作者`);
	}
}

function iconSpan(icon: string): HTMLElement {
	const span = element('span', 'rd-meta-icon');
	span.setAttribute('aria-hidden', 'true');
	setIcon(span, icon);
	return span;
}

function clamp01(progress: number): number {
	return Math.max(0, Math.min(1, progress));
}
