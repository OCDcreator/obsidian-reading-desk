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
