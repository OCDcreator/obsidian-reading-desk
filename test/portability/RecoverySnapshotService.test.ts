import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createEmptyData } from '../../src/data/defaults';
import { ReadingDeskBackupService } from '../../src/portability/ReadingDeskBackupService';
import { RecoverySnapshotService, type RecoverySnapshotFile, type RecoverySnapshotGateway } from '../../src/portability/RecoverySnapshotService';

beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
const root = '.obsidian/plugins/obsidian-reading-desk/recovery';
const auto = (sequence: number) => `${root}/2026-10-02T12-00-00-000Z-${sequence}-commit.json`;
function setup() {
	const data = createEmptyData(); data.settings.storage.secretAccessKey = 'private-local';
	const raw = JSON.stringify(data);
	const files = new Map<string, { text: string; file: RecoverySnapshotFile }>();
	const add = (path: string, mtime: number, text = raw, directory = false) => { files.set(path, { text, file: { path, mtime, size: new TextEncoder().encode(text).length, directory } }); };
	for (let i = 1; i <= 3; i++) add(auto(i), i);
	const remove = vi.fn(async (path: string) => { files.delete(path); });
	const read = vi.fn(async (path: string) => { const value = files.get(path); if (!value) throw new Error('missing'); return value.text; });
	const gateway: RecoverySnapshotGateway = { root, list: async () => [...files.values()].map(value => ({ ...value.file })), read, remove };
	return { files, add, remove, read, raw, service: new RecoverySnapshotService(gateway, () => 10 * 86400000) };
}

describe('owned recovery snapshot inventory and cleanup', () => {
	it('protects manual, pre-restore, pre-release, unknown, malformed and outside paths', async () => {
		const state = setup();
		state.add(`${root}/manual.json`, 4); state.add(`${root}/2026-10-02T12-00-00-000Z-4-before-restore.json`, 5);
		state.add(`${root}/pre-0.4.0`, 6, '', true); state.add(`${root}/unknown.json`, 7, '{}');
		state.add(auto(5), 8, '{bad'); state.add(`${root}/../outside.json`, 9);
		const inventory = await state.service.inventory();
		expect(inventory.count).toBe(8); expect(inventory.automaticCount).toBe(4);
		expect(inventory.entries.find(entry => entry.path === auto(3))?.protectedReason).toContain('最新');
		expect(state.read).not.toHaveBeenCalledWith(`${root}/../outside.json`);
		const preview = await state.service.previewCleanup({ mode: 'count', keep: 1 });
		expect(preview.candidates.map(entry => entry.path)).toEqual([auto(2), auto(1)]);
		const result = await state.service.cleanup(preview);
		expect(result.deleted).toEqual([auto(2), auto(1)]); expect(result.failures).toEqual([]);
		expect(state.files.has(auto(3))).toBe(true); expect(state.files.has(`${root}/manual.json`)).toBe(true);
		await expect(state.service.cleanup(preview)).rejects.toThrow('预览');
	});
	it('supports day retention and the exact current/legacy automatic filename formats', async () => {
		const state = setup();
		state.add(`${root}/2026-10-02T12-00-00-000Z-snapshot-12345678-1234-1234-1234-123456789abc-retry.json`, 4);
		state.add(`${root}/2026-10-02T12-00-00-000Z-snapshot-12345678-abc123-replace.json`, 5);
		state.add(`${root}/arbitrary-commit.json`, 6);
		const preview = await state.service.previewCleanup({ mode: 'days', keep: 1 });
		expect(preview.candidates).toHaveLength(4);
		expect(preview.candidates.every(entry => !entry.path.endsWith('arbitrary-commit.json'))).toBe(true);
	});
	it.each(['added', 'candidate-content', 'protected-content'] as const)('refuses stale %s even when content size and mtime are unchanged', async change => {
		const state = setup(); const preview = await state.service.previewCleanup({ mode: 'count', keep: 1 });
		if (change === 'added') state.add(auto(4), 4);
		else { const file = state.files.get(auto(change === 'candidate-content' ? 1 : 3)); if (!file) throw new Error('fixture'); file.text = 'x'.repeat(file.text.length); }
		await expect(state.service.cleanup(preview)).rejects.toThrow('变化');
		expect(state.remove).not.toHaveBeenCalled();
	});
	it('reports partial deletion failures without deleting protected snapshots or replaying the old plan', async () => {
		const state = setup(); state.remove.mockImplementation(async path => { if (path === auto(2)) throw new Error('permission denied'); state.files.delete(path); });
		const preview = await state.service.previewCleanup({ mode: 'count', keep: 1 });
		preview.candidates.push({ ...preview.candidates[0], path: auto(3) });
		const result = await state.service.cleanup(preview);
		expect(result.deleted).toEqual([auto(1)]); expect(result.failures).toEqual([{ path: auto(2), message: 'permission denied' }]);
		expect(state.files.has(auto(3))).toBe(true);
		await expect(state.service.cleanup(preview)).rejects.toThrow('预览');
	});
	it('loads a selected raw snapshot into the existing backup protocol and rejects changed selection', async () => {
		const state = setup(); const inventory = await state.service.inventory(); const entry = inventory.entries[0];
		const text = await state.service.backupText(entry);
		const backup = new ReadingDeskBackupService().parseBackup(text);
		expect(backup.credentialsIncluded).toBe(true); expect(backup.data.settings.storage.secretAccessKey).toBe('private-local');
		expect(state.remove).not.toHaveBeenCalled();
		const file = state.files.get(entry.path); if (!file) throw new Error('fixture'); file.text = state.raw.replace('private-local', 'changed-local');
		await expect(state.service.backupText(entry)).rejects.toThrow('变化');
		await expect(state.service.backupText({ ...entry })).rejects.toThrow('失效');
	});
	it('does not offer oversized raw snapshots for UI restore or cleanup', async () => {
		const state = setup(); const file = state.files.get(auto(3)); if (!file) throw new Error('fixture'); file.file.size = 65 * 1024 * 1024;
		const inventory = await state.service.inventory(); const entry = inventory.entries.find(item => item.path === auto(3));
		expect(entry?.canRestore).toBe(false); expect(entry?.protectedReason).toContain('容量');
		expect((await state.service.previewCleanup({ mode: 'count', keep: 1 })).candidates.map(item => item.path)).toEqual([auto(1)]);
	});
});
