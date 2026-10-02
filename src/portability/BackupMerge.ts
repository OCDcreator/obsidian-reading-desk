import { dataSignature } from '../data/DataValidation';
import type { ReadingDeskData } from '../types/contracts';
import { decideBackupObjects } from './BackupObjectDecisions';
import { BackupError } from './BackupTypes';
import type { BackupCollectionChange, BackupConflict, BackupObjectDiff, BackupRestoreOptions } from './BackupTypes';

type Records = Record<string, unknown>;
export interface BackupMergeResult {
	data: ReadingDeskData;
	conflicts: BackupConflict[];
	duplicates: { collection: string; id: string }[];
	changes: BackupCollectionChange[];
	objects: BackupObjectDiff[];
}

export function mergeBackupData(current: ReadingDeskData, incoming: ReadingDeskData, options: BackupRestoreOptions): BackupMergeResult {
	const data = structuredClone(incoming);
	const conflicts: BackupConflict[] = [];
	const duplicates: BackupMergeResult['duplicates'] = [];
	const changes: BackupCollectionChange[] = [];
	const objects: BackupObjectDiff[] = [];
	const left = current as unknown as Records;
	const right = incoming as unknown as Records;
	const result = data as unknown as Records;
	const familyCollections = ['highlights', 'comments', 'excerptCards', 'deletedAnnotations', 'pendingTargetWrites'];
	const family = (source: Records): Records => {
		const families: Records = {};
		for (const collection of familyCollections) for (const [id, value] of Object.entries(source[collection] as Records ?? {})) {
			const record = families[id] as Records ?? {};
			record[collection] = value; families[id] = record;
		}
		return families;
	};
	const families = decideBackupObjects('annotations', family(left), family(right), options, objects, conflicts, true);
	for (const collection of familyCollections) result[collection] = {};
	for (const [id, value] of Object.entries(families)) for (const [collection, record] of Object.entries(value as Records)) (result[collection] as Records)[id] = record;
	for (const collection of ['books', 'settings']) result[collection] = decideBackupObjects(collection, left[collection] as Records, right[collection] as Records, options, objects, conflicts);
	const indexed = (values: { id: string }[]): Records => Object.fromEntries(values.map(value => [value.id, value]));
	data.categories = Object.values(decideBackupObjects('categories', indexed(current.categories), indexed(incoming.categories), options, objects, conflicts)) as ReadingDeskData['categories'];
	data.lists = Object.values(decideBackupObjects('lists', indexed(current.lists ?? []), indexed(incoming.lists ?? []), options, objects, conflicts)) as ReadingDeskData['lists'];
	for (const key of Object.keys(options.objectDecisions ?? {})) if (!objects.some(object => object.key === key)) throw new BackupError('invalid-preview', `逐项决策不在当前差异中：${key}`);
	const count = (collection: string, old: Records, next: Records, imported: Records): void => {
		const change: BackupCollectionChange = { collection, added: 0, updated: 0, removed: 0, unchanged: 0 };
		for (const [id, value] of Object.entries(next)) {
			if (!Object.prototype.hasOwnProperty.call(old, id)) change.added++;
			else if (dataSignature(old[id]) !== dataSignature(value)) change.updated++;
			else change.unchanged++;
		}
		for (const [id, value] of Object.entries(imported)) if (Object.prototype.hasOwnProperty.call(old, id) && dataSignature(old[id]) === dataSignature(value)) duplicates.push({ collection, id });
		change.removed = Object.keys(old).filter(id => !Object.prototype.hasOwnProperty.call(next, id)).length;
		changes.push(change);
	};
	for (const collection of ['books', ...familyCollections, 'settings']) count(collection, left[collection] as Records ?? {}, result[collection] as Records ?? {}, right[collection] as Records ?? {});
	count('categories', indexed(current.categories), indexed(data.categories), indexed(incoming.categories));
	count('lists', indexed(current.lists ?? []), indexed(data.lists ?? []), indexed(incoming.lists ?? []));
	return { data, conflicts, duplicates, changes, objects };
}
