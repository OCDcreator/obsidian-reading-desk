import { describe, expect, it, vi } from 'vitest';
import { dataSignature } from '../../src/data/DataValidation';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import type { ReadingDeskData } from '../../src/types/contracts';
import { completeData } from './DataRecoveryFixtures';

describe('ReadingDeskRepository replacement signature', () => {
	it('rejects a stale signature before creating pending data or calling backup/save', async () => {
		let disk = completeData();
		const save = vi.fn(async (data: ReadingDeskData) => { disk = structuredClone(data); });
		const beforeOverwrite = vi.fn(async () => undefined);
		const repository = new ReadingDeskRepository({ load: async () => disk, save }, { beforeOverwrite });
		await repository.initialize();
		const expectedSignature = dataSignature(repository.snapshot());
		await repository.updateSettings({ excerptTemplate: 'New local template' });
		const current = repository.snapshot();
		save.mockClear();
		beforeOverwrite.mockClear();
		const replacement = completeData();
		replacement.books.b.title = 'Stale backup';
		await expect(repository.replaceData(replacement, { expectedSignature })).rejects.toMatchObject({ code: 'external-conflict', message: expect.stringContaining('重新预览') });
		expect(repository.snapshot()).toEqual(current);
		expect(disk).toEqual(current);
		expect(save).not.toHaveBeenCalled();
		expect(beforeOverwrite).not.toHaveBeenCalled();
		expect(repository.status()).toMatchObject({ phase: 'ready', pending: false });
		// The signature is optional for existing callers; a rejected replacement does not poison the queue.
		await repository.replaceData(replacement);
		expect(disk.books.b.title).toBe('Stale backup');
	});

	it('retries an accepted replacement after save failure without comparing the old preview signature again', async () => {
		let disk = completeData();
		const save = vi.fn(async (data: ReadingDeskData) => { disk = structuredClone(data); });
		save.mockRejectedValueOnce(new Error('disk full'));
		const repository = new ReadingDeskRepository({ load: async () => disk, save });
		await repository.initialize();
		const expectedSignature = dataSignature(repository.snapshot());
		const replacement = completeData();
		replacement.books.b.title = 'Accepted restore';
		await expect(repository.replaceData(replacement, { expectedSignature })).rejects.toThrow('disk full');
		expect(repository.status()).toMatchObject({ phase: 'pending', pending: true });
		expect(dataSignature(repository.snapshot())).not.toBe(expectedSignature);
		expect(disk.books.b.title).toBe('Manual title');
		await repository.retry();
		expect(disk.books.b.title).toBe('Accepted restore');
		expect(save).toHaveBeenCalledTimes(2);
		expect(repository.status()).toMatchObject({ phase: 'ready', pending: false });
	});

	it('uses the protected safe-view signature for explicit recovery and still backs up the invalid original', async () => {
		const original = { books: 'damaged', settings: {} };
		let disk: unknown = structuredClone(original);
		const beforeOverwrite = vi.fn(async () => undefined);
		const repository = new ReadingDeskRepository({ load: async () => disk, save: async data => { disk = structuredClone(data); } }, { beforeOverwrite });
		await repository.initialize();
		expect(repository.status().phase).toBe('blocked');
		await repository.replaceData(completeData(), { recoverInvalid: true, expectedSignature: dataSignature(repository.snapshot()) });
		expect(beforeOverwrite).toHaveBeenCalledWith(original, expect.objectContaining({ reason: 'replace' }));
		expect((disk as ReadingDeskData).highlights.h.page).toBe(0);
		expect(repository.status()).toMatchObject({ phase: 'ready', pending: false });
	});
});
