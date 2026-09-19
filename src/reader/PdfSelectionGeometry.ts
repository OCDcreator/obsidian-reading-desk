import type { NormalizedPdfRect } from '../types/contracts';

export interface PdfViewportLike {
	width: number;
	height: number;
	viewBox: number[];
	convertToPdfPoint(x: number, y: number): number[];
	convertToViewportPoint(x: number, y: number): number[];
}

export function normalizeClientRect(rect: DOMRect, pageBounds: DOMRect, viewport: PdfViewportLike): NormalizedPdfRect {
	const start = viewport.convertToPdfPoint(rect.left - pageBounds.left, rect.top - pageBounds.top);
	const end = viewport.convertToPdfPoint(rect.right - pageBounds.left, rect.bottom - pageBounds.top);
	const [minX, minY, maxX, maxY] = viewport.viewBox;
	const pageWidth = maxX - minX;
	const pageHeight = maxY - minY;
	const left = (Math.min(start[0], end[0]) - minX) / pageWidth;
	const right = (Math.max(start[0], end[0]) - minX) / pageWidth;
	const top = (maxY - Math.max(start[1], end[1])) / pageHeight;
	const bottom = (maxY - Math.min(start[1], end[1])) / pageHeight;
	return clampRect({ x: left, y: top, width: right - left, height: bottom - top });
}

export function denormalizeRect(rect: NormalizedPdfRect, viewport: PdfViewportLike): { left: number; top: number; width: number; height: number } {
	const [minX, minY, maxX, maxY] = viewport.viewBox;
	const pageWidth = maxX - minX;
	const pageHeight = maxY - minY;
	const start = viewport.convertToViewportPoint(minX + rect.x * pageWidth, maxY - rect.y * pageHeight);
	const end = viewport.convertToViewportPoint(minX + (rect.x + rect.width) * pageWidth, maxY - (rect.y + rect.height) * pageHeight);
	return {
		left: Math.min(start[0], end[0]),
		top: Math.min(start[1], end[1]),
		width: Math.abs(end[0] - start[0]),
		height: Math.abs(end[1] - start[1])
	};
}

function clampRect(rect: NormalizedPdfRect): NormalizedPdfRect {
	const x = Math.max(0, Math.min(1, rect.x));
	const y = Math.max(0, Math.min(1, rect.y));
	return {
		x,
		y,
		width: Math.max(0, Math.min(1 - x, rect.width)),
		height: Math.max(0, Math.min(1 - y, rect.height))
	};
}
