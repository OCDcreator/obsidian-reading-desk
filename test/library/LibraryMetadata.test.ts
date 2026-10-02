import { describe, expect, it } from 'vitest';
import { libraryFile, libraryHarness } from './LibraryTestHelpers';

describe('LibraryIndex metadata ownership', () => {
	it('keeps manual title and intentionally empty author through changes and restores the latest automatic fields independently', async () => {
		let version = 1;
		const { index } = libraryHarness([], { extract: async () => ({ title: `自动 ${version}`, author: `作者 ${version}`, coverPath: 'cover.png' }) });
		await index.scan([libraryFile()], ['书']);
		const id = index.list()[0].id;
		await index.updateBook(id, { title: '人工标题', author: '' });
		version = 2;
		await index.scanFiles([libraryFile(undefined, 2)], ['书']);
		expect(index.get(id)).toMatchObject({ title: '人工标题', author: '', metadataOverrides: { title: '人工标题', author: '' }, autoMetadata: { title: '自动 2', author: '作者 2' } });
		await index.clearMetadataOverride(id, ['author']);
		expect(index.get(id)).toMatchObject({ title: '人工标题', author: '作者 2', metadataOverrides: { title: '人工标题' } });
		await index.clearMetadataOverride(id);
		expect(index.get(id)).toMatchObject({ title: '自动 2', author: '作者 2' });
	});

	it('retains known automatic fields and overrides on extraction failure, then recovers on manual retry', async () => {
		let fail = false;
		const { index } = libraryHarness([], { extract: async () => {
			if (fail) throw new Error('temporarily unreadable');
			return { title: '可靠标题', author: '可靠作者', pageCount: 10, coverPath: 'cover.png' };
		} });
		await index.scan([libraryFile()], ['书']);
		const id = index.list()[0].id;
		await index.updateBook(id, { author: '' });
		fail = true;
		await index.scanFiles([libraryFile(undefined, 2)], ['书']);
		expect(index.get(id)).toMatchObject({ title: '可靠标题', author: '', pageCount: 10, coverPath: 'cover.png', metadataError: 'temporarily unreadable', autoMetadata: { title: '可靠标题', author: '可靠作者' } });
		fail = false;
		await index.scanFiles([libraryFile(undefined, 2)], ['书'], true);
		expect(index.get(id).metadataError).toBeUndefined();
		expect(index.get(id).author).toBe('');
		await index.clearMetadataOverride(id, ['author']);
		expect(index.get(id).author).toBe('可靠作者');
	});

	it('keeps manual values during cover retry without freezing new automatic metadata', async () => {
		let version = 1;
		const { index } = libraryHarness([], { extract: async () => ({ title: `自动 ${version}`, author: `作者 ${version}`, coverRetryable: version === 1, coverPath: version > 1 ? 'cover.png' : undefined }) });
		await index.scan([libraryFile()], ['书']);
		const id = index.list()[0].id;
		await index.updateBook(id, { title: '人工标题', author: '' });
		version = 2;
		await index.scanFiles([libraryFile()], ['书'], true);
		expect(index.get(id)).toMatchObject({ title: '人工标题', author: '', coverPath: 'cover.png', autoMetadata: { title: '自动 2', author: '作者 2' } });
	});
});
