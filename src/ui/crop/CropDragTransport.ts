import type { NormalizedPdfRect } from '../../types/contracts';
import type { CropTargetKind } from './CropSelectionOverlay';

export const CROP_DRAG_DATA_TYPE = 'application/x-reading-desk-crop+json';
export const CROP_DRAG_TEXT = 'Reading Desk PDF 裁剪';

export interface CropDragPayload {
	version: 1;
	dragToken: string;
	page: number;
	rect: NormalizedPdfRect;
	target: CropTargetKind;
	mimeType?: string;
}

export interface CropDragDataTransfer {
	setData(type: string, value: string): void;
	getData(type: string): string;
	effectAllowed?: string;
}

export interface PreparedCropDrag {
	dragToken: string;
	/** An actual renderer-produced bitmap URL; omitted when one is unavailable. */
	previewUrl?: string;
	mimeType?: string;
}

export function createCropDragPayload(
	dragToken: string,
	page: number,
	rect: NormalizedPdfRect,
	target: CropTargetKind,
	mimeType?: string
): CropDragPayload {
	const payload: CropDragPayload = { version: 1, dragToken, page, rect: { ...rect }, target };
	if (mimeType) payload.mimeType = mimeType;
	return payload;
}

export function writeCropDragPayload(transfer: CropDragDataTransfer, payload: CropDragPayload): void {
	transfer.setData(CROP_DRAG_DATA_TYPE, JSON.stringify(payload));
	transfer.setData('text/plain', CROP_DRAG_TEXT);
	transfer.effectAllowed = 'copy';
}

export function parseCropDragPayload(value: string): CropDragPayload | null {
	try {
		const candidate: unknown = JSON.parse(value);
		return isCropDragPayload(candidate) ? candidate : null;
	} catch (_error) {
		return null;
	}
}

export function readCropDragPayload(transfer: Pick<CropDragDataTransfer, 'getData'> | null | undefined): CropDragPayload | null {
	return transfer ? parseCropDragPayload(transfer.getData(CROP_DRAG_DATA_TYPE)) : null;
}

/**
 * Reader target panels call this from their drop handler. A drop only commits a
 * token which the host previously prepared from a real rendered crop bitmap.
 */
export async function commitCropDrop(
	transfer: Pick<CropDragDataTransfer, 'getData'> | null | undefined,
	targetPath: string | undefined,
	commitPreparedCrop: (dragToken: string, targetPath?: string) => Promise<void> | void
): Promise<boolean> {
	const payload = readCropDragPayload(transfer);
	if (!payload || payload.target !== 'canvas') {
		return false;
	}
	await commitPreparedCrop(payload.dragToken, targetPath);
	return true;
}

/** A Reader target panel can use this exact drop handler without parsing twice. */
export async function handleCropDrop(
	event: { dataTransfer: Pick<CropDragDataTransfer, 'getData'> | null; preventDefault(): void },
	targetPath: string | undefined,
	commitPreparedCrop: (dragToken: string, targetPath?: string) => Promise<void> | void
): Promise<boolean> {
	const payload = readCropDragPayload(event.dataTransfer);
	if (!payload || payload.target !== 'canvas') {
		return false;
	}
	event.preventDefault();
	await commitPreparedCrop(payload.dragToken, targetPath);
	return true;
}

export async function cancelPreparedCrop(
	dragToken: string | undefined,
	discard: ((dragToken: string) => Promise<void> | void) | undefined
): Promise<void> {
	if (dragToken && discard) await discard(dragToken);
}

export function isCropDragPayload(value: unknown): value is CropDragPayload {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<CropDragPayload>;
	return candidate.version === 1
		&& typeof candidate.dragToken === 'string'
		&& candidate.dragToken.length > 0
		&& Number.isInteger(candidate.page)
		&& (candidate.page ?? -1) >= 0
		&& (candidate.target === 'canvas' || candidate.target === 'image')
		&& isNormalizedRect(candidate.rect)
		&& (candidate.mimeType === undefined || typeof candidate.mimeType === 'string');
}

function isNormalizedRect(rect: unknown): rect is NormalizedPdfRect {
	if (!rect || typeof rect !== 'object') {
		return false;
	}
	const candidate = rect as Partial<NormalizedPdfRect>;
	return isUnitNumber(candidate.x)
		&& isUnitNumber(candidate.y)
		&& isUnitNumber(candidate.width)
		&& isUnitNumber(candidate.height)
		&& candidate.width > 0
		&& candidate.height > 0
		&& candidate.x + candidate.width <= 1
		&& candidate.y + candidate.height <= 1;
}

function isUnitNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
