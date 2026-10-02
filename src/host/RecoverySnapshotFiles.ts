import type { DataAdapter } from 'obsidian';
import { createId } from '../utils/ids';
import type { RecoverySnapshotGateway } from '../portability/RecoverySnapshotService';

type RecoveryAdapter = Pick<DataAdapter, 'exists' | 'mkdir' | 'write' | 'read' | 'remove' | 'list' | 'stat'>;
/** Vault adapter stays at the host boundary; the recovery service receives only a scoped file port. */
export class RecoverySnapshotFiles implements RecoverySnapshotGateway {
	constructor(private readonly adapter: RecoveryAdapter, readonly root: string) {
		if (!root || root.startsWith('/') || root.includes(':') || root.includes('\\') || root.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('恢复目录路径无效');
	}
	async preserve(value: unknown, reason: string): Promise<void> {
		if (value === null || value === undefined) return;
		if (!/^[a-z-]+$/.test(reason)) throw new Error('恢复快照类型无效');
		if (!await this.adapter.exists(this.root)) await this.adapter.mkdir(this.root);
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const path = `${this.root}/${stamp}-${createId('snapshot')}-${reason}.json`;
		if (await this.adapter.exists(path)) throw new Error('恢复快照文件已存在，已阻止覆盖');
		await this.adapter.write(path, `${JSON.stringify(value, null, '\t')}\n`);
	}
	async list(): Promise<Array<{ path: string; size: number; mtime: number; directory?: boolean }>> {
		if (!await this.adapter.exists(this.root)) return [];
		const entries = await this.adapter.list(this.root);
		const rows = await Promise.all([...entries.files, ...entries.folders].map(async path => {
			this.assertDirectChild(path);
			const stat = await this.adapter.stat(path);
			return stat ? { path, size: stat.size, mtime: stat.mtime, directory: stat.type === 'folder' } : null;
		}));
		return rows.filter((row): row is NonNullable<typeof row> => row !== null);
	}
	read(path: string): Promise<string> { this.assertDirectChild(path); return this.adapter.read(path); }
	async remove(path: string): Promise<void> {
		this.assertDirectChild(path);
		const stat = await this.adapter.stat(path);
		if (!stat || stat.type !== 'file') throw new Error('只能清理当前恢复目录中的快照文件');
		await this.adapter.remove(path);
	}
	private assertDirectChild(path: string): void {
		const prefix = `${this.root}/`;
		const child = path.startsWith(prefix) ? path.slice(prefix.length) : '';
		if (!child || child === '.' || child === '..' || /[\\/:]/.test(child) || [...child].some(character => character.charCodeAt(0) < 32)) throw new Error('恢复文件越出允许目录');
	}
}
