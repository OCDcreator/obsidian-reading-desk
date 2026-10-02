import type { BibliographicSource } from '../types/contracts';
import { BibtexParser, bibtexPlainText, bibtexSplit } from './BibtexParser';
import { bibliographicStableHash, type BibliographicParseResult, type BibliographicProvider, type BibliographicRecord } from './BibliographicTypes';

type JsonObject = Record<string, unknown>;
const MAX_TEXT = 10 * 1024 * 1024;

export function parseBibliographic(provider: BibliographicProvider, text: string): BibliographicParseResult {
	const result: BibliographicParseResult = { provider, records: [], diagnostics: [] };
	try {
		if (!['csl', 'bibtex', 'zotero'].includes(provider)) throw new Error('不支持的文献来源');
		if (typeof text !== 'string' || !text.trim()) throw new Error('请选择非空的文献导出文件');
		if (text.length > MAX_TEXT) throw new Error('文献文件超过 10 MiB，请分批导出');
		if (provider === 'bibtex') {
			result.records = new BibtexParser(text.replace(/^\uFEFF/, '')).parse().map(entry => {
				const fields = entry.fields;
				return makeRecord(provider, entry.citationKey, bibtexPlainText(fields.title ?? ''),
					bibtexSplit(fields.author ?? '', /^\s+and\s+/i).map(bibtexAuthor).filter(Boolean).join('; '),
					fields.doi, fields.isbn, entry.citationKey, bibtexAttachments(fields), fields.year);
			});
		} else {
			const json: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
			const items = Array.isArray(json) ? json : provider === 'zotero' && isObject(json) ? json.items : undefined;
			if (!Array.isArray(items)) throw new Error(provider === 'csl' ? 'CSL JSON 顶层必须是条目数组' : 'Zotero JSON 必须是条目数组或含 items 数组的对象');
			if (!items.length || items.length > 20000) throw new Error('文献条目数必须在 1–20000 之间');
			const objects = items.map((item, index) => {
				if (!isObject(item)) throw new Error(`第 ${index + 1} 条不是文献对象`);
				return isObject(item.data) ? { ...item.data, key: item.data.key ?? item.key } : item;
			});
			objects.forEach((item, index) => {
				if (provider === 'zotero' && ['note', 'attachment', 'annotation'].includes(stringValue(item.itemType))) return;
				try { result.records.push(provider === 'csl' ? cslRecord(item) : zoteroRecord(item, objects)); }
				catch (error) { result.diagnostics.push({ severity: 'error', index, message: error instanceof Error ? error.message : '无效文献条目' }); }
			});
		}
		if (!result.records.length && !result.diagnostics.length) throw new Error('没有可导入的文献条目');
		for (const record of result.records) {
			if (record.source.id.startsWith('metadata:')) result.diagnostics.push({ severity: 'warning', message: `“${record.title}”没有来源 ID/DOI/ISBN；身份由题名、作者和年份生成，修改这些字段后需要重新确认关联。` });
		}
	} catch (error) {
		result.records = [];
		result.diagnostics.push({ severity: 'error', message: error instanceof SyntaxError ? 'JSON 语法无效，请重新导出文件' : error instanceof Error ? error.message : '文献解析失败' });
	}
	return result;
}

function cslRecord(item: JsonObject): BibliographicRecord {
	if (!stringValue(item.type)) throw new Error('CSL 条目缺少 type');
	return makeRecord('csl', idValue(item.id), stringValue(item.title), jsonAuthors(item.author, 'csl'),
		stringValue(item.DOI), stringValue(item.ISBN), stringValue(item['citation-key']), attachmentHints(item), cslYear(item.issued));
}

function zoteroRecord(item: JsonObject, all: JsonObject[]): BibliographicRecord {
	// Zotero's public CSL JSON export is also accepted under the Zotero source choice.
	if (!item.itemType && item.type) {
		const record = cslRecord(item);
		record.source.provider = 'zotero';
		return record;
	}
	if (!stringValue(item.itemType)) throw new Error('Zotero 条目缺少 itemType（CSL JSON 需有 type）');
	const uri = stringValue(item.uri);
	const key = stringValue(item.key) || uri || idValue(item.itemID);
	const nativeId = uri || (key && item.libraryID !== undefined ? `${idValue(item.libraryID)}/${key}` : key);
	const parentKey = idValue(item.key) || idValue(item.itemID);
	const children = parentKey ? all.filter(child => child.itemType === 'attachment' && idValue(child.parentItem) === parentKey) : [];
	return makeRecord('zotero', nativeId, stringValue(item.title), jsonAuthors(item.creators, 'zotero'),
		stringValue(item.DOI), stringValue(item.ISBN), stringValue(item.citationKey),
		[...attachmentHints(item), ...children.flatMap(attachmentHints)], stringValue(item.date));
}

function makeRecord(provider: BibliographicProvider, nativeId: string, title: string, author: string,
	doiValue: string | undefined, isbnValue: string | undefined, citationKey: string | undefined,
	attachmentPaths: string[], year = ''): BibliographicRecord {
	if (!title.trim()) throw new Error('文献条目缺少非空 title');
	const doi = normalizeDoi(doiValue);
	const isbn = normalizeIsbn(isbnValue);
	const id = nativeId.trim() || (doi ? `doi:${doi}` : isbn ? `isbn:${isbn}` : `metadata:${bibliographicStableHash([title, author, year].map(value => value.trim().toLowerCase()).join('\u001f'))}`);
	const source: BibliographicSource = { provider, id };
	if (doi) source.doi = doi;
	if (isbn) source.isbn = isbn;
	if (citationKey?.trim()) source.citationKey = citationKey.trim();
	return { source, title: title.trim(), author: author.trim(), attachmentPaths: [...new Set(attachmentPaths.map(path => path.trim()).filter(Boolean))] };
}

function jsonAuthors(value: unknown, provider: 'csl' | 'zotero'): string {
	if (value === undefined) return '';
	if (!Array.isArray(value)) throw new Error('作者字段必须是数组');
	return value.map(author => {
		if (!isObject(author)) throw new Error('无效作者对象');
		if (provider === 'zotero' && author.creatorType && author.creatorType !== 'author') return '';
		return provider === 'csl'
			? stringValue(author.literal) || [stringValue(author.given), stringValue(author['dropping-particle']), stringValue(author['non-dropping-particle']), stringValue(author.family), stringValue(author.suffix)].filter(Boolean).join(' ')
			: stringValue(author.name) || [stringValue(author.firstName), stringValue(author.lastName)].filter(Boolean).join(' ');
	}).filter(Boolean).join('; ');
}

function attachmentHints(item: JsonObject): string[] {
	const paths = [stringValue(item.path), stringValue(item.localPath), stringValue(item.filename), stringValue(item.file)];
	if (Array.isArray(item.attachments)) {
		for (const attachment of item.attachments) {
			if (isObject(attachment)) paths.push(stringValue(attachment.path), stringValue(attachment.localPath), stringValue(attachment.filename));
			else if (typeof attachment === 'string') paths.push(attachment);
		}
	}
	return paths.filter(Boolean);
}

function bibtexAuthor(value: string): string {
	const parts = bibtexSplit(value, /^,/).map(bibtexPlainText);
	return parts.length > 1 ? [parts[parts.length - 1], ...parts.slice(0, -1)].filter(Boolean).join(' ') : bibtexPlainText(value);
}

function bibtexAttachments(fields: Record<string, string>): string[] {
	const paths = [fields.pdf ?? '', fields.path ?? ''];
	for (const file of bibtexSplit(fields.file ?? '', /^;/)) {
		// Zotero/JabRef label:path:mime; unescaped Windows drive colon is retained by joining the middle.
		const parts = bibtexSplit(file, /^:/);
		const path = parts.length >= 3 && /^(?:application\/)?(?:pdf|epub(?:\+zip)?)$/i.test(parts[parts.length - 1].trim())
			? parts.slice(1, -1).join(':') : file;
		paths.push(path.replace(/\\([:;\\])/g, '$1'));
	}
	return paths.filter(Boolean);
}

export function normalizeDoi(value?: string): string | undefined {
	const doi = value?.trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '').toLowerCase();
	return doi && /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : undefined;
}

export function normalizeIsbn(value?: string): string | undefined {
	const isbn = value?.trim().replace(/^isbn(?:-1[03])?:?\s*/i, '').replace(/[\s-]/g, '').toUpperCase();
	return isbn && /^(?:\d{9}[\dX]|\d{13})$/.test(isbn) ? isbn : undefined;
}

function cslYear(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (!isObject(value)) return '';
	const parts = value['date-parts'];
	return Array.isArray(parts) && Array.isArray(parts[0]) ? String(parts[0][0] ?? '') : stringValue(value.raw) || stringValue(value.literal);
}
function stringValue(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function idValue(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
function isObject(value: unknown): value is JsonObject { return !!value && typeof value === 'object' && !Array.isArray(value); }
