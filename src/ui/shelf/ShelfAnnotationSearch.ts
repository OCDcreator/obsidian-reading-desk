import type { LibraryBook, HighlightColor } from '../../types/contracts';
import { parseTags } from '../../views/shelf/ShelfViewModel';
import { button, element, errorMessage, field, input, select } from './ShelfDom';
import type { ShelfViewHost } from './ShelfHost';
import { pageBooks } from './ShelfQuery';
/** Reads the host search service; never maintains an editable annotation copy. */
export class ShelfAnnotationSearch {
	private generation = 0;
	private root?: HTMLElement;
	constructor(private readonly host: ShelfViewHost) {}
	destroy(): void { this.generation++; this.root = undefined; }
	render(books: LibraryBook[]): HTMLElement {
		const root = element('section', 'rd-shelf-annotation-search'); this.root = root;
		root.setAttribute('aria-label', '全库摘录与评论检索');
		const query = input('search', '检索摘录与评论'); query.placeholder = '摘录、评论关键词';
		const tags = input('text', '标注标签'); tags.placeholder = '用逗号分隔标签';
		const chapter = input('text', '章节关键词');
		const color = select('标注颜色', [['', '全部颜色'], ['moss', '绿'], ['amber', '黄'], ['brick', '红'], ['indigo', '蓝'], ['plum', '紫']]);
		const book = input('search', '检索书籍'); book.placeholder = '书名或路径；留空检索全部';
		const fields = element('div', 'rd-shelf-filters'); fields.append(field('关键词', query), field('标签', tags), field('章节', chapter), field('颜色', color), field('书籍', book));
		const status = element('p', 'rd-setting-save-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
		const results = element('div', 'rd-shelf-annotation-results');
		const search = async (): Promise<void> => {
			const generation = ++this.generation; status.textContent = '检索中…'; results.replaceChildren();
			try {
				const bookTerm = book.value.trim().toLocaleLowerCase('zh-CN');
				const bookIds = bookTerm ? books.filter(item => [item.title, item.path].some(value => value.toLocaleLowerCase('zh-CN').includes(bookTerm))).map(item => item.id) : undefined;
				const hits = bookTerm && !bookIds?.length ? [] : await this.host.searchAnnotations?.({ text: query.value, tags: parseTags(tags.value), chapter: chapter.value || undefined, colors: color.value ? [color.value as HighlightColor] : undefined, bookIds }) ?? [];
				if (generation !== this.generation || this.root !== root) return;
				status.textContent = '找到 ' + hits.length + ' 条摘录（包含评论命中）。';
				const draw = (page: number): void => {
					results.replaceChildren(); const window = pageBooks(hits, page);
					for (const hit of window.items) {
						const item = element('article', 'rd-shelf-annotation-hit');
						const title = hit.bookTitle ?? books.find(item => item.path === hit.pdfPath)?.title ?? hit.pdfPath;
						const displayPage = hit.page + 1;
						const open = button(title + ' · 第 ' + displayPage + ' 页', '回到高亮 ' + title + ' 第 ' + displayPage + ' 页', async () => {
							try { await this.host.openHighlight?.(hit.pdfPath, hit.highlightId); }
							catch (error) { status.textContent = errorMessage(error, '无法打开高亮'); }
						}); open.disabled = !this.host.openHighlight;
						item.append(open, element('p', '', hit.text ?? ''));
						for (const comment of (hit.matchingComments ?? []).slice(0, 3)) item.append(element('p', 'rd-shelf-hit-comment', '评论：' + comment.content));
						results.append(item);
					}
					if (window.pages > 1) {
						const prev = button('上一页', '上一页检索结果', () => draw(page - 1)); prev.disabled = page <= 1;
						const next = button('下一页', '下一页检索结果', () => draw(page + 1)); next.disabled = page >= window.pages;
						results.append(prev, element('span', '', window.page + ' / ' + window.pages), next);
					}
				}; draw(1);
			} catch (error) { if (generation === this.generation && this.root === root) status.textContent = errorMessage(error, '检索失败，请重试'); }
		};
		const submit = button('检索 / 刷新结果', '检索全库摘录与评论', () => void search()); submit.disabled = !this.host.searchAnnotations;
		query.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) void search(); });
		if (!this.host.searchAnnotations) status.textContent = '当前宿主尚未接入全库检索。';
		root.append(fields, submit, status, results); return root;
	}
}
