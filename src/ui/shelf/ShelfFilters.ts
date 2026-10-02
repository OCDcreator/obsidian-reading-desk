import type { LibraryBook, LibraryList, ReadingStatus } from '../../types/contracts';
import { element, field, input, select } from './ShelfDom';
import { STATUS_LABELS, type ShelfQuery, type ShelfSort } from './ShelfQuery';
let filterId = 0;
export function createShelfFilters(books: LibraryBook[], lists: LibraryList[], query: ShelfQuery, onChange: (patch: Partial<ShelfQuery>) => void): HTMLElement {
	const bar = element('div', 'rd-shelf-filters');
	const add = (label: string, values: Array<[string, string]>, value: string, apply: (value: string) => Partial<ShelfQuery>): void => {
		const control = select(label, values, value);
		control.addEventListener('change', () => onChange(apply(control.value)));
		bar.append(field(label, control));
	};
	add('格式', [['', '全部格式'], ['pdf', 'PDF'], ['epub', 'EPUB']], query.format ?? '', value => ({ format: value as ShelfQuery['format'] || undefined }));
	const tag = input('search', '标签', query.tag ?? ''); tag.placeholder = '精确标签；留空显示全部';
	const suggestions = element('datalist'); suggestions.id = 'rd-shelf-tags-' + ++filterId; tag.setAttribute('list', suggestions.id);
	const tags = [...new Set(books.flatMap(book => book.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
	const suggest = (): void => {
		suggestions.replaceChildren();
		for (const name of tags.filter(name => name.includes(tag.value)).slice(0, 40)) { const option = element('option'); option.value = name; suggestions.append(option); }
	}; suggest();
	tag.addEventListener('input', suggest); tag.addEventListener('change', () => onChange({ tag: tag.value.trim() || undefined }));
	tag.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); onChange({ tag: tag.value.trim() || undefined }); } });
	bar.append(field('标签', tag), suggestions);
	add('评分', [['', '全部评分'], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), (i + 1) + ' 分及以上'] as [string, string])], String(query.minRating ?? ''), value => ({ minRating: value ? Number(value) : undefined }));
	add('状态', [['', '全部状态'], ...Object.entries(STATUS_LABELS)], query.readingStatus ?? '', value => ({ readingStatus: value as ReadingStatus || undefined }));
	add('阅读列表', [['', '全部列表'], ...lists.map(list => [list.id, list.name] as [string, string])], query.listId ?? '', value => ({ listId: value || undefined }));
	add('文件', [['', '全部文件'], ['missing', '仅缺失文件']], query.missingOnly ? 'missing' : '', value => ({ missingOnly: value === 'missing' }));
	add('排序', [['title', '书名 · 升序'], ['author', '作者 · 升序'], ['recent', '最近阅读 · 新到旧'], ['rating', '评分 · 高到低'], ['progress', '进度 · 高到低']], query.sort, value => ({ sort: value as ShelfSort }));
	return bar;
}
