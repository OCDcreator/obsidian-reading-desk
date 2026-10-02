import { describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '../../src/data/defaults';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import { ReadingDeskBackupService, type BackupRestoreHost, type ReadingDeskBackup } from '../../src/portability/ReadingDeskBackupService';
import type { ReadingDeskData } from '../../src/types/contracts';
import { completeData, highlight } from '../data/DataRecoveryFixtures';

function memoryHost(initial: ReadingDeskData = createEmptyData()) {
	let data = structuredClone(initial);
	const backups: ReadingDeskBackup[] = [];
	const replaceData = vi.fn(async (next: ReadingDeskData) => { data = structuredClone(next); });
	const backupBeforeRestore = vi.fn(async (backup: ReadingDeskBackup) => { backups.push(backup); });
	const host: BackupRestoreHost = { snapshot: () => structuredClone(data), replaceData, backupBeforeRestore };
	return { host, replaceData, backupBeforeRestore, backups, get: () => data, set: (next: ReadingDeskData) => { data = structuredClone(next); } };
}

const service = () => new ReadingDeskBackupService(() => new Date('2026-10-02T12:00:00Z'));

describe('Reading Desk complete backup', () => {
	it('round-trips books, comments, cards, tombstones, intents, lists and first-page rectangles', () => {
		const backups = service();
		const original = completeData();
		const exported = backups.exportBackup(original);
		const json = backups.serializeBackup(original);
		expect(json).not.toContain('private-access');
		expect(json).not.toContain('private-secret');
		expect(json).not.toContain('accessKeyId');
		expect(json).not.toContain('secretAccessKey');
		expect(exported.filesIncluded).toBe(false);
		const parsed = backups.parseBackup(json);
		const expected = structuredClone(original);
		expected.settings.storage.accessKeyId = '';
		expected.settings.storage.secretAccessKey = '';
		expect(parsed.data).toEqual(expected);
		expect(parsed.data.highlights.h.page).toBe(0);
		expect(parsed.data.highlights.h.rects[0]).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.1 });
		expect(parsed.data.deletedAnnotations?.deleted.highlight.page).toBe(0);
		expect(parsed.data.pendingTargetWrites?.intent.page).toBe(0);
		expect(original.settings.storage.secretAccessKey).toBe('private-secret');
		expect(backups.previewRestore(parsed, createEmptyData(), { conflictPolicy: 'use-backup' }).canApply).toBe(true);
	});

	it('excludes nested future credential fields unless explicitly opted in', () => {
		const backups = service();
		const original = { ...completeData(), extra: { accessKeyId: 'extra-private', secret: 'extra-secret', nested: { secretAccessKey: 'nested-private' } } };
		const json = backups.serializeBackup(original);
		expect(json).not.toContain('extra-private');
		expect(json).not.toContain('extra-secret');
		expect(json).not.toContain('nested-private');
		const explicit = backups.exportBackup(original, { includeCredentials: true });
		expect(explicit.credentialsIncluded).toBe(true);
		expect(backups.parseBackup(explicit).data.settings.storage.secretAccessKey).toBe('private-secret');
	});

	it('rejects corrupted JSON, future schemas, truncated collections and incorrectly declared credentials', () => {
		const backups = service();
		expect(() => backups.parseBackup('{')).toThrow('JSON');
		const exported = backups.exportBackup(completeData());
		expect(() => backups.parseBackup({ ...exported, schemaVersion: 99 })).toThrow('schemaVersion');
		expect(() => backups.parseBackup({ ...exported, data: { ...exported.data, highlights: [] } })).toThrow('highlights');
		expect(() => backups.parseBackup({ ...exported, data: { ...exported.data, settings: {} } })).toThrow('必要配置');
		expect(() => backups.parseBackup({ ...exported, data: { ...exported.data, schemaVersion: undefined } })).toThrow('schemaVersion');
		const incomplete = { ...exported.data };
		delete incomplete.deletedAnnotations;
		expect(() => backups.parseBackup({ ...exported, data: incomplete })).toThrow('deletedAnnotations');
		expect(() => backups.parseBackup({ ...backups.exportBackup(completeData(), { includeCredentials: true }), credentialsIncluded: false })).toThrow('凭据');
	});

	it('rejects duplicate JSON record keys instead of silently discarding a stable ID', () => {
		const backups = service();
		const json = backups.serializeBackup(completeData());
		const duplicate = json.replace('"highlights": {', '"highlights": {"h":' + JSON.stringify(highlight()) + ',');
		expect(() => backups.parseBackup(duplicate)).toThrow('重复 JSON 字段：backup.data.highlights.h');
	});

	it('previews prefix/path mappings in every reference without mutating source data', () => {
		const backups = service();
		const original = completeData();
		const preview = backups.previewRestore(backups.exportBackup(original), createEmptyData(), {
			conflictPolicy: 'use-backup', pathMappings: [{ from: 'Books', to: 'Library' }, { from: 'Notes', to: 'Excerpts' }, { from: 'Covers', to: 'Images' }],
			existingPaths: ['Library/first.pdf', 'Excerpts/first.md', 'Images/first.png']
		});
		expect(preview.canApply).toBe(true);
		expect(preview.data.books.b.path).toBe('Library/first.pdf');
		expect(preview.data.books.b.coverPath).toBe('Images/first.png');
		expect(preview.data.highlights.h.pdfPath).toBe('Library/first.pdf');
		expect(preview.data.highlights.h.target?.path).toBe('Excerpts/first.md');
		expect(preview.data.deletedAnnotations?.deleted.highlight.target?.path).toBe('Excerpts/first.md');
		expect(preview.data.pendingTargetWrites?.intent.pdfPath).toBe('Library/first.pdf');
		expect(preview.data.settings.libraryFolders).toEqual(['Library']);
		expect(preview.pathChanges).toContainEqual({ field: 'books.b.path', from: 'Books/first.pdf', to: 'Library/first.pdf' });
		expect(preview.issues.filter(issue => issue.code === 'missing-file')).toEqual([]);
		expect(original.books.b.path).toBe('Books/first.pdf');
	});

	it('blocks traversal mappings and collisions after mapping', () => {
		const backups = service();
		const original = completeData();
		original.books.other = { ...original.books.b, id: 'other', path: 'Other/first.pdf' };
		const preview = backups.previewRestore(backups.exportBackup(original), createEmptyData(), {
			conflictPolicy: 'use-backup', pathMappings: [{ from: 'Other', to: 'Books' }]
		});
		expect(preview.canApply).toBe(false);
		expect(preview.issues.some(issue => issue.code === 'duplicate-path')).toBe(true);
		const traversal = backups.previewRestore(backups.exportBackup(completeData()), createEmptyData(), { conflictPolicy: 'use-backup', pathMappings: [{ from: 'Books', to: '../outside' }] });
		expect(traversal.canApply).toBe(false);
		expect(traversal.issues.some(issue => issue.code === 'path')).toBe(true);
	});

	it('reports absent source, cover and target files as warnings while keeping their references', () => {
		const backups = service();
		const preview = backups.previewRestore(backups.exportBackup(completeData()), createEmptyData(), { conflictPolicy: 'use-backup', existingPaths: [] });
		expect(preview.canApply).toBe(true);
		expect(preview.issues.filter(issue => issue.code === 'missing-file')).toHaveLength(3);
		expect(preview.warnings.join(' ')).toContain('另行随 vault 备份');
	});

	it('blocks broken comment/category/list references, duplicate IDs and active/deleted overlap', () => {
		const backups = service();
		const original = completeData();
		original.books.b.categoryId = 'absent';
		original.books.b.listIds = ['absent'];
		original.categories.push({ id: 'c', name: 'Duplicate', order: 1 });
		original.comments.h[0].highlightId = 'absent';
		original.comments.orphan = [{ ...original.comments.h[0] }];
		original.excerptCards.orphan = { folded: true };
		original.highlights.deleted = highlight('deleted');
		const preview = backups.previewRestore(backups.exportBackup(original), createEmptyData(), { conflictPolicy: 'use-backup' });
		expect(preview.canApply).toBe(false);
		expect(preview.issues.some(issue => issue.code === 'duplicate-id')).toBe(true);
		expect(preview.issues.some(issue => issue.code === 'reference')).toBe(true);
		expect(preview.issues.some(issue => issue.code === 'conflict')).toBe(true);
	});

	it('requires an explicit conflict rule and provides duplicate/change counts', () => {
		const backups = service();
		const current = completeData();
		const incoming = completeData();
		incoming.books.b.title = 'From backup';
		const blocked = backups.previewRestore(backups.exportBackup(incoming), current);
		expect(blocked.canApply).toBe(false);
		expect(blocked.conflicts).toContainEqual({ collection: 'books', id: 'b', resolution: 'error' });
		const keep = backups.previewRestore(backups.exportBackup(incoming), current, { conflictPolicy: 'keep-current' });
		expect(keep.canApply).toBe(true);
		expect(keep.data.books.b.title).toBe('Manual title');
		const use = backups.previewRestore(backups.exportBackup(incoming), current, { conflictPolicy: 'use-backup' });
		expect(use.data.books.b.title).toBe('From backup');
		expect(use.changes.find(change => change.collection === 'books')?.updated).toBe(1);
		expect(use.duplicates).toContainEqual({ collection: 'highlights', id: 'h' });
	});

	it('merges distinct stable IDs and treats identical IDs as a no-op', () => {
		const backups = service();
		const current = completeData();
		const incoming = completeData();
		incoming.highlights.other = highlight('other');
		const preview = backups.previewRestore(backups.exportBackup(incoming), current, { mode: 'merge' });
		expect(preview.canApply).toBe(true);
		expect(Object.keys(preview.data.highlights)).toEqual(['h', 'other']);
		expect(preview.changes.find(change => change.collection === 'highlights')).toMatchObject({ added: 1, unchanged: 1 });
	});
});

describe('Reading Desk backup restore application', () => {
	it('durably backs up current data before replacement and preserves local credentials', async () => {
		const backups = service();
		const current = completeData();
		current.settings.storage.secretAccessKey = 'local-secret';
		const incoming = completeData();
		incoming.books.b.title = 'Restored';
		const memory = memoryHost(current);
		const order: string[] = [];
		memory.host.backupBeforeRestore = async backup => { order.push('backup'); expect(JSON.stringify(backup)).not.toContain('local-secret'); };
		memory.host.replaceData = async data => { order.push('replace'); memory.set(data); };
		const preview = backups.previewRestore(backups.exportBackup(incoming), current, { conflictPolicy: 'use-backup' });
		await backups.restore(preview, memory.host);
		expect(order).toEqual(['backup', 'replace']);
		expect(memory.get().books.b.title).toBe('Restored');
		expect(memory.get().settings.storage.secretAccessKey).toBe('local-secret');
		await expect(backups.restore(preview, memory.host)).rejects.toThrow('预览无效');
	});

	it('aborts replacement if the backup fails or the current snapshot becomes stale', async () => {
		const backups = service();
		const memory = memoryHost();
		const preview = backups.previewRestore(backups.exportBackup(completeData()), memory.get(), { conflictPolicy: 'use-backup' });
		memory.backupBeforeRestore.mockRejectedValueOnce(new Error('no space'));
		await expect(backups.restore(preview, memory.host)).rejects.toThrow('no space');
		expect(memory.replaceData).not.toHaveBeenCalled();
		const changed = createEmptyData();
		changed.settings.libraryFolders = ['new'];
		memory.set(changed);
		await expect(backups.restore(preview, memory.host)).rejects.toThrow('已变化');
		expect(memory.replaceData).not.toHaveBeenCalled();
	});

	it('checks current data again after the host backup awaited I/O', async () => {
		const backups = service();
		const memory = memoryHost();
		const preview = backups.previewRestore(backups.exportBackup(completeData()), memory.get(), { conflictPolicy: 'use-backup' });
		memory.host.backupBeforeRestore = async () => { const changed = createEmptyData(); changed.settings.libraryFolders = ['during-backup']; memory.set(changed); };
		await expect(backups.restore(preview, memory.host)).rejects.toThrow('已变化');
		expect(memory.replaceData).not.toHaveBeenCalled();
	});

	it('uses the internal validated plan even if a UI mutates its visible data', async () => {
		const backups = service();
		const memory = memoryHost();
		const preview = backups.previewRestore(backups.exportBackup(completeData()), memory.get(), { conflictPolicy: 'use-backup' });
		preview.data.books.b.title = 'Tampered';
		await backups.restore(preview, memory.host);
		expect(memory.get().books.b.title).toBe('Manual title');
	});

	it('refuses pending repositories and permits explicit invalid-data recovery only through original backup', async () => {
		const backups = service();
		const current = createEmptyData();
		const memory = memoryHost(current);
		memory.host.status = () => ({ phase: 'pending', pending: true });
		const preview = backups.previewRestore(backups.exportBackup(completeData()), current, { conflictPolicy: 'use-backup' });
		await expect(backups.restore(preview, memory.host)).rejects.toThrow('未保存');
		expect(memory.backupBeforeRestore).not.toHaveBeenCalled();

		let disk: unknown = { books: 'damaged' };
		const originalBackups: unknown[] = [];
		const repository = new ReadingDeskRepository({ load: async () => disk, save: async value => { disk = structuredClone(value); } }, { beforeOverwrite: async original => { originalBackups.push(original); } });
		await repository.initialize();
		const recover = backups.previewRestore(backups.exportBackup(completeData()), repository.snapshot(), { conflictPolicy: 'use-backup', recoverInvalid: true });
		await backups.restore(recover, { snapshot: () => repository.snapshot(), status: () => repository.status(), replaceData: (data, options) => repository.replaceData(data, options), backupBeforeRestore: async () => undefined });
		expect(originalBackups).toEqual([{ books: 'damaged' }]);
		expect(repository.readHighlights().h.page).toBe(0);
		expect(repository.status().phase).toBe('ready');
	});
});
