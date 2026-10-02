import { describe, expect, it } from 'vitest';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import { libraryBook, libraryHarness } from './LibraryTestHelpers';

describe('LibraryIndex batch organization', () => {
	it('appends, replaces and removes normalized tags with one commit per batch', async () => {
		const { index, commit } = libraryHarness([libraryBook('one', undefined, { tags: ['existing'] }), libraryBook('two')]);
		await index.batchUpdate(['one', 'two', 'one'], { tags: [' new ', 'new', ''], tagMode: 'append' });
		expect(commit).toHaveBeenCalledTimes(1);
		expect(index.get('one').tags).toEqual(['existing', 'new']);
		expect(index.get('two').tags).toEqual(['new']);
		await index.batchUpdate(['one', 'two'], { tags: ['replacement'] });
		expect(index.get('one').tags).toEqual(['replacement']);
		await index.batchUpdate(['one', 'two'], { tags: ['replacement'], tagMode: 'remove' });
		expect(index.get('one').tags).toEqual([]);
		expect(index.get('two').tags).toEqual([]);
	});

	it('sets and clears category/rating and keeps reading status independent of progress', async () => {
		const { index, categories } = libraryHarness([libraryBook('one', undefined, { progress: 1 }), libraryBook('two')]);
		categories.push({ id: 'research', name: '研究', order: 0 });
		await index.batchUpdate(['one', 'two'], { categoryId: 'research', rating: 10, readingStatus: 'abandoned' });
		expect(index.get('one')).toMatchObject({ categoryId: 'research', rating: 10, progress: 1, readingStatus: 'abandoned' });
		await index.batchUpdate(['one', 'two'], { categoryId: null, rating: null });
		expect(index.get('one').categoryId).toBeUndefined();
		expect(index.get('two').rating).toBeUndefined();
		await index.updateProgress('one', 0.2);
		expect(index.get('one').readingStatus).toBe('abandoned');
	});

	it('validates the whole batch before committing and keeps the queue usable after rejection', async () => {
		const { index, commit } = libraryHarness([libraryBook('one')]);
		await expect(index.batchUpdate(['one', 'unknown'], { tags: ['changed'] })).rejects.toThrow('未找到图书');
		await expect(index.batchUpdate(['one'], { rating: 11 })).rejects.toThrow('评分');
		await expect(index.batchUpdate(['one'], { categoryId: 'unknown' })).rejects.toThrow('未找到分类');
		expect(commit).not.toHaveBeenCalled();
		expect(index.get('one').tags).toEqual([]);
		await index.batchUpdate(['one'], { tags: ['success'] });
		expect(index.get('one').tags).toEqual(['success']);
	});

	it('uses list membership references without duplicating books and supports atomic append/remove/replace', async () => {
		const { index, commit } = libraryHarness([libraryBook('one'), libraryBook('two')]);
		const study = await index.createList(' 学习 ');
		const later = await index.createList('稍后');
		await index.batchUpdate(['one'], { listIds: [study.id] });
		await index.batchUpdate(['two'], { listIds: [later.id] });
		const before = commit.mock.calls.length;
		await index.batchUpdate(['one', 'two'], { listIds: [study.id], listMode: 'append' });
		expect(commit.mock.calls.length - before).toBe(1);
		expect(index.get('one').listIds).toEqual([study.id]);
		expect(index.get('two').listIds).toEqual([later.id, study.id]);
		await index.batchUpdate(['one', 'two'], { listIds: [study.id], listMode: 'remove' });
		expect(index.get('one').listIds).toEqual([]);
		expect(index.get('two').listIds).toEqual([later.id]);
		await index.batchUpdate(['one', 'two'], { listIds: [study.id] });
		expect(index.get('two').listIds).toEqual([study.id]);
		await index.renameList(study.id, '精读');
		expect(index.listLists()).toContainEqual({ id: study.id, name: '精读' });
		await index.deleteList(study.id);
		expect(index.get('one').listIds).toEqual([]);
		expect(index.get('two').listIds).toEqual([]);
		expect(index.list()).toHaveLength(2);
	});

	it('validates list membership and supports legacy persistence without readLists for existing operations', async () => {
		const { books, persistence } = libraryHarness([libraryBook('one')]);
		const { readLists: _readLists, ...legacy } = persistence;
		const index = new LibraryIndex(legacy, { extract: async () => ({ title: '书', author: '' }) });
		expect(index.listLists()).toEqual([]);
		await index.updateBook('one', { author: '' });
		expect(books.one.author).toBe('');
		await expect(index.createList('new')).rejects.toThrow('尚未支持');
		await expect(index.batchUpdate(['one'], { listIds: ['unknown'] })).rejects.toThrow('未找到列表');
	});
});
