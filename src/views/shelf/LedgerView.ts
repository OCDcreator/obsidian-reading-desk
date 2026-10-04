import type { LibraryBook } from '../../types/contracts';
import { type BookCardHost } from './BookCard';
import { element } from '../../ui/shelf/ShelfDom';
import { createLedgerRow } from './ShelfLedgerRow';
import { type LedgerStats } from './ShelfViewModel';

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

export function createLedgerTable(books: LibraryBook[], context: BookCardHost): HTMLElement {
	const wrapper = element('div', 'rd-library-table-wrap'); const table = element('table', 'rd-library-table rd-ledger'); table.setAttribute('aria-label', '图书台账');
	const head = table.createTHead().insertRow();
	for (const label of [...(context.selectionMode ? ['选择'] : []), '书名', '作者', '分类', '标签', '评分', '进度', '页数', '大小']) { const cell = element('th', '', label); cell.scope = 'col'; head.append(cell); }
	const body = table.createTBody(); for (const book of books) body.append(createLedgerRow(book, context)); wrapper.append(table); return wrapper;
}

function summaryCell(value: string, label: string): HTMLElement {
	const cell = element('div', 'rd-summary-cell');
	cell.append(element('strong', 'rd-summary-value', value), element('span', 'rd-summary-label', label));
	return cell;
}
