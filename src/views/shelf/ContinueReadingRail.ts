import type { LibraryBook } from '../../types/contracts';
import { createContinueCard, type BookCardHost } from './BookCard';
import { element, linkButton } from './ShelfDom';
import { continueReadingBooks } from './ShelfViewModel';

export interface ContinueRailHost extends BookCardHost {
	onToggleHistory(): void;
}

/** 继续阅读横轨：标题行右侧的「查看阅读记录」把主列表切到阅读记录筛选态。 */
export function createContinueReadingRail(books: LibraryBook[], historyActive: boolean, host: ContinueRailHost): HTMLElement | undefined {
	const continuing = continueReadingBooks(books);
	if (continuing.length === 0) return undefined;
	const heading = element('div', 'rd-section-heading');
	const title = element('div', 'rd-section-title');
	title.append(element('h2', 'rd-section-heading-main', '继续阅读'), element('span', 'rd-section-note', '按最近打开排序'));
	const link = linkButton('查看阅读记录', '筛选出有阅读记录的图书', () => host.onToggleHistory());
	link.setAttribute('aria-pressed', String(historyActive));
	heading.append(title, link);
	const rail = element('div', 'rd-continue-reading-list');
	for (const book of continuing) rail.append(createContinueCard(book, host));
	const section = element('section', 'rd-continue-reading');
	section.setAttribute('aria-label', '继续阅读');
	section.append(heading, rail);
	return section;
}
