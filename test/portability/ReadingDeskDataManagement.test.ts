import { describe, expect, it, vi } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import { createEmptyData } from '../../src/data/defaults';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import { ReadingDeskDataManagement } from '../../src/portability/ReadingDeskDataManagement';
import type { ReadingDeskBackup } from '../../src/portability/ReadingDeskBackupService';
import { TargetService } from '../../src/targets/TargetService';
import { highlight } from '../data/DataRecoveryFixtures';

async function setup() {
	let disk: unknown = createEmptyData();
	let failSave = false;
	const repository = new ReadingDeskRepository({ load: async () => structuredClone(disk), save: async data => { if (failSave) throw new Error('disk full'); disk = structuredClone(data); } });
	await repository.initialize();
	const library = new LibraryIndex(repository, { extract: async () => ({ title: 'Extracted', author: 'Automatic' }) });
	const annotations = new AnnotationStore(repository);
	const targets = new TargetService({ atomicTransform: async () => undefined });
	const backup = vi.fn<(value: ReadingDeskBackup) => Promise<void>>().mockResolvedValue(undefined);
	const refresh = vi.fn(async () => undefined);
	const management = new ReadingDeskDataManagement(repository, library, annotations, targets, {
		availableFiles: () => [{ path: 'Books/a.pdf', stat: { mtime: 1, size: 10 } }], backupBeforeRestore: backup, refresh
	});
	return { repository, library, annotations, management, backup, refresh, setFail: (value: boolean) => { failSave = value; } };
}
const csl = JSON.stringify([{ id: 'paper-a', type: 'article-journal', title: 'Paper A', author: [{ family: 'Example', given: 'A' }] }]);

describe('ReadingDeskDataManagement integration', () => {
	it('recomputes an import instead of trusting mutated presentation, protects manual values and rejects stale previews', async () => {
		const { library, management } = await setup();
		const preview = management.prepareBibliographicImport('csl', csl, { 'csl:paper-a': 'Books/a.pdf' });
		preview.resultBooks[0].title = 'Tampered';
		await management.applyBibliographicImport(preview);
		expect(library.list()[0].title).toBe('Paper A');
		await expect(management.applyBibliographicImport(preview)).rejects.toThrow('预览');
		const next = management.prepareBibliographicImport('csl', csl, {});
		await library.updateBook(library.list()[0].id, { title: 'Manual' });
		await expect(management.applyBibliographicImport(next)).rejects.toThrow('书库已变化');
		const fresh = management.prepareBibliographicImport('csl', JSON.stringify([{ id: 'paper-a', type: 'article-journal', title: 'New upstream' }]), {});
		await management.applyBibliographicImport(fresh);
		expect(library.list()[0].title).toBe('Manual');
	});
	it('replaces differing data by default only after preserving the current data', async () => {
		const { repository, management, backup, refresh } = await setup();
		const text = management.exportBackup();
		await repository.updateSettings({ libraryFolders: ['Current'] });
		const preview = management.previewBackup(text, {});
		expect(preview.canApply).toBe(true);
		await management.restoreBackup(preview);
		expect(backup).toHaveBeenCalledOnce();
		expect(backup.mock.calls[0]?.[0]?.data.settings.libraryFolders).toEqual(['Current']);
		expect(repository.readSettings().libraryFolders).toEqual([]);
		expect(refresh).toHaveBeenCalledOnce();
	});
	it('blocks restore when the pre-restore backup fails and excludes credentials from exported backup', async () => {
		const { repository, management, backup } = await setup();
		await repository.updateSettings({ storage: { ...repository.readSettings().storage, accessKeyId: 'private-key', secretAccessKey: 'private-secret' } });
		const text = management.exportBackup();
		expect(text).not.toContain('private-key'); expect(text).not.toContain('private-secret');
		const preview = management.previewBackup(text, {});
		backup.mockRejectedValueOnce(new Error('backup unavailable'));
		await expect(management.restoreBackup(preview)).rejects.toThrow('备份失败');
		expect(repository.readSettings().storage.secretAccessKey).toBe('private-secret');
	});
	it('refuses to discard a failed comment that was queued before an ordinary reload', async () => {
		const { repository, annotations, management, backup, setFail } = await setup();
		await annotations.save(highlight());
		setFail(true);
		const save = annotations.addComment('h', 'Queued comment', 'pdf').catch(error => error);
		const reload = management.reloadRepository().catch(error => error);
		expect(await save).toBeInstanceOf(Error);
		expect(await reload).toBeInstanceOf(Error);
		expect(annotations.comments('h').map(comment => comment.content)).toEqual(['Queued comment']);
		expect(repository.status().pending).toBe(true);
		expect(backup).not.toHaveBeenCalled();
	});
	it('preserves comments added while the pending-state backup is paused', async () => {
		const { repository, annotations, management, backup, setFail } = await setup();
		await annotations.save(highlight());
		setFail(true);
		await expect(annotations.addComment('h', 'A', 'pdf')).rejects.toThrow('未保存');
		let release: () => void = () => undefined;
		const paused = new Promise<void>(resolve => { release = resolve; });
		backup.mockImplementationOnce(() => paused);
		const reload = management.reloadRepository().catch(error => error);
		await expect(annotations.addComment('h', 'B', 'pdf')).rejects.toThrow('未保存');
		release();
		expect(await reload).toBeInstanceOf(Error);
		expect(backup.mock.calls[0]?.[0]?.data.comments.h.map(comment => comment.content)).toEqual(['A']);
		expect(annotations.comments('h').map(comment => comment.content)).toEqual(['A', 'B']);
		expect(repository.status().pending).toBe(true);
	});
	it('uses the original signature including credentials when protecting a backed-up reload', async () => {
		const { repository, management, backup, setFail } = await setup();
		setFail(true);
		await expect(repository.updateSettings({ libraryFolders: ['Pending'] })).rejects.toThrow('未保存');
		let release: () => void = () => undefined;
		const paused = new Promise<void>(resolve => { release = resolve; });
		backup.mockImplementationOnce(() => paused);
		const reload = management.reloadRepository().catch(error => error);
		await expect(repository.updateSettings({ storage: { ...repository.readSettings().storage, secretAccessKey: 'new-private-secret' } })).rejects.toThrow('未保存');
		release();
		expect(await reload).toBeInstanceOf(Error);
		expect(repository.readSettings().storage.secretAccessKey).toBe('new-private-secret');
		expect(repository.status().pending).toBe(true);
	});
	it('backs up pending state before explicit reload and refuses to discard when that backup fails', async () => {
		const { repository, management, backup, setFail } = await setup();
		setFail(true);
		await expect(repository.updateSettings({ libraryFolders: ['Pending'] })).rejects.toThrow('未保存');
		backup.mockRejectedValueOnce(new Error('cannot preserve'));
		await expect(management.reloadRepository()).rejects.toThrow('cannot preserve');
		expect(repository.readSettings().libraryFolders).toEqual(['Pending']);
		setFail(false); await management.reloadRepository();
		expect(repository.readSettings().libraryFolders).toEqual([]);
	});
});
