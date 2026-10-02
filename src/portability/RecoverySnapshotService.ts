import { validateReadingDeskData } from '../data/DataValidation';
import { ReadingDeskBackupService } from './ReadingDeskBackupService';
import { assertBackupCapacity, MAX_BACKUP_BYTES } from './BackupCapacity';
import { parseBackupJson } from './BackupJson';
import { checkBackupIntegrity } from './BackupIntegrity';
import { checkBackupPaths } from './BackupPaths';

export interface RecoverySnapshotFile { path: string; size: number; mtime: number; directory?: boolean; }
/** Host lists only the plugin recovery directory; no Obsidian/filesystem dependency here. */
export interface RecoverySnapshotGateway {
	root: string;
	list(): Promise<RecoverySnapshotFile[]>;
	read(path: string): Promise<string>;
	remove(path: string): Promise<void>;
}
export interface RecoverySnapshotEntry {
	path: string; name: string; bytes: number; modifiedAt: number;
	automatic: boolean; valid: boolean; canRestore: boolean; protectedReason?: string;
}
export interface RecoverySnapshotInventory { entries: RecoverySnapshotEntry[]; count: number; bytes: number; automaticCount: number; }
export interface RecoveryRetentionPolicy { mode: 'count' | 'days'; keep: number; }
export interface RecoveryCleanupPreview { candidates: RecoverySnapshotEntry[]; bytes: number; protectedCount: number; policy: RecoveryRetentionPolicy; }
export interface RecoveryCleanupResult { deleted: string[]; failures: { path: string; message: string }[]; }
interface Identity { file: RecoverySnapshotFile; digest?: string; }
interface CleanupPlan { identities: Map<string, Identity>; candidates: string[]; protectedAnchor?: string; applying: boolean; }
const AUTOMATIC_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(?:\d+|snapshot-(?:[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}|\d+-[a-z\d]+))-(commit|retry|replace)\.json$/;

/** Index and explicit cleanup of owned snapshots; it never changes current plugin data. */
export class RecoverySnapshotService {
	private readonly entries = new WeakMap<RecoverySnapshotEntry, Identity>();
	private readonly plans = new WeakMap<RecoveryCleanupPreview, CleanupPlan>();
	private readonly backups = new ReadingDeskBackupService();
	constructor(private readonly gateway: RecoverySnapshotGateway, private readonly now: () => number = Date.now) { }

	async inventory(): Promise<RecoverySnapshotInventory> {
		const entries: RecoverySnapshotEntry[] = [];
		for (const file of await this.gateway.list()) {
			const name = this.ownedName(file.path);
			const entry: RecoverySnapshotEntry = { path: file.path, name: name ?? file.path, bytes: file.size, modifiedAt: file.mtime,
				automatic: !!name && AUTOMATIC_NAME.test(name) && !file.directory, valid: false, canRestore: false };
			const identity: Identity = { file: { ...file } };
			if (!name) entry.protectedReason = '路径不属于恢复目录，已保护';
			else if (file.directory) entry.protectedReason = '归档目录，已保护';
			else if (!name.endsWith('.json')) entry.protectedReason = '未知文件，已保护';
			else if (file.size > MAX_BACKUP_BYTES) entry.protectedReason = '超过当前可预览容量，保留原件';
			else {
				try {
					const text = await this.gateway.read(file.path);
					identity.digest = await digest(text);
					this.backupString(text);
					entry.valid = true; entry.canRestore = true;
					if (!entry.automatic) entry.protectedReason = '手工、恢复前或未知来源快照，已保护';
				} catch { entry.protectedReason = '内容损坏或不受支持，已保护'; }
			}
			this.entries.set(entry, identity); entries.push(entry);
		}
		entries.sort((a, b) => b.modifiedAt - a.modifiedAt || a.path.localeCompare(b.path));
		const newest = entries.find(entry => entry.automatic && entry.valid);
		if (newest) newest.protectedReason = '最新可用自动快照，始终保留';
		return { entries, count: entries.filter(entry => !this.entries.get(entry)?.file.directory).length,
			bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), automaticCount: entries.filter(entry => entry.automatic).length };
	}

	async previewCleanup(policy: RecoveryRetentionPolicy): Promise<RecoveryCleanupPreview> {
		if (!['count', 'days'].includes(policy.mode) || !Number.isInteger(policy.keep) || policy.keep < 1 || policy.keep > 10000) throw new Error('保留数量或天数必须为 1–10000 的整数。');
		const inventory = await this.inventory();
		const eligible = inventory.entries.filter(entry => entry.automatic && entry.valid);
		const cutoff = this.now() - policy.keep * 86400000;
		const candidates = eligible.filter((entry, index) => !entry.protectedReason && (policy.mode === 'count' ? index >= policy.keep : entry.modifiedAt < cutoff));
		const identities = new Map<string, Identity>();
		for (const entry of inventory.entries) {
			const identity = this.entries.get(entry);
			if (identity) identities.set(entry.path, identity);
		}
		const preview = { candidates, bytes: candidates.reduce((sum, entry) => sum + entry.bytes, 0), protectedCount: inventory.entries.length - candidates.length, policy: { ...policy } };
		this.plans.set(preview, { identities, candidates: candidates.map(entry => entry.path), protectedAnchor: eligible[0]?.path, applying: false });
		return preview;
	}

	async cleanup(preview: RecoveryCleanupPreview): Promise<RecoveryCleanupResult> {
		const plan = this.plans.get(preview);
		if (!plan || plan.applying) throw new Error('清理预览无效或已使用，请重新预览。');
		plan.applying = true;
		try {
			await this.verifyInventory(plan.identities);
			if (plan.protectedAnchor) await this.verifyContent(plan.protectedAnchor, plan.identities.get(plan.protectedAnchor));
			// Check every candidate before deleting any; a stale plan cannot partly execute.
			for (const path of plan.candidates) await this.verifyContent(path, plan.identities.get(path));
			const result: RecoveryCleanupResult = { deleted: [], failures: [] };
			const remaining = new Map(plan.identities);
			for (const path of plan.candidates) {
				try {
					await this.verifyInventory(remaining);
					if (plan.protectedAnchor) await this.verifyContent(plan.protectedAnchor, plan.identities.get(plan.protectedAnchor));
					await this.verifyContent(path, plan.identities.get(path));
					await this.gateway.remove(path); result.deleted.push(path); remaining.delete(path);
				} catch (error) { result.failures.push({ path, message: error instanceof Error ? error.message : '清理失败' }); }
			}
			this.plans.delete(preview); return result;
		} finally { plan.applying = false; }
	}

	async backupText(entry: RecoverySnapshotEntry): Promise<string> {
		const identity = this.entries.get(entry);
		if (!identity || !entry.canRestore) throw new Error('恢复索引已失效或该原件不能恢复，请刷新清单。');
		const text = await this.verifyContent(identity.file.path, identity);
		return this.backupString(text);
	}

	private backupString(text: string): string {
		const backup = this.asBackup(text);
		const issues = checkBackupIntegrity(backup.data); checkBackupPaths(backup.data, issues);
		if (issues.some(issue => issue.severity === 'error')) throw new Error('快照包含无效引用，保留原件');
		const textBackup = JSON.stringify(backup);
		assertBackupCapacity(textBackup); return textBackup;
	}
	private asBackup(text: string) {
		const value = parseBackupJson(text);
		if (value && typeof value === 'object' && 'format' in value) return this.backups.parseBackup(text);
		if (!value || typeof value !== 'object' || !('books' in value) || !('highlights' in value) || !('settings' in value)) throw new Error('不是 Reading Desk 数据快照');
		return this.backups.exportBackup(validateReadingDeskData(value), { includeCredentials: true });
	}
	private ownedName(path: string): string | undefined {
		const root = this.gateway.root.replace(/\/$/, '');
		if (!root || root.startsWith('/') || root.split('/').some(part => !part || part === '.' || part === '..') || !path.startsWith(root + '/') || path.includes('\\') || [...path].some(character => character.charCodeAt(0) < 32)) return undefined;
		const name = path.slice(root.length + 1);
		return name && !name.includes('/') && name !== '.' && name !== '..' ? name : undefined;
	}
	private async verifyInventory(expected: Map<string, Identity>): Promise<void> {
		const actual = await this.gateway.list();
		if (actual.length !== expected.size || actual.some(file => !sameFile(file, expected.get(file.path)?.file))) throw new Error('恢复目录在预览后已变化，请重新预览清理。');
	}
	private async verifyContent(path: string, identity: Identity | undefined): Promise<string> {
		if (!identity?.digest || !this.ownedName(path)) throw new Error('快照身份无效，已保护原件。');
		const file = (await this.gateway.list()).find(item => item.path === path);
		if (!sameFile(file, identity.file)) throw new Error('快照在预览后已变化，请刷新清单。');
		const text = await this.gateway.read(path);
		if (await digest(text) !== identity.digest) throw new Error('快照内容在预览后已变化，已保护原件。');
		return text;
	}
}
function sameFile(a?: RecoverySnapshotFile, b?: RecoverySnapshotFile): boolean {
	return !!a && !!b && a.path === b.path && a.size === b.size && a.mtime === b.mtime && !!a.directory === !!b.directory;
}
async function digest(text: string): Promise<string> {
	const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}
