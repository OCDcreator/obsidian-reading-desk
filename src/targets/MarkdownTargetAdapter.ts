import type { PdfHighlight } from '../types/contracts';
import type { TargetBacklink, TargetCardMetadata, TargetCardOptions, TargetWriteResult } from './TargetTypes';
import { createCardTitle, createSourceLink, excerptMetadata } from './TargetTypes';
import { excerptTemplateValues, renderExcerptTemplate } from './ExcerptTemplate';
import { isRecord, requireExcerptIdentity, TargetRepairError, updateManagedText } from './TargetRepair';

const START = '<!-- reading-desk:excerpt-start id=';
const END = '<!-- reading-desk:excerpt-end id=';

interface MarkdownBlock {
	start: number;
	end: number;
	id: string;
	body: string;
	metadata: TargetCardMetadata;
	fence: string;
}

function marker(prefix: string, id: string): string {
	return `${prefix}${encodeURIComponent(id)} -->`;
}

/** Pair every marker and validate every metadata fence before trusting absence. */
function blocks(content: string): MarkdownBlock[] {
	const tokens = [...content.matchAll(/^<!-- reading-desk:excerpt-(start|end) id=([^\s>]+) -->\r?$/gm)];
	const markerLines = [...content.matchAll(/^[\t ]*<!--\s*reading-desk:excerpt-(?:start|end)[^\n]*/gm)];
	if (tokens.length !== markerLines.length || tokens.length % 2) {
		throw new TargetRepairError('invalid-marker', 'Markdown 摘录标记不完整，请修复后重试。');
	}
	const result: MarkdownBlock[] = [];
	const ids = new Set<string>();
	for (let index = 0; index < tokens.length; index += 2) {
		const start = tokens[index];
		const end = tokens[index + 1];
		if (start[1] !== 'start' || end[1] !== 'end' || start[2] !== end[2]) {
			throw new TargetRepairError('invalid-marker', 'Markdown 摘录标记嵌套或不匹配。');
		}
		let id: string;
		try { id = decodeURIComponent(start[2]); } catch { throw new TargetRepairError('invalid-marker', 'Markdown 摘录 ID 编码损坏。'); }
		if (ids.has(id)) throw new TargetRepairError('ambiguous-card', 'Markdown 中存在重复摘录 ID。');
		ids.add(id);
		const body = content.slice((start.index ?? 0) + start[0].length, end.index);
		const fences = [...body.matchAll(/^```reading-desk[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```\r?$/gm)];
		if (fences.length !== 1) throw new TargetRepairError('invalid-metadata', 'Markdown 摘录 JSON 缺失或重复。');
		let parsed: unknown;
		try { parsed = JSON.parse(fences[0][1]); } catch { throw new TargetRepairError('invalid-metadata', 'Markdown 摘录 JSON 损坏。'); }
		if (!isRecord(parsed) || requireExcerptIdentity(parsed) !== id) {
			throw new TargetRepairError('invalid-metadata', 'Markdown 标记和元数据 ID 不一致。');
		}
		result.push({ start: start.index ?? 0, end: (end.index ?? 0) + end[0].length, id, body, metadata: parsed as unknown as TargetCardMetadata, fence: fences[0][0] });
	}
	const allFences = [...content.matchAll(/^[\t ]*```reading-desk\b/gm)];
	if (allFences.length !== result.length) throw new TargetRepairError('invalid-marker', 'Markdown 存在没有完整摘录标记的元数据。');
	return result;
}

function quoteBody(highlight: PdfHighlight, title: string, sourceLink: string, template?: string): string {
	return renderExcerptTemplate(template, excerptTemplateValues(highlight, title, sourceLink))
		.split(/\r?\n/).map(line => `> ${line}`).join('\n');
}

function legacyBody(current: MarkdownBlock, highlight: PdfHighlight, next: string): string {
	// Legacy blocks had no managed baseline. Remove only exact known generated
	// fragments; everything else, including handwritten quoted notes, survives.
	let remainder = current.body.replace(current.fence, '').replace(/\r\n/g, '\n').trim();
	remainder = remainder.replace(/^> \[!quote\][+-]?[^\r\n]*\r?\n?/, '');
	const knownQuote = highlight.text.split(/\r?\n/).map(line => `> ${line}`).join('\n');
	if (knownQuote && (remainder === knownQuote || remainder.startsWith(`${knownQuote}\n`) || remainder.startsWith(`${knownQuote}\r\n`))) {
		remainder = remainder.slice(knownQuote.length);
	}
	const backlink = `> [原文第 ${current.metadata.page + 1} 页](${current.metadata.sourceLink})`;
	remainder = remainder.replace(backlink, '').trim();
	return `${next}${remainder ? `\n\n${remainder}` : ''}`;
}

function updatedBody(current: MarkdownBlock, highlight: PdfHighlight, next: string): string {
	if (!current.metadata.managedText) return legacyBody(current, highlight, next);
	let body = current.body.replace(current.fence, '').trim();
	body = body.replace(/^> \[!quote\][+-]?[^\r\n]*\r?\n?/, '');
	return updateManagedText(body.trim(), current.metadata.managedText, next);
}

export function writeMarkdownExcerpt(
	content: string, targetPath: string, highlight: PdfHighlight, options: TargetCardOptions = {}
): { content: string; result: TargetWriteResult } {
	const current = blocks(content).find(candidate => candidate.id === highlight.id);
	if (!current && content.includes(createSourceLink(highlight))) {
		throw new TargetRepairError('metadata-missing', 'Markdown 回链仍在但摘录标记缺失，请修复后重试。');
	}
	const heading = current && /^> \[!quote\]([+-]?) ?([^\r\n]*)/m.exec(current.body);
	const title = createCardTitle(highlight, options.title ?? (heading ? heading[2] : current?.metadata.title));
	const folded = options.folded ?? (heading ? heading[1] === '-' : current?.metadata.folded ?? false);
	const sourceLink = createSourceLink(highlight, options.sourceLink);
	const metadata = { ...current?.metadata, ...excerptMetadata(highlight, title, sourceLink, folded, options.chapterPath ?? highlight.chapterPath) };
	metadata.managedText = quoteBody(highlight, title, sourceLink, options.template);
	const body = current ? updatedBody(current, highlight, metadata.managedText) : metadata.managedText;
	const nextBlock = `${marker(START, highlight.id)}\n> [!quote]${folded ? '-' : '+'} ${title}\n${body}\n\n\`\`\`reading-desk\n${JSON.stringify(metadata)}\n\`\`\`\n${marker(END, highlight.id)}`;
	const nextContent = current
		? `${content.slice(0, current.start)}${nextBlock}${content.slice(current.end)}`
		: `${content}${content.endsWith('\n') || !content.length ? '' : '\n'}\n${nextBlock}\n`;
	return { content: nextContent, result: { target: { type: 'markdown', path: targetPath, objectId: highlight.id }, objectId: highlight.id, title, sourceLink, folded } };
}

export function deleteMarkdownExcerpt(content: string, highlightId: string): string {
	const range = blocks(content).find(candidate => candidate.id === highlightId);
	if (!range) return content;
	const before = content.slice(0, range.start).replace(/\n{3,}$/, '\n\n');
	const after = content.slice(range.end).replace(/^\n{2,}/, '\n');
	return `${before}${after}`;
}

export function markdownExcerptIds(content: string): Set<string> {
	return new Set(blocks(content).map(block => block.id));
}

export function parseMarkdownBacklink(content: string, highlightId: string): TargetBacklink | undefined {
	try {
		const metadata = blocks(content).find(candidate => candidate.id === highlightId)?.metadata;
		return metadata ? { highlightId, sourceLink: metadata.sourceLink, page: metadata.page } : undefined;
	} catch { return undefined; }
}
