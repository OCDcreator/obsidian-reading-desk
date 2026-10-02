import { describe, expect, it, vi } from 'vitest';
import { ReadingDeskRepository, type DataSink } from '../../src/data/ReadingDeskRepository';
import { createEmptyData } from '../../src/data/defaults';
import type { ReadingDeskData } from '../../src/types/contracts';
import { completeData } from './DataRecoveryFixtures';

function memorySink(initial: unknown = createEmptyData()) {
	let disk = structuredClone(initial);
	const save = vi.fn(async (value: ReadingDeskData) => { disk = structuredClone(value); });
	const sink: DataSink = { load: async () => structuredClone(disk), save };
	return { sink, save, get: () => disk, set: (value: unknown) => { disk = structuredClone(value); } };
}

describe('ReadingDeskRepository recovery and concurrency', () => {
	it('loads real first-page legacy data with zero-based deleted and pending annotations', async () => {
		const data = completeData();
		delete data.schemaVersion;
		const memory = memorySink(data);
		const repository = new ReadingDeskRepository(memory.sink);
		await repository.initialize();
		expect(repository.status().phase).toBe('ready');
		expect(repository.readHighlights().h.page).toBe(0);
		expect(repository.readPendingTargetWrites().intent.page).toBe(0);
		expect(repository.readDeletedAnnotations().deleted.highlight.page).toBe(0);
		expect(repository.readLists()).toEqual(data.lists);
		expect(memory.save).not.toHaveBeenCalled();
	});

	it.each(['not-an-object', [], { books: 'broken', highlights: {} }, { books: {}, schemaVersion: 99 }])('protects malformed original data without an empty-library overwrite', async original => {
		const memory = memorySink(original);
		const repository = new ReadingDeskRepository(memory.sink);
		await expect(repository.initialize()).resolves.toBeUndefined();
		expect(repository.status()).toMatchObject({ phase: 'blocked', initialized: false, pending: false });
		expect(repository.status().diagnostics.length).toBeGreaterThan(0);
		expect(repository.recoverySnapshot()).toEqual(original);
		const mutator = vi.fn();
		await expect(repository.commit(mutator)).rejects.toMatchObject({ code: 'invalid-data' });
		await expect(repository.replaceData(createEmptyData())).rejects.toThrow('原始数据被保护');
		expect(mutator).not.toHaveBeenCalled();
		expect(memory.save).not.toHaveBeenCalled();
		expect(memory.get()).toEqual(original);
	});

	it('publishes a load failure and reloads after the host repairs it', async () => {
		let failing = true;
		const repository = new ReadingDeskRepository({ load: async () => { if (failing) throw new Error('parse error'); return completeData(); }, save: vi.fn() });
		await repository.initialize();
		expect(repository.status()).toMatchObject({ phase: 'blocked', error: { code: 'load-failed' } });
		await expect(repository.commit(() => undefined)).rejects.toThrow('parse error');
		failing = false;
		await repository.reload();
		expect(repository.status().phase).toBe('ready');
		expect(repository.readBooks().b.title).toBe('Manual title');
	});

	it('retains unsaved data, retries the snapshot once and does not replay a mutator', async () => {
		const memory = memorySink();
		memory.save.mockRejectedValueOnce(new Error('disk full'));
		const repository = new ReadingDeskRepository(memory.sink);
		let calls = 0;
		await expect(repository.commit(() => { calls += 1; repository.readSettings().libraryFolders.push('first'); })).rejects.toThrow('disk full');
		expect(repository.status()).toMatchObject({ phase: 'pending', pending: true, error: { code: 'save-failed' } });
		expect(repository.readSettings().libraryFolders).toEqual(['first']);
		await expect(repository.reload()).rejects.toMatchObject({ code: 'pending-changes' });
		await repository.retry();
		expect(calls).toBe(1);
		expect(memory.save).toHaveBeenCalledTimes(2);
		expect(repository.status()).toMatchObject({ phase: 'ready', pending: false });
		expect((memory.get() as ReadingDeskData).settings.libraryFolders).toEqual(['first']);
	});

	it('rolls back a throwing or invalid mutator without damaging an earlier pending snapshot', async () => {
		const memory = memorySink();
		memory.save.mockRejectedValueOnce(new Error('temporary'));
		const repository = new ReadingDeskRepository(memory.sink);
		await expect(repository.updateSettings({ libraryFolders: ['keep'] })).rejects.toThrow('temporary');
		await expect(repository.commit(() => { repository.readSettings().libraryFolders.push('rollback'); throw new Error('mutator failed'); })).rejects.toThrow('mutator failed');
		expect(repository.readSettings().libraryFolders).toEqual(['keep']);
		await expect(repository.commit(() => { repository.readSettings().viewer.scrollMode = 'broken' as 'single'; })).rejects.toThrow('scrollMode');
		await repository.retry();
		expect((memory.get() as ReadingDeskData).settings.libraryFolders).toEqual(['keep']);
	});

	it('preserves references used by already-queued closures after successful validation', async () => {
		const memory = memorySink();
		const repository = new ReadingDeskRepository(memory.sink);
		await repository.initialize();
		const categories = repository.readCategories();
		await Promise.all([
			repository.commit(() => { categories.push({ id: 'a', name: 'A', order: 0 }); }),
			repository.commit(() => { categories.push({ id: 'b', name: 'B', order: 1 }); })
		]);
		expect((memory.get() as ReadingDeskData).categories.map(category => category.id)).toEqual(['a', 'b']);
	});

	it('detects two stale writers before executing the second mutator and reloads without loss', async () => {
		const memory = memorySink();
		const first = new ReadingDeskRepository(memory.sink);
		const second = new ReadingDeskRepository(memory.sink);
		await Promise.all([first.initialize(), second.initialize()]);
		await first.updateSettings({ libraryFolders: ['new'] });
		const mutator = vi.fn(() => { second.readSettings().viewer.scrollMode = 'single'; });
		await expect(second.commit(mutator)).rejects.toMatchObject({ code: 'external-conflict' });
		expect(mutator).not.toHaveBeenCalled();
		expect(second.status()).toMatchObject({ phase: 'conflict', pending: false });
		await second.reload();
		await second.updateSettings({ viewer: { ...second.readSettings().viewer, scrollMode: 'single' } });
		expect((memory.get() as ReadingDeskData).settings.libraryFolders).toEqual(['new']);
	});

	it('checks external data again after a backup callback and retains the pending candidate', async () => {
		const memory = memorySink();
		const external = createEmptyData();
		external.settings.libraryFolders = ['external'];
		const beforeOverwrite = vi.fn(async () => { memory.set(external); });
		const repository = new ReadingDeskRepository(memory.sink, { beforeOverwrite });
		await expect(repository.updateSettings({ libraryFolders: ['local'] })).rejects.toMatchObject({ code: 'external-conflict' });
		expect(memory.save).not.toHaveBeenCalled();
		expect(repository.status()).toMatchObject({ phase: 'conflict', pending: true });
		await expect(repository.retry()).rejects.toMatchObject({ code: 'external-conflict' });
		expect(repository.readSettings().libraryFolders).toEqual(['local']);
		await repository.reload({ discardPending: true });
		expect(repository.readSettings().libraryFolders).toEqual(['external']);
	});

	it('keeps original data and retries when a required host backup fails', async () => {
		const original = completeData();
		const memory = memorySink(original);
		const beforeOverwrite = vi.fn().mockRejectedValueOnce(new Error('backup offline')).mockResolvedValue(undefined);
		const repository = new ReadingDeskRepository(memory.sink, { beforeOverwrite });
		await expect(repository.updateSettings({ libraryFolders: ['edited'] })).rejects.toMatchObject({ code: 'backup-failed' });
		expect(memory.get()).toEqual(original);
		expect(memory.save).not.toHaveBeenCalled();
		await repository.retry();
		expect(beforeOverwrite).toHaveBeenLastCalledWith(original, expect.objectContaining({ reason: 'retry' }));
		expect(repository.status().pending).toBe(false);
	});

	it('acknowledges a snapshot that was written successfully before a sink rejected', async () => {
		const memory = memorySink();
		let attempts = 0;
		memory.sink.save = async value => { attempts += 1; memory.set(value); throw new Error('post-write error'); };
		const repository = new ReadingDeskRepository(memory.sink);
		await expect(repository.updateSettings({ libraryFolders: ['written'] })).rejects.toThrow('post-write error');
		await repository.retry();
		expect(attempts).toBe(1);
		expect(repository.status()).toMatchObject({ phase: 'ready', pending: false });
	});

	it('only replaces invalid data with explicit recovery and a successful original-data backup', async () => {
		const original = { books: 'bad', settings: {} };
		const memory = memorySink(original);
		const beforeOverwrite = vi.fn(async () => undefined);
		const repository = new ReadingDeskRepository(memory.sink, { beforeOverwrite });
		await repository.initialize();
		await repository.replaceData(completeData(), { recoverInvalid: true });
		expect(beforeOverwrite).toHaveBeenCalledWith(original, expect.objectContaining({ reason: 'replace' }));
		expect(repository.status().phase).toBe('ready');
		expect((memory.get() as ReadingDeskData).highlights.h.page).toBe(0);
	});

	it('refuses an incomplete replacement instead of clearing existing records', async () => {
		const memory = memorySink(completeData());
		const repository = new ReadingDeskRepository(memory.sink);
		await repository.initialize();
		await expect(repository.replaceData(null)).rejects.toThrow('普通对象');
		await expect(repository.replaceData({ books: {} })).rejects.toThrow('完整备份');
		expect(repository.readHighlights().h.page).toBe(0);
		expect(memory.save).not.toHaveBeenCalled();
	});

	it('isolates status listeners and returned snapshots from persistence', async () => {
		const memory = memorySink();
		const repository = new ReadingDeskRepository(memory.sink);
		const phases: string[] = [];
		repository.subscribe(() => { throw new Error('UI error'); });
		const unsubscribe = repository.subscribe(state => { phases.push(state.phase); state.phase = 'blocked'; });
		await repository.updateSettings({ libraryFolders: ['ok'] });
		unsubscribe();
		const count = phases.length;
		await repository.updateSettings({ libraryFolders: ['again'] });
		expect(phases.length).toBe(count);
		expect(phases).toContain('saving');
		const copy = repository.snapshot();
		copy.settings.libraryFolders.push('not persisted');
		expect(repository.readSettings().libraryFolders).toEqual(['again']);
		expect(repository.status().phase).toBe('ready');
	});
});
