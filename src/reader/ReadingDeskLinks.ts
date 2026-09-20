import type { PdfHighlight } from '../types/contracts';

export type ReadingDeskLinkTarget =
	| { kind: 'highlight'; highlightId: string; file?: string }
	| { kind: 'page'; page: number; file?: string; bookId?: string };

export type ReadingDeskLinkParseResult =
	| { ok: true; target: ReadingDeskLinkTarget }
	| { ok: false; message: string };

const PROTOCOL = 'obsidian://reading-desk-highlight';

export function createHighlightLink(highlight: Pick<PdfHighlight, 'id' | 'pdfPath'>): string {
	return `${PROTOCOL}?file=${encodeURIComponent(highlight.pdfPath)}&highlight=${encodeURIComponent(highlight.id)}`;
}

export function createPageLink(input: { file: string; page: number; bookId?: string }): string {
	if (!Number.isSafeInteger(input.page) || input.page < 1) throw new Error('可见页码必须是大于零的整数。');
	const params = new URLSearchParams({ file: input.file, page: String(input.page) });
	if (input.bookId) params.set('book', input.bookId);
	return `${PROTOCOL}?${params.toString()}`;
}

/** Parses both the original highlight route and the new mutually-exclusive page route. */
export function parseReadingDeskLink(params: Record<string, string>): ReadingDeskLinkParseResult {
	const highlightId = params.highlight?.trim();
	const rawPage = params.page?.trim();
	if (highlightId && rawPage) return { ok: false, message: 'Reading Desk 原文链接不能同时指定高亮和页码。' };
	if (highlightId) return { ok: true, target: { kind: 'highlight', highlightId, file: clean(params.file) } };
	if (!rawPage) return { ok: false, message: 'Reading Desk 原文链接缺少高亮标识或页码。' };
	if (!/^\d+$/.test(rawPage)) return { ok: false, message: 'Reading Desk 页链接的页码无效。' };
	const page = Number(rawPage);
	if (!Number.isSafeInteger(page) || page < 1) return { ok: false, message: 'Reading Desk 页链接的页码无效。' };
	const file = clean(params.file);
	const bookId = clean(params.book);
	if (!file && !bookId) return { ok: false, message: 'Reading Desk 页链接缺少图书标识。' };
	return { ok: true, target: { kind: 'page', page, file, bookId } };
}

export async function writeReadingDeskLink(clipboard: Pick<Clipboard, 'writeText'>, link: string): Promise<void> {
	await clipboard.writeText(link);
}

function clean(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed || undefined;
}
