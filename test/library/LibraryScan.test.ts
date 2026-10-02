import { describe, expect, it } from 'vitest';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import { libraryBook, libraryFile, libraryHarness } from './LibraryTestHelpers';

describe('LibraryIndex incremental scans', () => {
	it('extracts only the changed file in a large library and never marks omitted records missing', async () => {
		const initial = Array.from({ length: 10000 }, (_, i) => libraryBook(`book-${i}`));
		const { index, extract, commit } = libraryHarness(initial);
		await index.scanFiles([libraryFile(initial[500].path, 2)], ['书']);
		expect(extract).toHaveBeenCalledTimes(1);
		expect(extract.mock.calls[0][0].path).toBe(initial[500].path);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(index.list()).toHaveLength(10000);
		expect(index.list().some(book => book.missing)).toBe(false);
		await index.scanFiles([], ['书']);
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('deduplicates repeated paths and commits each event batch only once', async () => {
		const { index, extract, commit } = libraryHarness([libraryBook('other')]);
		await index.applyFileEvents([
			{ type: 'upsert', file: libraryFile(undefined, 1) },
			{ type: 'delete', path: '书/one.pdf' },
			{ type: 'upsert', file: libraryFile(undefined, 3) },
			{ type: 'delete', path: '书/other.pdf' }
		], ['书']);
		expect(extract).toHaveBeenCalledTimes(1);
		expect(extract.mock.calls[0][0].stat.mtime).toBe(3);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(index.getByPath('书/other.pdf')).toMatchObject({ id: 'other', missing: true });
		expect(index.getByPath('书/one.pdf')?.missing).toBe(false);
	});

	it('full reconciliation preserves IDs, organization and out-of-scope records and reappearance clears missing', async () => {
		const original = libraryBook('one', '书/one.pdf', { progress: 0.6, tags: ['重要'], rating: 8, listIds: ['study'], readingStatus: 'reading' });
		const { index, extract } = libraryHarness([original, libraryBook('outside', '书外/other.pdf')]);
		await index.scan([], ['书']);
		expect(index.get('one')).toMatchObject({ id: 'one', missing: true, progress: 0.6, tags: ['重要'], rating: 8, listIds: ['study'], readingStatus: 'reading' });
		expect(index.get('outside').missing).toBeUndefined();
		await index.scanFiles([libraryFile()], ['书']);
		expect(index.get('one').missing).toBe(false);
		expect(extract).not.toHaveBeenCalled();
	});

	it('marks folder descendants missing without using ambiguous path prefixes', async () => {
		const { index } = libraryHarness([libraryBook('one'), libraryBook('two', '书/nested/two.pdf'), libraryBook('other', '书外/other.pdf')]);
		await index.markMissing('书');
		expect(index.get('one').missing).toBe(true);
		expect(index.get('two').missing).toBe(true);
		expect(index.get('other').missing).toBeUndefined();
	});

	it('rebuilds path lookup after repository replacement and explicit in-place restore', async () => {
		let books = { one: libraryBook('one') };
		const index = new LibraryIndex({ readBooks: () => books, readCategories: () => [], commit: async change => change() }, { extract: async () => ({ title: '书', author: '' }) });
		expect(index.getByPath('书/one.pdf')?.id).toBe('one');
		books = { one: libraryBook('one', '移后/one.pdf') };
		expect(index.getByPath('移后/one.pdf')?.id).toBe('one');
		expect(index.getByPath('书/one.pdf')).toBeUndefined();
		books.one.path = '恢复/one.pdf';
		index.rebuildPathMap();
		expect(index.getByPath('恢复/one.pdf')?.id).toBe('one');
	});

	it('serializes scan with edits so a slow extraction cannot overwrite a later override', async () => {
		let release: () => void;
		const waiting = new Promise<void>(resolve => { release = resolve; });
		const { index } = libraryHarness([libraryBook('one')], { extract: async () => { await waiting; return { title: '提取标题', author: '作者' }; } });
		const scanning = index.scanFiles([libraryFile(undefined, 2)], ['书']);
		const editing = index.updateBook('one', { title: '用户最后编辑' });
		release();
		await Promise.all([scanning, editing]);
		expect(index.get('one')).toMatchObject({ title: '用户最后编辑', autoMetadata: { title: '提取标题' } });
	});
});
