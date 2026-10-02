import { dataSignature } from '../data/DataValidation';
import type { ReadingDeskData } from '../types/contracts';
import type { BackupCollectionChange, BackupConflict, BackupRestoreOptions } from './BackupTypes';

type Records = Record<string, unknown>;
export interface BackupMergeResult {
	data: ReadingDeskData;
	conflicts: BackupConflict[];
	duplicates: { collection: string; id: string }[];
	changes: BackupCollectionChange[];
}

export function mergeBackupData(current: ReadingDeskData, incoming: ReadingDeskData, options: BackupRestoreOptions): BackupMergeResult {
	const data = structuredClone(incoming);
	const conflicts: BackupConflict[] = [];
	const duplicates: BackupMergeResult['duplicates'] = [];
	const changes: BackupCollectionChange[] = [];
	const mode = options.mode ?? 'replace';
	const policy = options.conflictPolicy ?? 'error';
	const merge = (collection: string, old: Records, imported: Records): Records => {
		const merged = mode === 'merge' ? structuredClone(old) : {};
		for (const [id, value] of Object.entries(imported)) {
			if (Object.prototype.hasOwnProperty.call(old, id)) {
				if (dataSignature(old[id]) === dataSignature(value)) duplicates.push({ collection, id });
				else {
					conflicts.push({ collection, id, resolution: policy });
					if (policy === 'keep-current') { merged[id] = structuredClone(old[id]); continue; }
				}
			}
			merged[id] = structuredClone(value);
		}
		const change: BackupCollectionChange = { collection, added: 0, updated: 0, removed: 0, unchanged: 0 };
		for (const [id, value] of Object.entries(merged)) {
			if (!Object.prototype.hasOwnProperty.call(old, id)) change.added += 1;
			else if (dataSignature(old[id]) !== dataSignature(value)) change.updated += 1;
			else change.unchanged += 1;
		}
		change.removed = Object.keys(old).filter(id => !Object.prototype.hasOwnProperty.call(merged, id)).length;
		changes.push(change);
		return merged;
	};
	const left = current as unknown as Records;
	const right = incoming as unknown as Records;
	const result = data as unknown as Records;
	for (const collection of ['books', 'highlights', 'comments', 'excerptCards', 'deletedAnnotations', 'pendingTargetWrites']) {
		result[collection] = merge(collection, left[collection] as Records ?? {}, right[collection] as Records ?? {});
	}
	const indexed = (values: { id: string }[]): Records => Object.fromEntries(values.map(value => [value.id, value]));
	data.categories = Object.values(merge('categories', indexed(current.categories), indexed(incoming.categories))) as ReadingDeskData['categories'];
	data.lists = Object.values(merge('lists', indexed(current.lists ?? []), indexed(incoming.lists ?? []))) as ReadingDeskData['lists'];
	// Settings are also explicit conflict units, rather than an invisible restore side effect.
	data.settings = merge('settings', current.settings as unknown as Records, incoming.settings as unknown as Records) as unknown as ReadingDeskData['settings'];
	return { data, conflicts, duplicates, changes };
}
