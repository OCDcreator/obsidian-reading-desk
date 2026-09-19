import { describe, expect, it, vi } from 'vitest';
import type { ObjectStorageSettings } from '../../src/types/contracts';
import { MarkdownImagePasteService } from '../../src/storage/MarkdownImagePasteService';
import { ObjectStorageService, type ObjectStorageFetch } from '../../src/storage/ObjectStorageService';

const settings: ObjectStorageSettings = {
	enabled: true,
	imageHostEnabled: true,
	provider: 'oss',
	endpoint: 'oss-cn-hangzhou.aliyuncs.com',
	region: 'cn-hangzhou',
	bucket: 'research-bucket',
	prefix: 'reading-desk',
	accessKeyId: 'test-ak',
	secretAccessKey: 'test-secret'
};

describe('MarkdownImagePasteService', () => {
	it('uploads a real image Blob and returns external Markdown without owning an editor', async () => {
		const fetcher = vi.fn(async () => new Response('', { status: 200 }));
		const storage = new ObjectStorageService(
			settings,
			fetcher as unknown as ObjectStorageFetch,
			{ now: () => new Date('2025-01-02T03:04:05.000Z') }
		);
		const service = new MarkdownImagePasteService(
			settings,
			storage,
			{ now: () => new Date('2025-01-02T03:04:05.000Z') },
			() => 'fixture'
		);

		const result = await service.uploadClipboardImage(new Blob(['PNG'], { type: 'image/png' }));

		expect(fetcher).toHaveBeenCalledOnce();
		expect(result).toEqual({
			key: 'reading-desk/images/2025/01/02/clipboard-fixture.png',
			url: 'https://research-bucket.oss-cn-hangzhou.aliyuncs.com/reading-desk/images/2025/01/02/clipboard-fixture.png',
			status: 200,
			markdown: '![clipboard-fixture.png](<https://research-bucket.oss-cn-hangzhou.aliyuncs.com/reading-desk/images/2025/01/02/clipboard-fixture.png>)'
		});
	});

	it('finds the first image binary among clipboard items', async () => {
		const uploadClipboardImage = vi.fn(async () => ({
			key: 'images/paste.jpg',
			url: 'https://example.test/images/paste.jpg',
			status: 200,
			markdown: '![paste](<https://example.test/images/paste.jpg>)'
		}));
		const service = new MarkdownImagePasteService(settings, {
			upload: uploadClipboardImage
		} as unknown as ObjectStorageService);

		await expect(service.uploadFirstClipboardImage([
			{ type: 'text/plain', getAsFile: () => null },
			{ type: 'image/jpeg', getAsFile: () => new Blob(['JPEG'], { type: 'image/jpeg' }) }
		])).resolves.toMatchObject({ key: 'images/paste.jpg' });

		expect(uploadClipboardImage).toHaveBeenCalledWith(expect.objectContaining({
			contentType: 'image/jpeg',
			key: expect.stringMatching(/\.jpg$/)
		}));
	});

	it('rejects clipboard content that is not an image', async () => {
		const storage = { upload: vi.fn() } as unknown as ObjectStorageService;
		const service = new MarkdownImagePasteService(settings, storage);

		await expect(service.uploadClipboardImage(new Uint8Array([1]), 'application/octet-stream'))
			.rejects.toThrow('剪贴板内容不是图片，无法上传到图床。');
	});
});
