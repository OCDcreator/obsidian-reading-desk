import type { LibraryBook } from '../../types/contracts';
import type { ShelfSortMode } from './ShelfViewModel';

export const SHELF_SORT_LABELS: Record<ShelfSortMode, string> = {
	recent: '最近阅读',
	title: '书名'
};

/**
 * 最近阅读（默认）：有阅读记录的书按时间倒序在前，未读的书按书名排在后面；
 * 书名：全部按中文标题排序。排序是视图层策略，数据层不保存排序状态。
 */
export function sortBooks(books: LibraryBook[], mode: ShelfSortMode): LibraryBook[] {
	const copies = [...books];
	if (mode === 'title') {
		return copies.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
	}
	return copies.sort((left, right) => {
		const leftRead = left.lastReadAt ?? 0;
		const rightRead = right.lastReadAt ?? 0;
		if (leftRead > 0 && rightRead > 0) return rightRead - leftRead;
		if (leftRead > 0) return -1;
		if (rightRead > 0) return 1;
		return left.title.localeCompare(right.title, 'zh-CN');
	});
}
