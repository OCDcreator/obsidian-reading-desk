import type { ReadingDeskData } from '../types/contracts';
import { createEmptyData } from './defaults';
import { bookCheck, cardCheck, categoryCheck, commentCheck, deletedAnnotationCheck, highlightCheck, listCheck, settingsCheck } from './DataRecordValidation';
import { checkJson, isPlainObject, ShapeCheck, type ValueCheck } from './DataValidationSupport';
export { DataValidationError, type DataValidationIssue } from './DataValidationSupport';

export const DATA_SCHEMA_VERSION = 1;
export interface DataValidationOptions { requireComplete?: boolean; }

const map = (validator: ValueCheck): ValueCheck => (value, path, check) => check.map(value, path, validator);
const array = (validator: ValueCheck): ValueCheck => (value, path, check) => check.array(value, path, validator);
const fields = {
	books: map(bookCheck), categories: array(categoryCheck), highlights: map(highlightCheck),
	comments: map(array(commentCheck)), excerptCards: map(cardCheck), settings: settingsCheck,
	lists: array(listCheck), deletedAnnotations: map(deletedAnnotationCheck), pendingTargetWrites: map(highlightCheck)
};

/** Missing historical collections/settings are migrated; malformed present values are never discarded. */
export function validateReadingDeskData(value: unknown, options: DataValidationOptions = {}): ReadingDeskData {
	const defaults = createEmptyData();
	if ((value === null || value === undefined) && !options.requireComplete) return defaults;
	const check = new ShapeCheck();
	if (!check.object(value, 'data')) { check.finish(); return defaults; }
	checkJson(value, 'data', check);
	if (options.requireComplete) checkCompleteData(value, defaults, check);
	if (Object.keys(value).length && !Object.keys(fields).some(key => key in value)) check.issue('data', '未识别的 Reading Desk 数据结构');
	if (value.schemaVersion !== undefined && (!Number.isInteger(value.schemaVersion) || Number(value.schemaVersion) < 0 || Number(value.schemaVersion) > DATA_SCHEMA_VERSION)) {
		check.issue('data.schemaVersion', `不支持的数据版本：${String(value.schemaVersion)}`);
	}
	for (const [key, validator] of Object.entries(fields)) {
		if (value[key] !== undefined) validator(value[key], `data.${key}`, check);
		else if (options.requireComplete) check.issue(`data.${key}`, '完整备份缺少此字段');
	}
	check.finish();
	const loaded = structuredClone(value) as Partial<ReadingDeskData>;
	return {
		...defaults, ...loaded, schemaVersion: DATA_SCHEMA_VERSION,
		books: loaded.books ?? defaults.books, categories: loaded.categories ?? defaults.categories,
		highlights: loaded.highlights ?? defaults.highlights, comments: loaded.comments ?? defaults.comments,
		excerptCards: loaded.excerptCards ?? defaults.excerptCards, lists: loaded.lists ?? [],
		deletedAnnotations: loaded.deletedAnnotations ?? {}, pendingTargetWrites: loaded.pendingTargetWrites ?? {},
		settings: {
			...defaults.settings, ...loaded.settings,
			storage: { ...defaults.settings.storage, ...loaded.settings?.storage },
			viewer: { ...defaults.settings.viewer, ...loaded.settings?.viewer }
		}
	};
}

function checkCompleteData(value: Record<string, unknown>, defaults: ReadingDeskData, check: ShapeCheck): void {
	if (value.schemaVersion !== DATA_SCHEMA_VERSION) check.issue('data.schemaVersion', '完整备份必须声明当前数据版本 1');
	const required = (record: unknown, keys: string[], path: string): void => {
		if (!isPlainObject(record)) return; // The shape check separately reports invalid records.
		for (const key of keys) if (record[key] === undefined) check.issue(`${path}.${key}`, '完整快照缺少必要配置');
	};
	required(value.settings, ['libraryFolders', 'storage', 'viewer', 'importedBookshelf'], 'data.settings');
	if (!isPlainObject(value.settings)) return;
	required(value.settings.storage, Object.keys(defaults.settings.storage).filter(key => key !== 'accessKeyId' && key !== 'secretAccessKey'), 'data.settings.storage');
	required(value.settings.viewer, Object.keys(defaults.settings.viewer), 'data.settings.viewer');
}

/** Exact canonical JSON comparison is the concurrency check; the short digest is only for status display. */
export function dataSignature(value: unknown): string {
	if (value === null || value === undefined) return 'missing';
	if (Array.isArray(value)) return `[${value.map(item => dataSignature(item)).join(',')}]`;
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record).filter(key => record[key] !== undefined).sort()
			.map(key => `${JSON.stringify(key)}:${dataSignature(record[key])}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

export function dataFingerprint(value: unknown): string {
	const signature = dataSignature(value);
	let hash = 2166136261;
	for (let index = 0; index < signature.length; index += 1) hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
	return `${(hash >>> 0).toString(16).padStart(8, '0')}:${signature.length}`;
}
