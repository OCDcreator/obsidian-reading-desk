import { describe, expect, it } from 'vitest';
import type { LibraryBook, LibraryCategory } from '../../../src/types/contracts';
import {
	categoryBookCount,
	filterBooks,
	formatFileSize,
	formatProgress,
	parseTags,
	ShelfSearchController,
	sortCategories,
	shouldShowContinueReading
} from '../../../src/views/shelf/ShelfViewModel';

const books: LibraryBook[] = [
	{
		id: 'one', path: '研究/光.pdf', format: 'pdf', title: '光的研究', author: '王明', pageCount: 12,
		fileSize: 1024, tags: ['物理', '实验'], progress: 0.25, categoryId: 'science', fingerprint: { mtime: 1, size: 1024 }
	},
	{
		id: 'two', path: '小说/河.epub', format: 'epub', title: '河流', author: '李青',
		fileSize: 2 * 1024 * 1024, tags: ['文学'], progress: 2, categoryId: 'fiction', fingerprint: { mtime: 2, size: 2 }
	}
];

describe('ShelfViewModel', () => {
	it('按中文标题、作者和标签筛选，并保留分类约束', () => {
		expect(filterBooks(books, { query: '研究' }).map(book => book.id)).toEqual(['one']);
		expect(filterBooks(books, { query: '王明' }).map(book => book.id)).toEqual(['one']);
		expect(filterBooks(books, { query: '文学', categoryId: 'science' })).toEqual([]);
	});

	it('按持久化顺序组织分类并计算分类计数', () => {
		const categories: LibraryCategory[] = [
			{ id: 'fiction', name: '文学', order: 2 },
			{ id: 'science', name: '科学', order: 1 }
		];
		expect(sortCategories(categories).map(category => category.id)).toEqual(['science', 'fiction']);
		expect(categoryBookCount(books, 'science')).toBe(1);
	});

	it('提供稳定的文件、进度和标签显示值', () => {
		expect(formatFileSize(1024)).toBe('1.0 KB');
		expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
		expect(formatProgress(-1)).toBe('0%');
		expect(formatProgress(1.2)).toBe('100%');
		expect(parseTags('物理， 实验,物理')).toEqual(['物理', '实验']);
	});
});

describe('Shelf search composition', () => {
	it('defers filtering during IME composition and commits once composition ends', () => {
		const search = new ShelfSearchController();
		search.beginComposition();
		expect(search.input('yan')).toBeNull();
		expect(search.endComposition('研究')).toBe('研究');
		expect(search.input('研究资料')).toBe('研究资料');
	});

	it('does not show continue-reading cards for a search or category filter', () => {
		expect(shouldShowContinueReading({ query: '' })).toBe(true);
		expect(shouldShowContinueReading({ query: '研究' })).toBe(false);
		expect(shouldShowContinueReading({ query: '', categoryId: 'science' })).toBe(false);
	});
});
