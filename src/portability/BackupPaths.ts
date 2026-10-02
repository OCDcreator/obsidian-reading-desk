import type { PdfHighlight, ReadingDeskData } from '../types/contracts';
import type { BackupIssue, BackupPathChange, BackupPathMapping } from './BackupTypes';

export function isVaultPath(path: string): boolean {
	return !!path && !path.startsWith('/') && !path.includes('\\') && !/^[a-z]+:/i.test(path)
		&& !path.split('/').some(part => !part || part === '.' || part === '..') && ![...path].some(character => character.charCodeAt(0) < 32);
}

export function mapBackupPaths(data: ReadingDeskData, mappings: BackupPathMapping[], issues: BackupIssue[]): BackupPathChange[] {
	const changes: BackupPathChange[] = [];
	const seen = new Set<string>();
	for (const mapping of mappings) {
		if (!isVaultPath(mapping.from) || !isVaultPath(mapping.to)) issues.push({ code: 'path', path: 'pathMappings', message: '映射必须使用 vault 内相对路径，不能含绝对路径或 ..', severity: 'error' });
		if (seen.has(mapping.from)) issues.push({ code: 'path', path: 'pathMappings', message: `重复的映射来源：${mapping.from}`, severity: 'error' });
		seen.add(mapping.from);
	}
	const sorted = [...mappings].sort((left, right) => right.from.length - left.from.length);
	const map = (path: string, field: string): string => {
		const mapping = sorted.find(item => path === item.from || path.startsWith(`${item.from}/`));
		if (!mapping) return path;
		const mapped = mapping.to + path.slice(mapping.from.length);
		if (mapped !== path) changes.push({ field, from: path, to: mapped });
		return mapped;
	};
	for (const [id, book] of Object.entries(data.books)) {
		book.path = map(book.path, `books.${id}.path`);
		if (book.coverPath) book.coverPath = map(book.coverPath, `books.${id}.coverPath`);
	}
	const highlight = (value: PdfHighlight, field: string): void => {
		value.pdfPath = map(value.pdfPath, `${field}.pdfPath`);
		if (value.target) value.target.path = map(value.target.path, `${field}.target.path`);
	};
	for (const [id, value] of Object.entries(data.highlights)) highlight(value, `highlights.${id}`);
	for (const [id, value] of Object.entries(data.pendingTargetWrites ?? {})) highlight(value, `pendingTargetWrites.${id}`);
	for (const [id, value] of Object.entries(data.deletedAnnotations ?? {})) highlight(value.highlight, `deletedAnnotations.${id}.highlight`);
	data.settings.libraryFolders = data.settings.libraryFolders.map((path, index) => map(path, `settings.libraryFolders[${index}]`));
	return changes;
}

export function checkBackupPaths(data: ReadingDeskData, issues: BackupIssue[], existingPaths?: string[]): void {
	const existing = existingPaths ? new Set(existingPaths) : undefined;
	const checked = new Set<string>();
	const path = (value: string, field: string, checkExists = true): void => {
		if (!isVaultPath(value)) issues.push({ code: 'path', path: field, message: `无效的 vault 相对路径：${value}`, severity: 'error' });
		else if (checkExists && existing && !existing.has(value) && !checked.has(value)) {
			issues.push({ code: 'missing-file', path: field, message: `vault 中未找到文件：${value}；恢复只保留引用`, severity: 'warning' });
		}
		checked.add(value);
	};
	for (const [id, book] of Object.entries(data.books)) {
		path(book.path, `books.${id}.path`);
		if (book.coverPath) path(book.coverPath, `books.${id}.coverPath`);
	}
	const highlight = (value: PdfHighlight, field: string): void => {
		path(value.pdfPath, `${field}.pdfPath`);
		if (value.target) path(value.target.path, `${field}.target.path`);
	};
	for (const [id, value] of Object.entries(data.highlights)) highlight(value, `highlights.${id}`);
	for (const [id, value] of Object.entries(data.pendingTargetWrites ?? {})) highlight(value, `pendingTargetWrites.${id}`);
	for (const [id, value] of Object.entries(data.deletedAnnotations ?? {})) highlight(value.highlight, `deletedAnnotations.${id}.highlight`);
	data.settings.libraryFolders.forEach((folder, index) => { if (folder) path(folder, `settings.libraryFolders[${index}]`, false); });
}
