import type { NormalizedPdfRect } from '../../types/contracts';

export interface CropPageBounds {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface CropPoint {
	x: number;
	y: number;
}

const MAX_NORMALIZED_VALUE = 1;

/**
 * Maps a pointer location in a rendered PDF page to the durable normalized
 * page space. This intentionally does not know PDF pixels or crop rendering.
 */
export function normalizeCropPoint(point: CropPoint, bounds: CropPageBounds): CropPoint {
	if (!hasPositivePageSize(bounds)) {
		return { x: 0, y: 0 };
	}
	return {
		x: clamp((point.x - bounds.left) / bounds.width),
		y: clamp((point.y - bounds.top) / bounds.height)
	};
}

export function normalizeCropRect(
	start: CropPoint,
	end: CropPoint,
	bounds: CropPageBounds
): NormalizedPdfRect {
	const normalizedStart = normalizeCropPoint(start, bounds);
	const normalizedEnd = normalizeCropPoint(end, bounds);
	const x = Math.min(normalizedStart.x, normalizedEnd.x);
	const y = Math.min(normalizedStart.y, normalizedEnd.y);
	return {
		x,
		y,
		width: Math.max(0, Math.abs(normalizedEnd.x - normalizedStart.x)),
		height: Math.max(0, Math.abs(normalizedEnd.y - normalizedStart.y))
	};
}

export function denormalizeCropRect(
	rect: NormalizedPdfRect,
	bounds: CropPageBounds
): { left: number; top: number; width: number; height: number } {
	const normalized = clampCropRect(rect);
	return {
		left: bounds.left + normalized.x * bounds.width,
		top: bounds.top + normalized.y * bounds.height,
		width: normalized.width * bounds.width,
		height: normalized.height * bounds.height
	};
}

export function isCropRectLargeEnough(
	rect: NormalizedPdfRect,
	bounds: CropPageBounds,
	minimumPixels = 8
): boolean {
	if (!hasPositivePageSize(bounds) || minimumPixels <= 0) {
		return hasArea(rect);
	}
	return rect.width * bounds.width >= minimumPixels && rect.height * bounds.height >= minimumPixels;
}

export function clampCropRect(rect: NormalizedPdfRect): NormalizedPdfRect {
	const x = clamp(rect.x);
	const y = clamp(rect.y);
	return {
		x,
		y,
		width: Math.max(0, Math.min(MAX_NORMALIZED_VALUE - x, rect.width)),
		height: Math.max(0, Math.min(MAX_NORMALIZED_VALUE - y, rect.height))
	};
}

function hasPositivePageSize(bounds: CropPageBounds): boolean {
	return bounds.width > 0 && bounds.height > 0;
}

function hasArea(rect: NormalizedPdfRect): boolean {
	return rect.width > 0 && rect.height > 0;
}

function clamp(value: number): number {
	return Math.max(0, Math.min(MAX_NORMALIZED_VALUE, value));
}
