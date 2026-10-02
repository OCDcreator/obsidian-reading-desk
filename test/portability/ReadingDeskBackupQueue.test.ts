import { describe, expect, it, vi } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { ReadingDeskRepository, type RepositoryReplaceOptions } from '../../src/data/ReadingDeskRepository';
import { ReadingDeskBackupService } from '../../src/portability/ReadingDeskBackupService';
import type { ReadingDeskData } from '../../src/types/contracts';
import { completeData } from '../data/DataRecoveryFixtures';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(done => { resolve = done; });
	return { promise, resolve };
}

describe('backup restore repository queue protection', () => {
	it('preserves a fulfilled comment queued during backup and rejects the obsolete replacement', async () => {
		const initial = completeData();
		let disk = structuredClone(initial);
		const queuePaused = deferred();
		const releaseQueue = deferred();
		let pauseLoad = false;
		const save = vi.fn(async (value: ReadingDeskData) => { disk = structuredClone(value); });
		const repository = new ReadingDeskRepository({
			load: async () => {
				if (pauseLoad) {
					pauseLoad = false;
					queuePaused.resolve();
					await releaseQueue.promise;
				}
				return structuredClone(disk);
			}, save
		});
		await repository.initialize();
		const annotations = new AnnotationStore(repository);
		const backups = new ReadingDeskBackupService();
		const incoming = structuredClone(initial);
		incoming.books.b.title = 'Obsolete replacement';
		const preview = backups.previewRestore(backups.exportBackup(incoming), repository.snapshot(), { conflictPolicy: 'use-backup' });
		const backupPaused = deferred();
		const releaseBackup = deferred();
		const replacementQueued = deferred();
		const replaceData = vi.fn((data: ReadingDeskData, options?: RepositoryReplaceOptions) => {
			const replacement = repository.replaceData(data, options);
			replacementQueued.resolve();
			return replacement;
		});
		const restore = backups.restore(preview, {
			snapshot: () => repository.snapshot(), status: () => repository.status(), replaceData,
			backupBeforeRestore: async () => { backupPaused.resolve(); await releaseBackup.promise; }
		});
		// Observe outcomes immediately so a rejection cannot become an unhandled promise.
		const restoreResult = restore.then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
		await backupPaused.promise;
		// A reload blocked on sink I/O holds the real queue without changing its current data/status.
		pauseLoad = true;
		const reload = repository.reload();
		await queuePaused.promise;
		const comment = annotations.addComment('h', 'Comment added after preview', 'pdf');
		expect(repository.readComments().h).toEqual(initial.comments.h);
		releaseBackup.resolve();
		await replacementQueued.promise;
		expect(replaceData).toHaveBeenCalledTimes(1);
		expect(repository.readComments().h).toEqual(initial.comments.h);
		releaseQueue.resolve();
		await reload;
		const savedComment = await comment;
		const result = await restoreResult;
		expect(result.error).toMatchObject({ code: 'external-conflict', message: expect.stringContaining('重新预览') });
		expect(result.value).toBeUndefined();
		expect(repository.readComments().h).toContainEqual(savedComment);
		expect(disk.comments.h).toContainEqual(savedComment);
		expect(repository.readBooks().b.title).toBe(initial.books.b.title);
		expect(disk.books.b.title).toBe(initial.books.b.title);
		expect(save).toHaveBeenCalledTimes(1);
		expect(repository.status()).toMatchObject({ phase: 'ready', pending: false });
	});
});
