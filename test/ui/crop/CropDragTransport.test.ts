import { describe, expect, it, vi } from 'vitest';
import {
	commitCropDrop,
	cancelPreparedCrop,
	createCropDragPayload,
	CROP_DRAG_DATA_TYPE,
	CROP_DRAG_TEXT,
	handleCropDrop,
	isCropDragPayload,
	parseCropDragPayload,
	writeCropDragPayload,
	type CropDragDataTransfer
} from '../../../src/ui/crop/CropDragTransport';

describe('CropDragTransport', () => {
	it('writes a typed crop payload and copy-only drag data', () => {
		const transfer = fakeTransfer();
		const payload = createCropDragPayload(
			'crop-token-1',
			4,
			{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
			'canvas',
			'image/png'
		);

		writeCropDragPayload(transfer, payload);

		expect(transfer.effectAllowed).toBe('copy');
		expect(transfer.getData('text/plain')).toBe(CROP_DRAG_TEXT);
		expect(parseCropDragPayload(transfer.getData(CROP_DRAG_DATA_TYPE))).toEqual(payload);
	});

	it('rejects malformed or out-of-page drag data before a target can commit it', () => {
		expect(parseCropDragPayload('{bad json')).toBeNull();
		expect(isCropDragPayload({
			version: 1,
			dragToken: 'token',
			page: 0,
			target: 'canvas',
			rect: { x: 0.8, y: 0, width: 0.3, height: 0.2 }
		})).toBe(false);
	});

	it('routes a Canvas drop to the prepared crop commit with an existing Canvas path', async () => {
		const transfer = fakeTransfer();
		writeCropDragPayload(transfer, createCropDragPayload(
			'prepared-crop', 3, { x: 0, y: 0, width: 0.5, height: 0.5 }, 'canvas'
		));
		const commit = vi.fn(async () => undefined);

		await expect(commitCropDrop(transfer, 'research/existing.canvas', commit)).resolves.toBe(true);
		expect(commit).toHaveBeenCalledWith('prepared-crop', 'research/existing.canvas');
	});

	it('handles a real target drop event only for the Reading Desk crop MIME type', async () => {
		const transfer = fakeTransfer();
		writeCropDragPayload(transfer, createCropDragPayload(
			'handled-crop', 2, { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, 'canvas'
		));
		const preventDefault = vi.fn();
		const commit = vi.fn(async () => undefined);

		await expect(handleCropDrop({ dataTransfer: transfer, preventDefault }, 'research/existing.canvas', commit)).resolves.toBe(true);
		expect(preventDefault).toHaveBeenCalledOnce();
		expect(commit).toHaveBeenCalledWith('handled-crop', 'research/existing.canvas');
	});

	it('does not commit image targets or cancellation-like empty transfers', async () => {
		const image = fakeTransfer();
		writeCropDragPayload(image, createCropDragPayload(
			'image-crop', 0, { x: 0, y: 0, width: 0.4, height: 0.4 }, 'image'
		));
		const commit = vi.fn(async () => undefined);

		await expect(commitCropDrop(image, undefined, commit)).resolves.toBe(false);
		await expect(commitCropDrop(fakeTransfer(), undefined, commit)).resolves.toBe(false);
		expect(commit).not.toHaveBeenCalled();
	});

	it('discards a prepared crop token on cancellation without committing it', async () => {
		const discard = vi.fn(async () => undefined);

		await cancelPreparedCrop('cancelled-crop', discard);
		await cancelPreparedCrop(undefined, discard);

		expect(discard).toHaveBeenCalledOnce();
		expect(discard).toHaveBeenCalledWith('cancelled-crop');
	});
});

function fakeTransfer(): CropDragDataTransfer & { effectAllowed: string } {
	const data = new Map<string, string>();
	return {
		effectAllowed: '',
		setData: (type, value) => { data.set(type, value); },
		getData: type => data.get(type) ?? ''
	};
}
