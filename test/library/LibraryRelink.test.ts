import { describe, expect, it, vi } from 'vitest';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import { createEmptyData } from '../../src/data/defaults';
import { libraryBook, libraryFile, libraryHarness } from './LibraryTestHelpers';

describe('LibraryIndex source identity', () => {
	it('preserves stable book ID, manual metadata, lists and progress after explicit offline relink', async () => {
		const original = libraryBook('stable', 'old/book.pdf', { tags: ['research'], progress: 0.7, rating: 9, listIds: ['study'], readingStatus: 'reading', missing: true, title: '人工标题', author: '', metadataOverrides: { title: '人工标题', author: '' } });
		const { index } = libraryHarness([original]);
		const candidate = libraryFile('new/book.pdf', 3);
		expect(index.findRelinkCandidates('stable', [candidate])).toMatchObject([{ file: { path: 'new/book.pdf' }, sameName: true }]);
		await expect(index.relink('stable', candidate, { confirmed: false })).rejects.toThrow('明确确认');
		expect(index.get('stable').path).toBe('old/book.pdf');
		const result = await index.relink('stable', candidate, { confirmed: true });
		expect(result).toEqual({ bookId: 'stable', oldPath: 'old/book.pdf', newPath: 'new/book.pdf' });
		expect(index.getByPath('old/book.pdf')).toBeUndefined();
		expect(index.getByPath('new/book.pdf')).toMatchObject({ id: 'stable', missing: false, title: '人工标题', author: '', tags: ['research'], progress: 0.7, rating: 9, listIds: ['study'], readingStatus: 'reading' });
	});

	it('does not automatically merge same-name candidates and requires explicit replacement of an occupied path', async () => {
		const { index } = libraryHarness([libraryBook('stable', 'old/book.pdf')]);
		await index.scan([libraryFile('new/book.pdf')], []);
		const candidate = index.getByPath('new/book.pdf');
		expect(index.list()).toHaveLength(2);
		expect(index.get('stable').missing).toBe(true);
		await expect(index.relink('stable', libraryFile('new/book.pdf'), { confirmed: true })).rejects.toThrow('另一书目');
		expect(index.list()).toHaveLength(2);
		await index.relink('stable', libraryFile('new/book.pdf'), { confirmed: true, replaceBookId: candidate.id });
		expect(index.list()).toHaveLength(1);
		expect(index.getByPath('new/book.pdf').id).toBe('stable');
	});

	it('remaps related paths inside the same commit and can skip extraction for a known source', async () => {
		const { index, commit, extract } = libraryHarness([libraryBook('stable', 'old/book.pdf')]);
		let relatedPath = 'old/book.pdf';
		let insideCommit = false;
		commit.mockImplementation(async change => { insideCommit = true; change(); insideCommit = false; });
		const remap = vi.fn((oldPath: string, newPath: string) => {
			expect(insideCommit).toBe(true);
			expect(relatedPath).toBe(oldPath);
			relatedPath = newPath;
		});
		await index.relink('stable', libraryFile('new/book.pdf'), { confirmed: true, skipExtraction: true, mutateRelated: remap });
		expect(commit).toHaveBeenCalledTimes(1);
		expect(extract).not.toHaveBeenCalled();
		expect(relatedPath).toBe('new/book.pdf');
		expect(index.getByPath(relatedPath).id).toBe('stable');
	});

	it('propagates a remap exception and follows transactional persistence rollback for book and related data', async () => {
		let state = { books: { stable: libraryBook('stable', 'old/book.pdf') }, relatedPath: 'old/book.pdf' };
		const commit = vi.fn(async (change: () => void) => {
			const snapshot = structuredClone(state);
			try { change(); } catch (error) { state = snapshot; throw error; }
		});
		const index = new LibraryIndex({ readBooks: () => state.books, readCategories: () => [], commit }, { extract: async () => ({ title: '新标题', author: '作者' }) });
		await expect(index.relink('stable', libraryFile('new/book.pdf'), { confirmed: true, mutateRelated: () => { state.relatedPath = 'new/book.pdf'; throw new Error('bad remap'); } })).rejects.toThrow('bad remap');
		expect(state.relatedPath).toBe('old/book.pdf');
		expect(index.getByPath('old/book.pdf').id).toBe('stable');
		expect(index.getByPath('new/book.pdf')).toBeUndefined();
		await index.updateBook('stable', { title: '队列恢复' });
		expect(index.get('stable').title).toBe('队列恢复');
	});

	it('uses the real repository transaction to roll back a throwing remap and then saves book/annotation paths together', async () => {
		let persisted = createEmptyData();
		persisted.books.stable = libraryBook('stable', 'old/book.pdf');
		persisted.highlights.h = { id: 'h', pdfPath: 'old/book.pdf', page: 1, rotation: 0, rects: [{ x: 0.1, y: 0.2, width: 0.2, height: 0.1 }], text: '引用', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1 };
		const save = vi.fn(async (data: typeof persisted) => { persisted = structuredClone(data); });
		const repository = new ReadingDeskRepository({ load: async () => structuredClone(persisted), save });
		await repository.initialize();
		const index = new LibraryIndex(repository, { extract: async () => ({ title: '自动标题', author: '' }) });
		await expect(index.relink('stable', libraryFile('new/book.pdf'), {
			confirmed: true, skipExtraction: true,
			mutateRelated: (_from, to) => { repository.readHighlights().h.pdfPath = to; throw new Error('invalid related mutation'); }
		})).rejects.toThrow('invalid related mutation');
		expect(repository.readHighlights().h.pdfPath).toBe('old/book.pdf');
		expect(index.getByPath('old/book.pdf').id).toBe('stable');
		expect(index.getByPath('new/book.pdf')).toBeUndefined();
		expect(save).not.toHaveBeenCalled();
		await index.renamePaths('old', 'new', (_from, to) => { repository.readHighlights().h.pdfPath = `${to}/book.pdf`; });
		expect(save).toHaveBeenCalledTimes(1);
		expect(persisted.books.stable.path).toBe('new/book.pdf');
		expect(persisted.highlights.h.pdfPath).toBe('new/book.pdf');
	});

	it('migrates a complete folder in one commit while preserving source metadata and exact path boundaries', async () => {
		const { index, commit, extract } = libraryHarness([libraryBook('one', 'old/one.pdf'), libraryBook('two', 'old/nested/two.pdf'), libraryBook('outside', 'old-copy/three.pdf')]);
		const remap = vi.fn();
		await index.renamePaths('old', 'new', remap);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(extract).not.toHaveBeenCalled();
		expect(remap).toHaveBeenCalledWith('old', 'new');
		expect(index.getByPath('old/one.pdf')).toBeUndefined();
		expect(index.getByPath('old/nested/two.pdf')).toBeUndefined();
		expect(index.getByPath('new/one.pdf').id).toBe('one');
		expect(index.getByPath('new/nested/two.pdf').id).toBe('two');
		expect(index.getByPath('old-copy/three.pdf').id).toBe('outside');
		await index.scanFiles([libraryFile('new/one.pdf')], []);
		expect(extract).not.toHaveBeenCalled();
		expect(index.list()).toHaveLength(3);
	});

	it('rejects an online rename collision before changing any book or related reference', async () => {
		const { index, commit } = libraryHarness([libraryBook('one', 'old/one.pdf'), libraryBook('collision', 'new/one.pdf')]);
		const remap = vi.fn();
		await expect(index.renamePaths('old', 'new', remap)).rejects.toThrow('另一书目');
		expect(commit).not.toHaveBeenCalled();
		expect(remap).not.toHaveBeenCalled();
		expect(index.get('one').path).toBe('old/one.pdf');
	});
});
