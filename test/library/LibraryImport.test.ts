import { describe, expect, it } from 'vitest';
import { libraryBook, libraryFile, libraryHarness } from './LibraryTestHelpers';

describe('LibraryIndex bibliographic import', () => {
	it('updates the same source idempotently while preserving manual values and organization', async () => {
		const { index } = libraryHarness();
		const source = { provider: 'csl' as const, id: 'ref-1', doi: '10.example/ref' };
		const first = await index.updateImport({ source, path: '书/one.pdf', title: '上游1', author: '作者1' });
		await index.updateBook(first.id, { title: '人工标题', author: '', tags: ['keep'], rating: 9, readingStatus: 'reading' });
		await index.updateProgress(first.id, 0.8);
		const updated = await index.updateImport({ source, path: '书/one.pdf', title: '上游2', author: '作者2', tags: ['imported'] });
		expect(updated.id).toBe(first.id);
		expect(index.list()).toHaveLength(1);
		expect(updated).toMatchObject({ title: '人工标题', author: '', progress: 0.8, rating: 9, readingStatus: 'reading', tags: ['keep', 'imported'], autoMetadata: { title: '上游2', author: '作者2' }, source });
		await index.clearMetadataOverride(first.id);
		expect(index.get(first.id)).toMatchObject({ title: '上游2', author: '作者2' });
	});

	it('applies a multi-book plan with one commit and reuses an explicitly selected existing path', async () => {
		const { index, commit } = libraryHarness([libraryBook('existing', '书/one.pdf', { metadataOverrides: { author: '' }, author: '', missing: true })]);
		const source = { provider: 'bibtex' as const, id: 'ref-1', citationKey: 'cite' };
		await index.applyImportedBooks([
			libraryBook('external-id', '书/one.pdf', { title: '人工标题', author: '', autoMetadata: { title: '上游标题', author: '上游作者' }, source, missing: false }),
			libraryBook('new', '书/two.pdf', { source: { provider: 'csl', id: 'ref-2' } })
		]);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(index.list()).toHaveLength(2);
		expect(index.getByPath('书/one.pdf')).toMatchObject({ id: 'existing', title: '上游标题', author: '', missing: false, autoMetadata: { title: '上游标题', author: '上游作者' }, source });
		expect(index.get('external-id')).toBeUndefined();
	});

	it('rejects conflicting source/path identities before committing any planned writes', async () => {
		const source = { provider: 'zotero' as const, id: 'library:ABC' };
		const { index, commit } = libraryHarness([libraryBook('one', undefined, { source }), libraryBook('two')]);
		await expect(index.applyImportedBooks([
			libraryBook('would-be-new'),
			libraryBook('incoming', '书/two.pdf', { source })
		])).rejects.toThrow('身份冲突');
		expect(commit).not.toHaveBeenCalled();
		expect(index.get('would-be-new')).toBeUndefined();
		expect(index.list()).toHaveLength(2);
		await expect(index.updateImport({ source, path: 'moved/one.pdf', title: '书', author: '' })).rejects.toThrow('重新关联');
	});

	it('rejects duplicate existing source records instead of choosing an arbitrary identity', async () => {
		const source = { provider: 'csl' as const, id: 'duplicate' };
		const { index, commit } = libraryHarness([libraryBook('one', undefined, { source }), libraryBook('two', undefined, { source })]);
		await expect(index.updateImport({ source, path: '书/one.pdf', title: '书', author: '' })).rejects.toThrow('身份冲突');
		expect(commit).not.toHaveBeenCalled();
	});

	it('retains bibliographic automatic fields when a PDF scan refreshes cover and page metadata', async () => {
		const { index } = libraryHarness();
		const imported = await index.updateImport({ source: { provider: 'csl', id: 'ref' }, path: '书/one.pdf', title: '文献标题', author: '文献作者' });
		await index.scanFiles([libraryFile()], ['书']);
		expect(index.get(imported.id)).toMatchObject({ title: '文献标题', author: '文献作者', pageCount: 2, coverPath: 'covers/one.png', missing: false, autoMetadata: { title: '文献标题', author: '文献作者' } });
	});
});
