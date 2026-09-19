import type {
	BookFormat,
	LibraryBook,
	LibraryCategory,
	ReadingDeskData,
	ReadingDeskSettings
} from '../types/contracts';

const DEFAULT_CATEGORY_NAME = '未分类';
const LEGACY_IMPORT_ID_PREFIX = 'legacy-bookshelf-';

type UnknownRecord = Record<string, unknown>;

export interface BookshelfImportResult {
	data: ReadingDeskData;
	importedBookCount: number;
	skippedBookCount: number;
	importedCategoryCount: number;
	alreadyImported: boolean;
}

export interface BookshelfExportBundle {
	markdown: string;
	json: string;
	markdownBlob: Blob;
	jsonBlob: Blob;
}

interface ExportedBook {
	id: string;
	path: string;
	format: BookFormat;
	title: string;
	author: string;
	pageCount?: number;
	fileSize: number;
	coverPath?: string;
	category?: string;
	tags: string[];
	rating?: number;
	progress: number;
	lastReadAt?: number;
	metadataError?: string;
}

interface ExportedBookshelf {
	schemaVersion: 1;
	exportedAt: string;
	metadata: {
		bookCount: number;
		categoryCount: number;
		libraryFolders: string[];
	};
	categories: LibraryCategory[];
	books: ExportedBook[];
}

/**
 * Imports the old Bookshelf metadata shape into a new Reading Desk data copy.
 * The legacy value is only read; persistence remains the caller's responsibility.
 */
export function importLegacyBookshelf(
	legacyValue: unknown,
	currentData: ReadingDeskData,
	now = Date.now()
): BookshelfImportResult {
	const data = cloneReadingDeskData(currentData);
	if (data.settings.importedBookshelf) {
		return {
			data,
			importedBookCount: 0,
			skippedBookCount: 0,
			importedCategoryCount: 0,
			alreadyImported: true
		};
	}

	const legacyRoot = asRecord(legacyValue);
	const legacyBooks = collectLegacyBooks(legacyValue);
	const categoryNames = collectCategoryNames(legacyRoot, legacyBooks);
	const categoryResult = appendCategories(data.categories, categoryNames);
	data.categories = categoryResult.categories;
	const categoryIdsByName = new Map(data.categories.map(category => [category.name, category.id]));
	data.settings = mergeLegacyLibraryFolders(data.settings, legacyRoot);

	const knownIds = new Set(Object.keys(data.books));
	const knownPaths = new Set(Object.values(data.books).map(book => normalizePath(book.path)));
	let importedBookCount = 0;
	let skippedBookCount = 0;

	for (const legacyBook of legacyBooks) {
		const mapped = mapLegacyBook(legacyBook, knownIds, categoryIdsByName, now);
		if (!mapped || knownIds.has(mapped.id) || knownPaths.has(normalizePath(mapped.path))) {
			skippedBookCount += 1;
			continue;
		}

		data.books[mapped.id] = mapped;
		knownIds.add(mapped.id);
		knownPaths.add(normalizePath(mapped.path));
		importedBookCount += 1;
	}

	data.settings.importedBookshelf = true;
	return {
		data,
		importedBookCount,
		skippedBookCount,
		importedCategoryCount: categoryResult.addedCount,
		alreadyImported: false
	};
}

/**
 * Produces caller-persistable Markdown and JSON representations without writing
 * to the vault or touching the source data.
 */
export function exportBookshelf(data: ReadingDeskData, exportedAt = new Date()): BookshelfExportBundle {
	const categories = [...data.categories]
		.map(category => ({ ...category }))
		.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'zh-CN'));
	const categoryById = new Map(categories.map(category => [category.id, category.name]));
	const books = Object.values(data.books)
		.map(book => toExportedBook(book, categoryById))
		.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN') || left.path.localeCompare(right.path));
	const payload: ExportedBookshelf = {
		schemaVersion: 1,
		exportedAt: exportedAt.toISOString(),
		metadata: {
			bookCount: books.length,
			categoryCount: categories.length,
			libraryFolders: [...data.settings.libraryFolders]
		},
		categories,
		books
	};
	const json = `${JSON.stringify(payload, null, '\t')}\n`;
	const markdown = renderMarkdown(payload);

	return {
		markdown,
		json,
		markdownBlob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
		jsonBlob: new Blob([json], { type: 'application/json;charset=utf-8' })
	};
}

function collectLegacyBooks(value: unknown): UnknownRecord[] {
	if (Array.isArray(value)) {
		return value.map(asRecord).filter((book): book is UnknownRecord => book !== null);
	}

	const root = asRecord(value);
	if (!root) {
		return [];
	}
	const candidates = [root.books, root.metadata, root.bookMetadata, root.library];
	for (const candidate of candidates) {
		const records = collectRecordValues(candidate);
		if (records.length > 0) {
			return records;
		}
	}

	return looksLikeLegacyBook(root) ? [root] : [];
}

function collectRecordValues(value: unknown): UnknownRecord[] {
	if (Array.isArray(value)) {
		return value.map(asRecord).filter((record): record is UnknownRecord => record !== null);
	}
	const record = asRecord(value);
	if (!record) {
		return [];
	}
	if (looksLikeLegacyBook(record)) {
		return [record];
	}
	return Object.values(record)
		.map(asRecord)
		.filter((entry): entry is UnknownRecord => entry !== null);
}

function collectCategoryNames(root: UnknownRecord | null, books: UnknownRecord[]): string[] {
	const fromSettings = asRecord(root?.settings);
	const rawCategories = fromSettings?.categories ?? root?.categories;
	const names = new Set<string>();
	if (Array.isArray(rawCategories)) {
		for (const category of rawCategories) {
			const name = stringValue(typeof category === 'string' ? category : asRecord(category)?.name);
			if (name) {
				names.add(name);
			}
		}
	}
	for (const book of books) {
		const metadata = readLegacyMetadata(book);
		const category = stringValue(metadata.category);
		if (category) {
			names.add(category);
		}
	}
	return [...names];
}

function appendCategories(existing: LibraryCategory[], incomingNames: string[]): {
	categories: LibraryCategory[];
	addedCount: number;
} {
	const categories = existing.map(category => ({ ...category }));
	const names = new Set(categories.map(category => category.name));
	let order = categories.reduce((highest, category) => Math.max(highest, category.order), -1) + 1;
	let addedCount = 0;

	for (const name of incomingNames) {
		if (names.has(name)) {
			continue;
		}
		categories.push({
			id: `legacy-category-${stableHash(name)}`,
			name,
			order
		});
		names.add(name);
		order += 1;
		addedCount += 1;
	}
	return { categories, addedCount };
}

function mergeLegacyLibraryFolders(settings: ReadingDeskSettings, root: UnknownRecord | null): ReadingDeskSettings {
	const legacySettings = asRecord(root?.settings);
	const folder = stringValue(legacySettings?.booksFolder);
	if (!folder || settings.libraryFolders.includes(folder)) {
		return { ...settings, libraryFolders: [...settings.libraryFolders] };
	}
	return { ...settings, libraryFolders: [...settings.libraryFolders, folder] };
}

function mapLegacyBook(
	record: UnknownRecord,
	knownIds: Set<string>,
	categoryIdsByName: Map<string, string>,
	now: number
): LibraryBook | null {
	const metadata = readLegacyMetadata(record);
	const path = normalizePath(stringValue(metadata.filepath) || stringValue(metadata.path));
	if (!path) {
		return null;
	}
	const sourceId = stringValue(metadata.id);
	const id = uniqueBookId(sourceId || `${LEGACY_IMPORT_ID_PREFIX}${stableHash(path)}`, path, knownIds);
	const fileName = stringValue(metadata.filename) || lastPathSegment(path);
	const format = inferFormat(path);
	const categoryName = stringValue(metadata.category);

	return {
		id,
		path,
		format,
		title: stringValue(metadata.title) || stripExtension(fileName),
		author: stringValue(metadata.author),
		pageCount: positiveInteger(metadata.pageCount),
		fileSize: parseFileSize(metadata.fileSize),
		coverPath: stringValue(metadata.cover) || undefined,
		categoryId: categoryName ? categoryIdsByName.get(categoryName) : undefined,
		tags: stringArray(metadata.tags),
		rating: ratingValue(metadata.rating),
		progress: clampProgress(metadata.progress),
		lastReadAt: parseTimestamp(metadata.lastReadAt),
		fingerprint: {
			mtime: parseTimestamp(metadata.updatedAt) ?? parseTimestamp(metadata.addedAt) ?? now,
			size: parseFileSize(metadata.fileSize)
		}
	};
}

function readLegacyMetadata(record: UnknownRecord): UnknownRecord {
	const nested = asRecord(record.metadata);
	return nested ? { ...record, ...nested } : record;
}

function uniqueBookId(preferredId: string, path: string, knownIds: Set<string>): string {
	if (!knownIds.has(preferredId)) {
		return preferredId;
	}
	const fallback = `${LEGACY_IMPORT_ID_PREFIX}${stableHash(`${preferredId}:${path}`)}`;
	let candidate = fallback;
	let suffix = 2;
	while (knownIds.has(candidate)) {
		candidate = `${fallback}-${suffix}`;
		suffix += 1;
	}
	return candidate;
}

function cloneReadingDeskData(data: ReadingDeskData): ReadingDeskData {
	return {
		books: Object.fromEntries(Object.entries(data.books).map(([id, book]) => [id, {
			...book,
			tags: [...book.tags],
			fingerprint: { ...book.fingerprint }
		}])),
		categories: data.categories.map(category => ({ ...category })),
		highlights: { ...data.highlights },
		comments: Object.fromEntries(Object.entries(data.comments).map(([id, comments]) => [id, comments.map(comment => ({ ...comment }))])),
		excerptCards: Object.fromEntries(Object.entries(data.excerptCards ?? {}).map(([id, card]) => [id, { ...card }])),
		settings: {
			...data.settings,
			libraryFolders: [...data.settings.libraryFolders],
			storage: { ...data.settings.storage }
		}
	};
}

function toExportedBook(book: LibraryBook, categoryById: Map<string, string>): ExportedBook {
	return {
		id: book.id,
		path: book.path,
		format: book.format,
		title: book.title,
		author: book.author,
		pageCount: book.pageCount,
		fileSize: book.fileSize,
		coverPath: book.coverPath,
		category: book.categoryId ? categoryById.get(book.categoryId) ?? book.categoryId : undefined,
		tags: [...book.tags],
		rating: book.rating,
		progress: book.progress,
		lastReadAt: book.lastReadAt,
		metadataError: book.metadataError
	};
}

function renderMarkdown(payload: ExportedBookshelf): string {
	const lines = [
		'# Reading Desk 书架导出',
		'',
		`导出时间：${payload.exportedAt}`,
		`书目数量：${payload.metadata.bookCount}`,
		`分类数量：${payload.metadata.categoryCount}`,
		`书库文件夹：${payload.metadata.libraryFolders.map(escapeMarkdown).join('、') || '未设置'}`,
		'',
		'| 标题 | 作者 | 分类 | 标签 | 评分 | 进度 | 格式 | 路径 |',
		'| --- | --- | --- | --- | ---: | ---: | --- | --- |'
	];
	for (const book of payload.books) {
		lines.push([
			escapeMarkdown(book.title),
			escapeMarkdown(book.author || '未知作者'),
			escapeMarkdown(book.category || DEFAULT_CATEGORY_NAME),
			book.tags.map(escapeMarkdown).join(', '),
			book.rating === undefined ? '' : String(book.rating),
			`${Math.round(book.progress * 100)}%`,
			book.format.toUpperCase(),
			escapeMarkdown(book.path)
		].map(value => `| ${value} `).join('') + '|');
	}
	return `${lines.join('\n')}\n`;
}

function asRecord(value: unknown): UnknownRecord | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function looksLikeLegacyBook(value: UnknownRecord): boolean {
	return ['filepath', 'path', 'filename', 'title', 'metadata'].some(key => key in value);
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()).filter(Boolean) : [];
}

function positiveInteger(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function ratingValue(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(number) && number > 0 ? number : undefined;
}

function clampProgress(value: unknown): number {
	const number = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(number)) {
		return 0;
	}
	return Math.min(1, Math.max(0, number > 1 ? number / 100 : number));
}

function parseFileSize(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
		return Math.floor(value);
	}
	if (typeof value !== 'string') {
		return 0;
	}
	const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(bytes?|kb|mb|gb)?$/i);
	if (!match) {
		return 0;
	}
	const unit = (match[2] || 'bytes').toLowerCase();
	const multiplier = unit.startsWith('g') ? 1024 ** 3 : unit.startsWith('m') ? 1024 ** 2 : unit.startsWith('k') ? 1024 : 1;
	return Math.round(Number(match[1]) * multiplier);
}

function parseTimestamp(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value !== 'string' || !value.trim()) {
		return undefined;
	}
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function inferFormat(path: string): BookFormat {
	return path.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf';
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function lastPathSegment(path: string): string {
	return path.split('/').pop() || path;
}

function stripExtension(value: string): string {
	return value.replace(/\.(pdf|epub)$/i, '');
}

function stableHash(value: string): string {
	let hash = 5381;
	for (const character of value) {
		hash = (hash * 33) ^ character.charCodeAt(0);
	}
	return (hash >>> 0).toString(36);
}

function escapeMarkdown(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, '<br>');
}
