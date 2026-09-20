import type { AnnotationTarget, PdfHighlight } from '../types/contracts';
import { createHighlightLink } from '../reader/ReadingDeskLinks';

export interface TargetCardOptions {
	/** A user-facing card heading. */
	title?: string;
	/** Initial folded/collapsed state for target formats that support it. */
	folded?: boolean;
	/** Overrides the default Reading Desk source URI when a caller has a richer URI. */
	sourceLink?: string;
	/** Overrides the highlight chapter path for this write only. */
	chapterPath?: string[];
}

export interface TargetWriteResult {
	target: AnnotationTarget;
	objectId: string;
	title: string;
	sourceLink: string;
}

export interface TargetBacklink {
	highlightId: string;
	sourceLink: string;
	page: number;
}

export interface TargetCardMetadata {
	schemaVersion: 1;
	kind: 'excerpt' | 'chapter';
	highlightId?: string;
	pdfPath: string;
	page: number;
	title: string;
	sourceLink: string;
	folded: boolean;
	color: PdfHighlight['color'];
	chapterPath?: string[];
}

export function createSourceLink(highlight: PdfHighlight, supplied?: string): string {
	if (supplied) return supplied;
	return createHighlightLink(highlight);
}

export function createCardTitle(highlight: PdfHighlight, supplied?: string): string {
	if (supplied?.trim()) return supplied.trim();
	const oneLine = highlight.text.replace(/\s+/g, ' ').trim();
	return oneLine.length > 72 ? `${oneLine.slice(0, 72)}…` : oneLine || `第 ${highlight.page + 1} 页摘录`;
}

export function excerptMetadata(
	highlight: PdfHighlight,
	title: string,
	sourceLink: string,
	folded: boolean,
	chapterPath = highlight.chapterPath
): TargetCardMetadata {
	return {
		schemaVersion: 1,
		kind: 'excerpt',
		highlightId: highlight.id,
		pdfPath: highlight.pdfPath,
		page: highlight.page,
		title,
		sourceLink,
		folded,
		color: highlight.color,
		chapterPath: chapterPath.length > 0 ? [...chapterPath] : undefined
	};
}
