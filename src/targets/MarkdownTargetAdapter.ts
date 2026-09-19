import type { PdfHighlight } from '../types/contracts';
import type { TargetBacklink, TargetCardMetadata, TargetCardOptions, TargetWriteResult } from './TargetTypes';
import { createCardTitle, createSourceLink, excerptMetadata } from './TargetTypes';

const START = '<!-- reading-desk:excerpt-start id=';
const END = '<!-- reading-desk:excerpt-end id=';

function escapeAttribute(value: string): string {
	return encodeURIComponent(value);
}

function marker(prefix: string, id: string): string {
	return `${prefix}${escapeAttribute(id)} -->`;
}

function block(metadata: TargetCardMetadata, text: string): string {
	const start = marker(START, metadata.highlightId ?? '');
	const end = marker(END, metadata.highlightId ?? '');
	const quote = text.split(/\r?\n/).map(line => `> ${line}`).join('\n');
	const fold = metadata.folded ? '-' : '+';
	return `${start}\n> [!quote]${fold} ${metadata.title}\n${quote}\n> [原文第 ${metadata.page + 1} 页](${metadata.sourceLink})\n\n\`\`\`reading-desk\n${JSON.stringify(metadata)}\n\`\`\`\n${end}`;
}

function findBlockRange(content: string, highlightId: string): { start: number; end: number } | undefined {
	const start = marker(START, highlightId);
	const end = marker(END, highlightId);
	const startIndex = content.indexOf(start);
	if (startIndex < 0) return undefined;
	const endIndex = content.indexOf(end, startIndex + start.length);
	if (endIndex < 0) return undefined;
	return { start: startIndex, end: endIndex + end.length };
}

function parseMetadata(text: string): TargetCardMetadata | undefined {
	const match = /```reading-desk\s*\n([\s\S]*?)\n```/.exec(text);
	if (!match) return undefined;
	try {
		const parsed: unknown = JSON.parse(match[1]);
		if (typeof parsed === 'object' && parsed !== null
			&& (parsed as { schemaVersion?: unknown }).schemaVersion === 1
			&& (parsed as { kind?: unknown }).kind === 'excerpt'
			&& typeof (parsed as { highlightId?: unknown }).highlightId === 'string'
			&& typeof (parsed as { sourceLink?: unknown }).sourceLink === 'string'
			&& typeof (parsed as { page?: unknown }).page === 'number') {
			return parsed as TargetCardMetadata;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

export function writeMarkdownExcerpt(
	content: string,
	targetPath: string,
	highlight: PdfHighlight,
	options: TargetCardOptions = {}
): { content: string; result: TargetWriteResult } {
	const title = createCardTitle(highlight, options.title);
	const sourceLink = createSourceLink(highlight, options.sourceLink);
	const metadata = excerptMetadata(highlight, title, sourceLink, options.folded ?? false, options.chapterPath ?? highlight.chapterPath);
	const nextBlock = block(metadata, highlight.text);
	const currentRange = findBlockRange(content, highlight.id);
	const nextContent = currentRange
		? `${content.slice(0, currentRange.start)}${nextBlock}${content.slice(currentRange.end)}`
		: `${content}${content.endsWith('\n') || content.length === 0 ? '' : '\n'}\n${nextBlock}\n`;
	// Markdown has no native object id. Its stable, user-visible start marker is
	// therefore the target object reference, unlike a Canvas node id.
	const objectId = highlight.id;
	return {
		content: nextContent,
		result: { target: { type: 'markdown', path: targetPath, objectId }, objectId, title, sourceLink }
	};
}

export function deleteMarkdownExcerpt(content: string, highlightId: string): string {
	const range = findBlockRange(content, highlightId);
	if (!range) return content;
	const before = content.slice(0, range.start).replace(/\n{3,}$/, '\n\n');
	const after = content.slice(range.end).replace(/^\n{2,}/, '\n');
	return `${before}${after}`;
}

export function markdownExcerptIds(content: string): Set<string> {
	const ids = new Set<string>();
	const expression = /<!-- reading-desk:excerpt-start id=([^\s]+) -->([\s\S]*?)<!-- reading-desk:excerpt-end id=\1 -->/g;
	for (const match of content.matchAll(expression)) {
		const metadata = parseMetadata(match[2]);
		if (metadata?.highlightId) ids.add(metadata.highlightId);
	}
	return ids;
}

export function parseMarkdownBacklink(content: string, highlightId: string): TargetBacklink | undefined {
	const range = findBlockRange(content, highlightId);
	if (!range) return undefined;
	const metadata = parseMetadata(content.slice(range.start, range.end));
	if (!metadata?.highlightId) return undefined;
	return { highlightId: metadata.highlightId, sourceLink: metadata.sourceLink, page: metadata.page };
}
