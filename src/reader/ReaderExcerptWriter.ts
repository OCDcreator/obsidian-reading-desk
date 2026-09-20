import type { PageViewport } from 'pdfjs-dist';
import type { PdfHighlight, TargetType } from '../types/contracts';
import { createId } from '../utils/ids';
import type { AnnotationStore } from '../annotations/AnnotationStore';
import type { TargetService } from '../targets';
import type { PageSurface } from './PageSurface';
import { normalizeClientRect } from './PdfSelectionGeometry';
import { Notice } from 'obsidian';

export interface ExcerptWriteInput {
	text: string;
	type: TargetType;
	color: PdfHighlight['color'];
	frozenRects?: PdfHighlight['rects'];
	surface: PageSurface;
	/** Page used when the selection cannot be anchored to a rendered host. */
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
	syncOutline(targetPath: string): Promise<void>;
	/** Remembers the chosen target path when the type matches the toolbar selection. */
	onTargetResolved(type: TargetType, path: string): void;
}

export interface WrittenExcerpt {
	highlight: PdfHighlight;
}

/** Resolves the page host and viewport that own the current selection. */
export function selectionAnchor(surface: PageSurface, fallbackPage: number): { host: HTMLElement; page: number; viewport: PageViewport | null } | null {
	const host = surface.hostForPage(fallbackPage) ?? null;
	if (!host) return null;
	return { host, page: Number(host.dataset.page ?? fallbackPage), viewport: surface.viewportForPage(Number(host.dataset.page ?? fallbackPage)) };
}

/** Normalizes live selection rects into PDF space, clipped to the anchor page. */
export function selectionRects(range: Range | null, host: HTMLElement, viewport: PageViewport | null, warnCrossPage: boolean): PdfHighlight['rects'] {
	if (!viewport) return [];
	const bounds = host.getBoundingClientRect();
	const clientRects = Array.from(range?.getClientRects() ?? []);
	const own = clientRects.filter(rect => rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2);
	if (warnCrossPage && own.length && clientRects.some(rect => rect.right > bounds.right + 2)) {
		new Notice('选区跨越多个页面时，仅摘录起始页内容。');
	}
	return own.map(rect => normalizeClientRect(rect, bounds, viewport));
}

/** Builds and persists one excerpt highlight plus its target card. */
export async function writeReaderExcerpt(input: ExcerptWriteInput, range: Range | null): Promise<WrittenExcerpt | null> {
	const anchor = selectionAnchor(input.surface, input.fallbackPage);
	if (!anchor) return null;
	const viewport = anchor.viewport ?? input.viewportFallback;
	if (!viewport) return null;
	const rects = input.frozenRects ?? selectionRects(range, anchor.host, viewport, input.continuous);
	if (!rects.length) return null;
	const highlight: PdfHighlight = {
		id: createId('highlight'), pdfPath: input.pdfPath, page: anchor.page - 1, rotation: viewport.rotation, rects, text: input.text,
		color: input.color, chapterPath: input.chapterPathFor(anchor.page - 1), tags: [], createdAt: Date.now(), updatedAt: Date.now()
	};
	const target = input.selectedTargetPath && input.type === input.selectedTarget
		? { type: input.type, path: input.selectedTargetPath }
		: await input.createTarget(input.type);
	if (target.type === 'canvas') await input.syncOutline(target.path);
	const written = await input.targets.writeExcerpt(target, highlight);
	highlight.target = written.target;
	input.onTargetResolved(input.type, target.path);
	await input.annotations.save(highlight);
	return { highlight };
}
