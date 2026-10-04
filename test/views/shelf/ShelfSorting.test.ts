import { describe, expect, it } from 'vitest';
import type { LibraryBook } from '../../../src/types/contracts';
import { SHELF_SORT_LABELS, sortBooks } from '../../../src/views/shelf/ShelfSorting';

function book(id: string, title: string, lastReadAt?: number): LibraryBook {
	return { id, path: `${id}.pdf`, format: 'pdf', title, author: '', fileSize: 1, tags: [], progress: lastReadAt ? 0.2 : 0, lastReadAt, fingerprint: { mtime: 1, size: 1 } };
}

describe('ShelfSorting', () => {
	const books = [
		book('unread-b', '香蕉全书'),
		book('read-new', '最新打开', 3000),
		book('read-old', '最早打开', 1000),
		book('unread-a', '苹果手册'),
		book('read-mid', '中间打开', 2000)
	];

	it('recent mode: read books newest-first, then unread books by title', () => {
		expect(sortBooks(books, 'recent').map(item => item.id)).toEqual(['read-new', 'read-mid', 'read-old', 'unread-a', 'unread-b']);
	});

	it('title mode: everything by zh-CN title order', () => {
		const byTitle = sortBooks(books, 'title');
		expect(byTitle.map(item => item.title)).toEqual([...byTitle.map(item => item.title)].sort((left, right) => left.localeCompare(right, 'zh-CN')));
		expect(byTitle.map(item => item.id)).toContain('unread-a');
	});

	it('keeps the input array untouched and exposes stable labels', () => {
		const frozen = [...books];
		sortBooks(books, 'recent');
		expect(books.map(item => item.id)).toEqual(frozen.map(item => item.id));
		expect(SHELF_SORT_LABELS.recent).toBe('最近阅读');
		expect(SHELF_SORT_LABELS.title).toBe('书名');
	});
});
