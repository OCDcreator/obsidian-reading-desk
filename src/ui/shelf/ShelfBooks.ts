import type { LibraryBook, LibraryCategory, LibraryList } from '../../types/contracts';
import { button, element, input, select } from './ShelfDom';
import type { ShelfViewHost } from './ShelfHost';
import type { ShelfBookDrafts } from './ShelfBookDrafts';
import { bindBookEditor } from './ShelfBookEditor';

export interface ShelfBookContext {
	host: ShelfViewHost;
	categories: LibraryCategory[];
	lists: LibraryList[];
	selected: Set<string>;
	selectionMode?: boolean;
	drafts: ShelfBookDrafts;
	onSelect(id: string, checked: boolean): void;
	onOpen(book: LibraryBook): void;
	onRelink(book: LibraryBook, trigger: HTMLElement): void;
	onChanged(): void;
}
export function selectionControl(book: LibraryBook, context: ShelfBookContext): HTMLElement {
	const label = element('label', 'rd-book-selection'); const checkbox = input('checkbox', '批量选择 ' + book.title);
	checkbox.checked = context.selected.has(book.id);
	checkbox.dataset.selectBook = book.id;
	checkbox.addEventListener('change', () => context.onSelect(book.id, checkbox.checked));
	label.append(checkbox); return label;
}
export function categoryControl(book: LibraryBook, context: ShelfBookContext): HTMLElement {
	const wrapper = element('div', 'rd-book-category');
	const label = element('label', 'rd-book-category');
	const control = select(book.title + ' 的分类', [['', '未分类'], ...context.categories.map(category => [category.id, category.name] as [string, string])], book.categoryId ?? '');
	label.append(control); wrapper.append(label);
	bindBookEditor(control, wrapper, book, 'categoryId', context, value => ({ categoryId: value || undefined })); return wrapper;
}
export function metadataEditor(book: LibraryBook, field: 'title' | 'author', context: ShelfBookContext): HTMLElement {
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
