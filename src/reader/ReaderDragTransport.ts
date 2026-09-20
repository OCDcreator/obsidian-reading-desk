import type { PdfHighlight } from '../types/contracts';

/** Parses the private normalized-rect payload used for selection drag/drop. */
export function parseDraggedHighlightRects(value: string): PdfHighlight['rects'] | null {
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every(isNormalizedRect) ? parsed : null;
	} catch (_error) {
		return null;
	}
}

function isNormalizedRect(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const rect = value as Record<string, unknown>;
	const { x, y, width, height } = rect;
	if (![x, y, width, height].every(part => typeof part === 'number' && Number.isFinite(part))) return false;
	return (x as number) >= 0 && (y as number) >= 0
		&& (width as number) > 0 && (height as number) > 0
		&& (x as number) + (width as number) <= 1
		&& (y as number) + (height as number) <= 1;
}
