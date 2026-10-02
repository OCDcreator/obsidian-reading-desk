import type { PageViewport } from 'pdfjs-dist';
import type { PdfHighlight, TargetType, SourceFingerprint } from '../types/contracts';
import { createId } from '../utils/ids';
import type { AnnotationStore } from '../annotations/AnnotationStore';
import type { TargetService } from '../targets';
import type { PageSurface } from './PageSurface';
import { normalizeClientRect } from './PdfSelectionGeometry';

export interface FrozenExcerptSelection {
	sourceFingerprint?: SourceFingerprint;
	pdfPath: string;
	/** One-based surface page. */
	page: number;
	rotation: number;
	rects: PdfHighlight['rects'];
	text: string;
}
export interface ExcerptWriteInput {
	sourceFingerprint?: SourceFingerprint;
	text: string;
	type: TargetType;
	color: PdfHighlight['color'];
	frozenSelection?: FrozenExcerptSelection;
	frozenRects?: PdfHighlight['rects'];
	surface: PageSurface;
	fallbackPage: number;
	pdfPath: string;
	viewportFallback: PageViewport | null;
	continuous: boolean;
	createTarget(type: TargetType): Promise<{ type: TargetType; path: string }>;
	selectedTarget: TargetType;
	selectedTargetPath: string;
	targets: TargetService;
	annotations: AnnotationStore;
	chapterPathFor(page: number): string[];
	pageLabelFor?(page: number): string;
	syncOutline(targetPath: string): Promise<void>;
	onTargetResolved(type: TargetType, path: string): void;
}
export interface WrittenExcerpt { highlight: PdfHighlight; }
export class ReaderSelectionError extends Error { }

function rangeHost(node: Node): HTMLElement | null {
	const element = node.nodeType === 1 ? node as Element : node.parentElement;
	return element?.closest<HTMLElement>('.rd-pdf-page-host') ?? null;
}
/** Range ownership, never the most visible page or last renderer viewport. */
export function selectionAnchor(surface: PageSurface, _fallbackPage: number, range: Range | null = null): { host: HTMLElement; page: number; viewport: PageViewport | null } | null {
	if (!range || range.collapsed) return null;
	const host = rangeHost(range.startContainer);
	const end = rangeHost(range.endContainer);
	if (!host || !end || host !== end) throw new ReaderSelectionError('暂不支持跨页摘录，请仅选择一页内的原文。');
	const page = Number(host.dataset.page);
	if (!Number.isInteger(page) || surface.hostForPage(page) !== host) throw new ReaderSelectionError('选区不属于当前 PDF。请重新选择原文。');
	return { host, page, viewport: surface.viewportForPage(page) };
}
/** Reject every overflow edge so full text is never paired with partial geometry. */
export function selectionRects(range: Range | null, host: HTMLElement, viewport: PageViewport | null, _warnCrossPage = true): PdfHighlight['rects'] {
	if (!viewport || !range) return [];
	if (rangeHost(range.startContainer) !== host || rangeHost(range.endContainer) !== host) throw new ReaderSelectionError('暂不支持跨页摘录，请仅选择一页内的原文。');
	const bounds = host.getBoundingClientRect();
	if (bounds.width <= 0 || bounds.height <= 0) return [];
	const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
	if (rects.some(rect => rect.left < bounds.left - 2 || rect.right > bounds.right + 2 || rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2)) {
		throw new ReaderSelectionError('选区超出当前页边界，请重新选择单页原文。');
	}
	const scaleX = viewport.width / bounds.width;
	const scaleY = viewport.height / bounds.height;
	return rects.map(rect => normalizeClientRect({
		left: Math.max(0, rect.left - bounds.left) * scaleX,
		top: Math.max(0, rect.top - bounds.top) * scaleY,
		right: Math.min(bounds.width, rect.right - bounds.left) * scaleX,
		bottom: Math.min(bounds.height, rect.bottom - bounds.top) * scaleY
	} as DOMRect, { left: 0, top: 0 } as DOMRect, viewport)).filter(rect => rect.width > 0 && rect.height > 0);
}
export function freezeExcerptSelection(surface: PageSurface, range: Range | null, pdfPath: string, sourceFingerprint?: SourceFingerprint): FrozenExcerptSelection | null {
	const anchor = selectionAnchor(surface, 0, range);
	if (!anchor?.viewport || !range) return null;
	const rects = selectionRects(range, anchor.host, anchor.viewport);
	if (!rects.length) return null;
	return { pdfPath, sourceFingerprint: sourceFingerprint ? { ...sourceFingerprint } : undefined, page: anchor.page, rotation: anchor.viewport.rotation, rects, text: range.toString().trim() };
}
/** Validates before any target mutation and delegates persistence to its workflow. */
export async function writeReaderExcerpt(input: ExcerptWriteInput, range: Range | null): Promise<WrittenExcerpt | null> {
	const frozen = input.frozenSelection ?? freezeExcerptSelection(input.surface, range, input.pdfPath, input.sourceFingerprint);
	if (!frozen || !frozen.text || !frozen.rects.length) return null;
	if (frozen.pdfPath !== input.pdfPath) throw new ReaderSelectionError('选区来自另一份 PDF，请重新选择。');
	const highlight: PdfHighlight = {
		id: createId('highlight'), pdfPath: input.pdfPath, page: frozen.page - 1, rotation: frozen.rotation,
		rects: frozen.rects.map(rect => ({ ...rect })), text: frozen.text,
		sourceFingerprint: frozen.sourceFingerprint ? { ...frozen.sourceFingerprint } : undefined, pageLabel: input.pageLabelFor?.(frozen.page), color: input.color, chapterPath: input.chapterPathFor(frozen.page - 1), tags: [], createdAt: Date.now(), updatedAt: Date.now()
	};
	const target = input.selectedTargetPath && input.type === input.selectedTarget
		? { type: input.type, path: input.selectedTargetPath } : await input.createTarget(input.type);
	if (target.type === 'canvas') await input.syncOutline(target.path);
	const written = await input.targets.writeAndSaveExcerpt(target, highlight, input.annotations);
	highlight.target = written.target;
	input.onTargetResolved(input.type, target.path);
	return { highlight };
}
