import { describe, expect, it } from 'vitest';
import type { ReadingDeskData } from '../../src/types/contracts';
import { exportBookshelf, importLegacyBookshelf } from '../../src/portability/BookshelfPortabilityService';

function createData(): ReadingDeskData {
	return {
		books: {},
		categories: [{ id: 'existing', name: '已有分类', order: 0 }],
		highlights: {},
		comments: {},
		settings: {
			libraryFolders: ['Reading'],
			readerLayout: 'shelf',
			importedBookshelf: false,
			storage: {
				enabled: false,
				imageHostEnabled: false,
				provider: 'oss',
				endpoint: '',
				region: '',
				bucket: '',
				prefix: '',
				accessKeyId: '',
				secretAccessKey: ''
			}
		}
	};
}

describe('BookshelfPortabilityService', () => {
	it('imports legacy Bookshelf metadata without changing its input', () => {
		const legacy = {
			settings: { booksFolder: '资料/书籍', categories: ['研究', '小说'] },
			books: {
				one: {
					metadata: {
						id: 'old-book-1',
						filepath: '资料\\书籍\\研究 | 导论.pdf',
						title: '研究 | 导论',
						author: '张三',
						category: '研究',
						tags: ['方法', ' 中文 '],
						rating: 4.5,
						progress: 25,
						pageCount: 240,
						fileSize: '1.5 MB',
						lastReadAt: '2026-09-18T00:00:00.000Z'
					}
				}
			}
		};
		const legacyBefore = JSON.stringify(legacy);
		const current = createData();
		const currentBefore = JSON.stringify(current);

		const result = importLegacyBookshelf(legacy, current, 1234);
		const imported = result.data.books['old-book-1'];

		expect(JSON.stringify(legacy)).toBe(legacyBefore);
		expect(JSON.stringify(current)).toBe(currentBefore);
		expect(result.importedBookCount).toBe(1);
		expect(result.data.settings.importedBookshelf).toBe(true);
		expect(result.data.settings.libraryFolders).toEqual(['Reading', '资料/书籍']);
		expect(result.data.categories.map(category => category.name)).toEqual(['已有分类', '研究', '小说']);
		expect(imported).toMatchObject({
			path: '资料/书籍/研究 | 导论.pdf',
			title: '研究 | 导论',
			author: '张三',
			format: 'pdf',
			tags: ['方法', '中文'],
			rating: 4.5,
			progress: 0.25,
			pageCount: 240,
			fileSize: 1572864,
			categoryId: expect.stringMatching(/^legacy-category-/)
		});
	});

	it('is one-time and also avoids duplicate legacy paths or ids before the marker is saved', () => {
		const legacy = {
			books: [
				{ id: 'old-id', filepath: 'Books/a.pdf', title: 'A' },
				{ id: 'other-id', filepath: 'Books/a.pdf', title: 'A duplicate path' }
			]
		};
		const first = importLegacyBookshelf(legacy, createData(), 100);
		const second = importLegacyBookshelf(legacy, first.data, 200);

		expect(first.importedBookCount).toBe(1);
		expect(first.skippedBookCount).toBe(1);
		expect(Object.keys(first.data.books)).toEqual(['old-id']);
		expect(second.alreadyImported).toBe(true);
		expect(second.importedBookCount).toBe(0);
		expect(Object.keys(second.data.books)).toEqual(['old-id']);
	});

	it('uses an existing category id and disambiguates a colliding legacy id', () => {
		const data = createData();
		data.categories.push({ id: 'research-existing', name: '研究', order: 1 });
		data.books['old-id'] = {
			id: 'old-id',
			path: 'already-indexed.pdf',
			format: 'pdf',
			title: 'Already indexed',
			author: '',
			fileSize: 0,
			tags: [],
			progress: 0,
			fingerprint: { mtime: 0, size: 0 }
		};
		const result = importLegacyBookshelf({
			books: [{ id: 'old-id', filepath: 'Books/new.pdf', category: '研究' }]
		}, data, 100);
		const imported = Object.values(result.data.books).find(book => book.path === 'Books/new.pdf');

		expect(imported?.id).not.toBe('old-id');
		expect(imported?.categoryId).toBe('research-existing');
	});

	it('tolerates unknown or malformed legacy fields and derives a stable EPUB entry', () => {
		const legacy = {
			metadata: [
				{ id: 'not-a-book', unknown: { nested: true } },
				{ filepath: './书籍/没有标题.epub', progress: 'invalid', fileSize: 'unknown', tags: ['可用', 3, null] }
			]
		};
		const result = importLegacyBookshelf(legacy, createData(), 99);
		const imported = Object.values(result.data.books)[0];

		expect(result.importedBookCount).toBe(1);
		expect(result.skippedBookCount).toBe(1);
		expect(imported).toMatchObject({
			path: '书籍/没有标题.epub',
			title: '没有标题',
			format: 'epub',
			fileSize: 0,
			progress: 0,
			tags: ['可用']
		});
		expect(imported.id).toMatch(/^legacy-bookshelf-/);
	});

	it('exports stable Markdown and JSON with Chinese metadata and escaped table values', async () => {
		const data = createData();
		data.categories.push({ id: 'research', name: '研究 | 方法', order: 1 });
		data.books['book-1'] = {
			id: 'book-1',
			path: '书籍/研究 | 导论.pdf',
			format: 'pdf',
			title: '研究 | 导论\n第二版',
			author: '张三',
			pageCount: 120,
			fileSize: 1024,
			categoryId: 'research',
			tags: ['中文', 'a|b'],
			rating: 4.5,
			progress: 0.625,
			fingerprint: { mtime: 1, size: 1024 }
		};

		const bundle = exportBookshelf(data, new Date('2026-09-18T01:02:03.000Z'));
		const parsed = JSON.parse(bundle.json) as { metadata: { bookCount: number }; books: Array<{ category: string; tags: string[]; progress: number }> };

		expect(bundle.markdown).toContain('导出时间：2026-09-18T01:02:03.000Z');
		expect(bundle.markdown).toContain('研究 \\| 导论<br>第二版');
		expect(bundle.markdown).toContain('研究 \\| 方法');
		expect(bundle.markdown).toContain('a\\|b');
		expect(bundle.markdown).toContain('63%');
		expect(parsed.metadata.bookCount).toBe(1);
		expect(parsed.books[0]).toMatchObject({ category: '研究 | 方法', tags: ['中文', 'a|b'], progress: 0.625 });
		expect(await bundle.markdownBlob.text()).toBe(bundle.markdown);
		expect(await bundle.jsonBlob.text()).toBe(bundle.json);
	});
});
