import type { PdfHighlight, SourceFingerprint } from '../types/contracts';

export type SourceAnchorStatus = 'matched' | 'changed' | 'unknown';
export interface SourceAnchorDiagnostic {
	highlightId: string;
	/** Physical zero-based page stays unchanged, independently of the printed label. */
	page: number;
	pageLabel?: string;
	status: SourceAnchorStatus;
	message: string;
	quote: string;
	searchQuery: string;
	chapter: string;
}
export const SOURCE_QUOTE_PREVIEW_LENGTH = 240;
export const SOURCE_QUOTE_SEARCH_LENGTH = 120;

/** Read-only stat comparison for highlights from one source; never relocates an anchor. */
export function diagnoseSourceAnchors(highlights: readonly PdfHighlight[], current: SourceFingerprint | undefined): SourceAnchorDiagnostic[] {
	return highlights.map(highlight => {
		const recorded = highlight.sourceFingerprint;
		const status: SourceAnchorStatus = !validFingerprint(recorded) || !validFingerprint(current) ? 'unknown'
			: recorded.mtime === current.mtime && recorded.size === current.size ? 'matched' : 'changed';
		const message = status === 'changed' ? '文件信息变化，位置需核验。'
			: status === 'matched' ? '文件时间和大小未变；尚未核验正文内容。'
				: !validFingerprint(recorded) ? '创建时未记录文件信息，位置尚未核验。' : '当前源文件信息不可用，位置尚未核验。';
		const quote = highlight.text.trim();
		return {
			highlightId: highlight.id, page: highlight.page, pageLabel: highlight.pageLabel,
			status, message, quote: boundedText(quote, SOURCE_QUOTE_PREVIEW_LENGTH),
			searchQuery: quote.slice(0, SOURCE_QUOTE_SEARCH_LENGTH).trim(),
			chapter: boundedText(highlight.chapterPath.join(' / '), 120)
		};
	});
}
function validFingerprint(value: SourceFingerprint | undefined): value is SourceFingerprint {
	return !!value && Number.isFinite(value.mtime) && value.mtime >= 0 && Number.isFinite(value.size) && value.size >= 0;
}
function boundedText(value: string, length: number): string { return value.length > length ? value.slice(0, length) + '…' : value; }
