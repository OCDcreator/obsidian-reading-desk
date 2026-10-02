import { describe, expect, it } from 'vitest';
import { RecoverySnapshotFiles } from '../../src/host/RecoverySnapshotFiles';
import { RecoverySnapshotService } from '../../src/portability/RecoverySnapshotService';
import { createEmptyData } from '../../src/data/defaults';

function fixture() {
	const root = '.obsidian/plugins/obsidian-reading-desk/recovery';
	const files = new Map<string, string>(); const folders = new Set<string>();
	const adapter = {
		exists: async (path: string) => files.has(path) || folders.has(path),
		mkdir: async (path: string) => { folders.add(path); },
		write: async (path: string, text: string) => { files.set(path, text); },
		read: async (path: string) => { const text = files.get(path); if (text === undefined) throw new Error('Missing'); return text; },
		remove: async (path: string) => { files.delete(path); },
		list: async () => ({ files: [...files.keys()], folders: [...folders].filter(path => path !== root) }),
		stat: async (path: string) => files.has(path) ? { type: 'file' as const, mtime: 1, ctime: 1, size: new TextEncoder().encode(files.get(path)).length } : folders.has(path) ? { type: 'folder' as const, mtime: 1, ctime: 1, size: 0 } : null
	};
	return { root, files, folders, adapter, gateway: new RecoverySnapshotFiles(adapter, root) };
}

describe('host recovery file boundary', () => {
	it('preserves exact private data and creates distinct names recognised by recovery inventory', async () => {
		const state = fixture(); const data = createEmptyData();
		data.settings.storage.secretAccessKey = 'private-test-value';
		await state.gateway.preserve(data, 'commit'); await state.gateway.preserve(data, 'commit');
		expect(state.files.size).toBe(2);
		for (const text of state.files.values()) expect(JSON.parse(text)).toEqual(data);
		const inventory = await new RecoverySnapshotService(state.gateway).inventory();
		expect(inventory.entries).toHaveLength(2);
	});

	it('rejects path escape and directory removal without touching the adapter', async () => {
		const state = fixture(); const protectedPath = state.root + '/pre-release';
		state.folders.add(protectedPath);
		await expect(state.gateway.remove(protectedPath)).rejects.toThrow();
		await expect(state.gateway.remove(state.root + '/../../data.json')).rejects.toThrow();
		await expect(state.gateway.remove('.obsidian/other.json')).rejects.toThrow();
		expect(() => state.gateway.read(state.root + '/sub/file.json')).toThrow();
		expect(state.folders.has(protectedPath)).toBe(true);
	});

	it('propagates failed protection writes so repository overwrite remains blocked', async () => {
		const state = fixture();
		state.adapter.write = async () => { throw new Error('Disk full'); };
		await expect(state.gateway.preserve(createEmptyData(), 'commit')).rejects.toThrow('Disk full');
		expect(state.files.size).toBe(0);
		await expect(state.gateway.preserve({}, '../escape')).rejects.toThrow();
	});
});
