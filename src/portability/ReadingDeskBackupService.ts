import { dataSignature, validateReadingDeskData } from '../data/DataValidation';
import { isPlainObject } from '../data/DataValidationSupport';
import type { ReadingDeskData } from '../types/contracts';
import { containsBackupCredentials, preserveLocalCredentials, removeBackupCredentials } from './BackupCredentials';
import { checkBackupIntegrity } from './BackupIntegrity';
import { parseBackupJson } from './BackupJson';
import { assertBackupCapacity } from './BackupCapacity';
import { mergeBackupData } from './BackupMerge';
import { checkBackupPaths, mapBackupPaths } from './BackupPaths';
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, BackupError, type BackupExportOptions, type BackupRestoreHost, type BackupRestoreOptions, type BackupRestorePreview, type ReadingDeskBackup } from './BackupTypes';
export * from './BackupTypes';

interface RestorePlan {
	currentSignature: string;
	data: ReadingDeskData;
	canApply: boolean;
	options: BackupRestoreOptions;
	applying: boolean;
}

/** JSON/domain operations only. Vault reading, recovery-file writes and UI live in host composition. */
export class ReadingDeskBackupService {
	private readonly plans = new WeakMap<BackupRestorePreview, RestorePlan>();
	constructor(private readonly now: () => Date = () => new Date()) { }

	exportBackup(value: ReadingDeskData, options: BackupExportOptions = {}): ReadingDeskBackup {
		const data = validateReadingDeskData(value);
		if (!options.includeCredentials) removeBackupCredentials(data);
		return {
			format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, createdAt: this.now().toISOString(),
			credentialsIncluded: options.includeCredentials === true, filesIncluded: false, data
		};
	}

	serializeBackup(value: ReadingDeskData, options: BackupExportOptions = {}): string {
		const text = JSON.stringify(this.exportBackup(value, options), null, 2);
		assertBackupCapacity(text);
		return text;
	}

	parseBackup(input: unknown): ReadingDeskBackup {
		const value = typeof input === 'string' ? parseBackupJson(input) : input;
		if (!isPlainObject(value) || value.format !== BACKUP_FORMAT || value.schemaVersion !== BACKUP_SCHEMA_VERSION
			|| typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
			|| typeof value.credentialsIncluded !== 'boolean' || value.filesIncluded !== false) {
			throw new BackupError('invalid-backup', '不是受支持的 Reading Desk 完整备份（schemaVersion 1）');
		}
		try {
			const data = validateReadingDeskData(value.data, { requireComplete: true });
			// Check the raw payload: migrated defaults legitimately contain empty credential fields.
			if (!value.credentialsIncluded && containsBackupCredentials(value.data)) {
				throw new BackupError('invalid-backup', '备份声明已排除凭据，但内容仍含凭据字段');
			}
			return { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, createdAt: value.createdAt,
				credentialsIncluded: value.credentialsIncluded, filesIncluded: false, data };
		} catch (error) {
			if (error instanceof BackupError) throw error;
			throw new BackupError('invalid-backup', error instanceof Error ? error.message : '备份数据形状无效');
		}
	}

	previewRestore(input: unknown, currentValue: ReadingDeskData, options: BackupRestoreOptions = {}): BackupRestorePreview {
		if (options.mode && !['replace', 'merge'].includes(options.mode)) throw new BackupError('invalid-preview', '不支持的恢复模式');
		if (options.conflictPolicy && !['error', 'keep-current', 'use-backup'].includes(options.conflictPolicy)) throw new BackupError('invalid-preview', '不支持的冲突规则');
		const backup = this.parseBackup(input);
		const current = validateReadingDeskData(currentValue);
		const incoming = backup.data;
		if (!backup.credentialsIncluded) preserveLocalCredentials(current, incoming);
		const issues = checkBackupIntegrity(incoming);
		const pathChanges = mapBackupPaths(incoming, options.pathMappings ?? [], issues);
		const merged = mergeBackupData(current, incoming, options);
		for (const conflict of merged.conflicts) {
			if (conflict.resolution === 'error') issues.push({ code: 'conflict', severity: 'error', path: `${conflict.collection}.${conflict.id}`, message: '备份与当前数据存在差异，请选择冲突处理规则' });
		}
		issues.push(...checkBackupIntegrity(merged.data));
		checkBackupPaths(merged.data, issues, options.existingPaths);
		const uniqueIssues = issues.filter((issue, index) => issues.findIndex(other => dataSignature(other) === dataSignature(issue)) === index);
		const preview: BackupRestorePreview = {
			...merged, canApply: !uniqueIssues.some(issue => issue.severity === 'error'), mode: options.mode ?? 'replace',
			issues: uniqueIssues, pathChanges, filesIncluded: false,
			warnings: ['此备份不包含 PDF/EPUB、封面图片或目标笔记文件内容。Markdown 手写内容、Canvas、Excalidraw 和原书必须另行随 vault 备份。',
				...(backup.credentialsIncluded ? ['此备份包含云存储凭据。'] : ['云存储凭据未包含；恢复保留本机现有凭据。']),
				...uniqueIssues.filter(issue => issue.severity === 'warning').map(issue => issue.message)]
		};
		this.plans.set(preview, { currentSignature: dataSignature(current), data: structuredClone(merged.data), canApply: preview.canApply,
			options: structuredClone(options), applying: false });
		return preview;
	}

	async restore(preview: BackupRestorePreview, host: BackupRestoreHost): Promise<ReadingDeskData> {
		const plan = this.plans.get(preview);
		if (!plan || !plan.canApply || plan.applying) throw new BackupError('invalid-preview', '恢复预览无效、存在阻断问题或已使用，请重新生成预览');
		const checkCurrent = (): ReadingDeskData => {
			const state = host.status?.();
			if (state?.pending || state?.phase === 'saving' || state?.phase === 'conflict' || (state?.phase === 'blocked' && !plan.options.recoverInvalid)) {
				throw new BackupError('restore-conflict', '当前仓库存在未保存、冲突或被保护数据，请先处理后重新预览');
			}
			const current = validateReadingDeskData(host.snapshot());
			if (dataSignature(current) !== plan.currentSignature) throw new BackupError('restore-conflict', '预览后当前数据已变化，请重新预览');
			return current;
		};
		plan.applying = true;
		try {
			const current = checkCurrent();
			if (typeof host.backupBeforeRestore !== 'function') throw new BackupError('backup-failed', '恢复必须提供 backupBeforeRestore 回调');
			try { await host.backupBeforeRestore(this.exportBackup(current)); }
			catch (error) { throw new BackupError('backup-failed', `恢复前备份失败：${error instanceof Error ? error.message : String(error)}`); }
			checkCurrent();
			const replacement = validateReadingDeskData(plan.data, { requireComplete: true });
			const errors = checkBackupIntegrity(replacement).filter(issue => issue.severity === 'error');
			checkBackupPaths(replacement, errors);
			if (errors.length) throw new BackupError('invalid-preview', '恢复计划校验失败', errors);
			await host.replaceData(replacement, { recoverInvalid: plan.options.recoverInvalid, expectedSignature: plan.currentSignature });
			this.plans.delete(preview);
			return structuredClone(replacement);
		} finally { plan.applying = false; }
	}
}
