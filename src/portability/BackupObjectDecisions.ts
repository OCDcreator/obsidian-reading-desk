import { dataSignature } from '../data/DataValidation';
import { removeBackupCredentials } from './BackupCredentials';
import type { BackupConflict, BackupObjectDiff, BackupRestoreOptions } from './BackupTypes';
import { BackupError } from './BackupTypes';

type Records = Record<string, unknown>;
export function decideBackupObjects(collection: string, current: Records, incoming: Records, options: BackupRestoreOptions,
	objects: BackupObjectDiff[], conflicts: BackupConflict[], family = false): Records {
	const result: Records = {};
	for (const id of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
		const key = `${collection}:${id}`;
		const old = current[id]; const backup = incoming[id];
		const same = dataSignature(old) === dataSignature(backup);
		const crossState = family && hasCrossState(old, backup);
		const explicit = options.objectDecisions?.[key];
		if (explicit !== undefined && !['keep-current', 'use-backup'].includes(explicit)) throw new BackupError('invalid-preview', `无效的逐项决策：${key}`);
		const resolution = explicit ?? (crossState ? 'error' : old !== undefined && backup !== undefined && !same ? options.conflictPolicy ?? 'error'
			: backup === undefined && options.mode === 'merge' ? 'keep-current' : 'use-backup');
		if (old !== undefined && backup !== undefined && !same) conflicts.push({ collection, id, resolution });
		const chosen = resolution === 'keep-current' ? old : backup;
		if (chosen !== undefined) result[id] = structuredClone(chosen);
		if (!same) objects.push({ key, collection, id, label: label(collection, id, backup ?? old),
			status: old === undefined ? 'added' : backup === undefined ? 'removed' : 'changed', resolution,
			fields: changedFields(old, backup), currentSummary: summary(old), backupSummary: summary(backup) });
	}
	return result;
}
function hasCrossState(a: unknown, b: unknown): boolean {
	const left = a as Records | undefined; const right = b as Records | undefined;
	return !!left && !!right && (!!(left.highlights || left.pendingTargetWrites) && !!right.deletedAnnotations || !!(right.highlights || right.pendingTargetWrites) && !!left.deletedAnnotations);
}
function changedFields(a: unknown, b: unknown): string[] {
	if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return ['内容'];
	const left = a as Records; const right = b as Records;
	return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(key => dataSignature(left[key]) !== dataSignature(right[key]));
}
function label(collection: string, id: string, value: unknown): string {
	const record = value as Records | undefined;
	const active = record?.highlights as Records | undefined;
	const deleted = record?.deletedAnnotations as { highlight?: Records } | undefined;
	const title = collection === 'annotations' ? active?.text ?? deleted?.highlight?.text : record?.title ?? record?.name;
	return typeof title === 'string' && title ? title.slice(0, 100) : id;
}
function summary(value: unknown): string {
	if (value === undefined) return '不存在';
	const safe = structuredClone(value); removeBackupCredentials(safe);
	const text = JSON.stringify(safe, null, 2);
	return text.length > 2400 ? text.slice(0, 2400) + '\n…（仅截短显示，恢复使用完整数据）' : text;
}
