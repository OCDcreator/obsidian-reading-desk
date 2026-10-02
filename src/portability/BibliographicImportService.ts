import type { LibraryBook } from '../types/contracts';
import { parseBibliographic } from './BibliographicParsers';
import {
	bibliographicSourceKey, bibliographicStableHash,
	type BibliographicImportEntry, type BibliographicImportPlan, type BibliographicLocalFile,
	type BibliographicParseResult, type BibliographicPlanOptions, type BibliographicProvider, type BibliographicRecord
} from './BibliographicTypes';
export * from './BibliographicTypes';

/** Pure source adaptation and planning. The host alone applies resultBooks via LibraryIndex. */
export class BibliographicImportService {
	parse(provider: BibliographicProvider, text: string): BibliographicParseResult {
		return parseBibliographic(provider, text);
	}

	plan(parsed: BibliographicParseResult, existingBooks: LibraryBook[], options: BibliographicPlanOptions = {}): BibliographicImportPlan {
		const diagnostics = [...parsed.diagnostics];
		const files = localFiles(existingBooks, options);
		const records = new Map<string, BibliographicRecord>();
		const duplicates = new Set<string>();
		for (const record of parsed.records) {
			const key = bibliographicSourceKey(record.source);
			const previous = records.get(key);
			if (previous && JSON.stringify(previous) !== JSON.stringify(record)) duplicates.add(key);
			else if (previous) diagnostics.push({ severity: 'warning', message: `已合并重复来源 ${key}` });
			records.set(key, record);
		}
		const entries = [...records.values()].map(record => planEntry(record, existingBooks, files, options.pathMappings ?? {}, duplicates));
		const paths = new Map<string, BibliographicImportEntry[]>();
		for (const entry of entries) {
			if (!entry.pathConfirmed || !entry.path || entry.kind === 'conflict') continue;
			paths.set(entry.path, [...(paths.get(entry.path) ?? []), entry]);
		}
		for (const group of paths.values()) {
			if (group.length > 1) group.forEach(entry => markConflict(entry, '多条来源关联到同一个文件，请分别确认路径'));
		}
		const hasErrors = diagnostics.some(item => item.severity === 'error');
		const resultBooks = hasErrors ? [] : entries.filter(entry => entry.pathConfirmed && ['new', 'update'].includes(entry.kind))
			.map(entry => resultBook(entry, existingBooks, files));
		const summary: BibliographicImportPlan['summary'] = { new: 0, update: 0, unchanged: 0, conflict: 0, 'no-attachment': 0 };
		entries.forEach(entry => summary[entry.kind]++);
		return { entries, resultBooks, diagnostics, hasErrors, summary };
	}
}

function planEntry(record: BibliographicRecord, books: LibraryBook[], files: Map<string, BibliographicLocalFile>,
	mappings: Record<string, string>, duplicates: Set<string>): BibliographicImportEntry {
	const key = bibliographicSourceKey(record.source);
	const matches = books.filter(book => book.source && bibliographicSourceKey(book.source) === key);
	const current = matches[0];
	const explicit = Object.prototype.hasOwnProperty.call(mappings, key);
	const mapped = explicit ? normalizeVaultPath(mappings[key]) : undefined;
	const existingPath = current && normalizeVaultPath(current.path);
	const suggestedPaths = suggestPaths(record, files);
	const path = explicit ? mapped : existingPath;
	const entry: BibliographicImportEntry = {
		key, record, kind: current ? 'update' : (path && files.has(path)) || suggestedPaths.length ? 'new' : 'no-attachment',
		bookId: current?.id, path, pathConfirmed: !!path && files.has(path), suggestedPaths,
		changes: [], protectedFields: []
	};
	if (duplicates.has(key)) return markConflict(entry, '导出中相同 source ID 的内容不同');
	if (matches.length > 1) return markConflict(entry, '当前书库存在重复 source ID，需先解决身份冲突');
	if (explicit && (!mapped || !files.has(mapped))) return markConflict(entry, '关联路径必须是当前库中的 PDF/EPUB 文件');
	if (current && path && path !== current.path) return markConflict(entry, '已有来源的文件路径发生变化，请先通过书库重新关联（relink）后再导入');
	const owners = path ? books.filter(book => normalizeVaultPath(book.path) === path) : [];
	if (owners.length > 1) return markConflict(entry, '同一路径有多个书库记录');
	const owner = owners[0];
	if (owner && current && owner.id !== current.id) return markConflict(entry, '关联路径已属于另一图书，保留现有标注身份');
	if (owner?.source && bibliographicSourceKey(owner.source) !== key) return markConflict(entry, '文件已关联另一文献来源');
	const base = current ?? owner;
	if (base) {
		entry.bookId = base.id;
		entry.kind = 'update';
		if (base.metadataOverrides?.title !== undefined) entry.protectedFields.push('title');
		if (base.metadataOverrides?.author !== undefined) entry.protectedFields.push('author');
		if (base.title !== (base.metadataOverrides?.title ?? record.title)) entry.changes.push('title');
		if (base.author !== (base.metadataOverrides?.author ?? record.author)) entry.changes.push('author');
		if (JSON.stringify(base.source) !== JSON.stringify(record.source)) entry.changes.push('source');
		if (path && base.path !== path) entry.changes.push('path');
		// Retain the latest upstream values even while a manual override masks them.
		const upstreamChanged = base.autoMetadata?.title !== record.title || base.autoMetadata?.author !== record.author || !!base.missing && entry.pathConfirmed;
		if (!entry.changes.length && !upstreamChanged) entry.kind = 'unchanged';
	} else {
		const id = importedBookId(key);
		if (books.some(book => book.id === id)) return markConflict(entry, '生成的图书 ID 与现有记录冲突');
	}
	if (!entry.pathConfirmed) {
		entry.reason = current ? '现有文件缺失，请重新关联库内文件' : suggestedPaths.length ? '候选附件需要确认关联路径' : '没有本地附件，可手动关联当前库中的 PDF/EPUB';
	}
	return entry;
}

function resultBook(entry: BibliographicImportEntry, books: LibraryBook[], files: Map<string, BibliographicLocalFile>): LibraryBook {
	const current = books.find(book => book.id === entry.bookId);
	const path = entry.path ?? '';
	const file = files.get(path);
	const stat = file?.stat ?? { mtime: 0, size: 0 };
	return {
		...(current ? structuredClone(current) : {
			id: importedBookId(entry.key), path, format: /\.epub$/i.test(path) ? 'epub' as const : 'pdf' as const,
			fileSize: stat.size, fingerprint: { ...stat }, tags: [], progress: 0
		}),
		path,
		format: /\.epub$/i.test(path) ? 'epub' : 'pdf',
		title: current?.metadataOverrides?.title ?? entry.record.title,
		author: current?.metadataOverrides?.author ?? entry.record.author,
		autoMetadata: { title: entry.record.title, author: entry.record.author },
		source: { ...entry.record.source },
		...(current?.path !== path ? { coverPath: undefined, pageCount: undefined, metadataError: undefined, fileSize: stat.size, fingerprint: { ...stat } } : {}),
		missing: false
	};
}

function localFiles(books: LibraryBook[], options: BibliographicPlanOptions): Map<string, BibliographicLocalFile> {
	const entries = options.availableFiles ?? options.availablePaths?.map(path => ({ path }))
		?? books.filter(book => !book.missing).map(book => ({ path: book.path, stat: book.fingerprint }));
	const files = new Map<string, BibliographicLocalFile>();
	for (const file of entries) {
		const path = normalizeVaultPath(file.path);
		if (path) files.set(path, { ...file, path });
	}
	return files;
}

function suggestPaths(record: BibliographicRecord, files: Map<string, BibliographicLocalFile>): string[] {
	const exact = record.attachmentPaths.map(normalizeVaultPath).filter((path): path is string => !!path && files.has(path));
	const filenames = new Set(record.attachmentPaths.map(attachment => {
		let value = attachment;
		try { value = decodeURIComponent(value); } catch { /* A malformed hint remains text. */ }
		return value.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
	}));
	const matching = [...files.keys()].filter(path => filenames.has(path.split('/').pop()?.toLowerCase()));
	return [...new Set([...exact, ...matching])];
}

/** Only relative vault paths; external attachment hints are never directly imported. */
export function normalizeVaultPath(value: string): string | undefined {
	if (typeof value !== 'string') return undefined;
	const path = value.trim().replace(/\\/g, '/');
	if (!path || /^(?:\/|[a-z][a-z\d+.-]*:)/i.test(path) || [...path].some(char => char.charCodeAt(0) < 32)) return undefined;
	if (path.split('/').some(part => !part || part === '.' || part === '..')) return undefined;
	return /\.(?:pdf|epub)$/i.test(path) ? path : undefined;
}

function importedBookId(key: string): string { return `book-biblio-${bibliographicStableHash(key)}`; }
function markConflict(entry: BibliographicImportEntry, reason: string): BibliographicImportEntry {
	entry.kind = 'conflict'; entry.pathConfirmed = false; entry.reason = reason;
	return entry;
}
