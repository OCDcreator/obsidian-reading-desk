import { describe, expect, it } from 'vitest';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import type { LibraryBook, LibraryCategory } from '../../src/types/contracts';

describe('LibraryIndex', () => {
	it('reuses unchanged records and removes a disappeared scoped file', async () => {
		const books: Record<string, LibraryBook> = {};
		const categories: LibraryCategory[] = [];
		let calls = 0;
		const index = new LibraryIndex({ readBooks: () => books, readCategories: () => categories, commit: async change => change() }, { extract: async () => ({ title: `书 ${++calls}`, author: '作者', pageCount: 2 }) });
		await index.scan([{ path: '书/one.pdf', extension: 'pdf', stat: { mtime: 1, size: 4 } }], ['书']);
		await index.scan([{ path: '书/one.pdf', extension: 'pdf', stat: { mtime: 1, size: 4 } }], ['书']);
		expect(calls).toBe(1);
		await index.scan([], ['书']);
		expect(index.list()).toHaveLength(0);
	});

	it('retries an unchanged PDF only while a cover failure is explicitly recoverable', async () => {
		const books: Record<string, import('../../src/types/contracts').LibraryBook> = {};
		const categories: import('../../src/types/contracts').LibraryCategory[] = [];
		let calls = 0;
		const index = new LibraryIndex({ readBooks: () => books, readCategories: () => categories, commit: async change => change() }, {
			extract: async () => {
				calls += 1;
				return calls === 1 ? { title: '书', author: '', coverRetryable: true } : { title: '书', author: '', coverPath: 'covers/book.png' };
			}
		});
		const file = { path: '书/one.pdf', extension: 'pdf', stat: { mtime: 1, size: 4 } };

		await index.scan([file], ['书']);
		await index.scan([file], ['书']);
		await index.scan([file], ['书'], true);

		expect(calls).toBe(2);
		expect(index.getByPath(file.path)).toMatchObject({ coverPath: 'covers/book.png', coverRetryable: undefined });
	});
});

describe('LibraryIndex category writes', () => {
	function setup() {
		const books: Record<string, LibraryBook> = {
			one: { id: 'one', path: '书/one.pdf', format: 'pdf', title: '甲', author: '', fileSize: 1, tags: [], progress: 0, categoryId: 'c1', fingerprint: { mtime: 1, size: 1 } },
			two: { id: 'two', path: '书/two.pdf', format: 'pdf', title: '乙', author: '', fileSize: 1, tags: [], progress: 0, fingerprint: { mtime: 1, size: 1 } }
		};
		const categories: LibraryCategory[] = [
			{ id: 'c1', name: '设计', order: 0 },
			{ id: 'c2', name: '文学', order: 1 }
		];
		const index = new LibraryIndex({ readBooks: () => books, readCategories: () => categories, commit: async change => change() }, { extract: async () => ({ title: '', author: '' }) });
		return { index, books, categories };
	}

	it('renames a category in place and rejects empty names', async () => {
		const { index } = setup();
		await index.renameCategory('c1', ' 设计方法 ');
		expect(index.listCategories().find(category => category.id === 'c1')?.name).toBe('设计方法');
		await expect(index.renameCategory('c1', '   ')).rejects.toThrow('分类名称不能为空');
		await expect(index.renameCategory('missing', 'x')).rejects.toThrow('未找到分类');
	});

	it('removes a category, unassigns its books and closes the order gap', async () => {
		const { index, books, categories } = setup();
		await index.removeCategory('c1');
		expect(categories.map(category => category.id)).toEqual(['c2']);
		expect(categories[0].order).toBe(0);
		expect(books.one.categoryId).toBeUndefined();
		await expect(index.removeCategory('missing')).rejects.toThrow('未找到分类');
	});
});
