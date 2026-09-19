import { describe, expect, it, vi } from 'vitest';
import type { ObjectStorageSettings } from '../../src/types/contracts';
import {
	buildObjectKey,
	buildObjectUrl,
	ObjectStorageConfigurationError,
	ObjectStorageRequestError,
	ObjectStorageService,
	signCosRequest,
	signOssRequest,
	type ObjectStorageFetch
} from '../../src/storage/ObjectStorageService';

const fixedDate = new Date('2025-01-02T03:04:05.000Z');

const ossSettings: ObjectStorageSettings = {
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

const cosSettings: ObjectStorageSettings = {
	...ossSettings,
	provider: 'cos',
	endpoint: 'cos.ap-shanghai.myqcloud.com',
	region: 'ap-shanghai'
};

describe('ObjectStorageService signatures', () => {
	it('creates the Aliyun OSS V1 canonical signature and virtual-host URL', async () => {
		const request = await signOssRequest(
			ossSettings,
			'PUT',
			'reading-desk/images/a.png',
			'image/png',
			fixedDate
		);

		expect(request.url).toBe('https://research-bucket.oss-cn-hangzhou.aliyuncs.com/reading-desk/images/a.png');
		expect(request.headers).toMatchObject({
			'content-type': 'image/png',
			'x-oss-date': 'Thu, 02 Jan 2025 03:04:05 GMT',
			authorization: 'OSS test-ak:V/CB3XDZPp1FXd35tHrDCb+7er4='
		});
	});

	it('creates the Tencent COS V5 canonical request signature', async () => {
		const request = await signCosRequest(
			cosSettings,
			'PUT',
			'reading-desk/images/a.png',
			'image/png',
			fixedDate
		);

		expect(request.url).toBe('https://research-bucket.cos.ap-shanghai.myqcloud.com/reading-desk/images/a.png');
		expect(request.headers.authorization).toBe(
			'q-sign-algorithm=sha1&q-ak=test-ak&q-sign-time=1735787045;1735787945&q-key-time=1735787045;1735787945&q-header-list=host&q-url-param-list=&q-signature=6f1d10f4451e882d53f594abaad540359389f513'
		);
	});

	it('signs a raw Unicode COS pathname while percent-encoding only the HTTP URL', async () => {
		const request = await signCosRequest(
			cosSettings,
			'PUT',
			'reading-desk/实验 图 & notes.png',
			'image/png',
			fixedDate
		);

		expect(request.url).toBe(
			'https://research-bucket.cos.ap-shanghai.myqcloud.com/reading-desk/%E5%AE%9E%E9%AA%8C%20%E5%9B%BE%20%26%20notes.png'
		);
		expect(request.headers.authorization).toBe(
			'q-sign-algorithm=sha1&q-ak=test-ak&q-sign-time=1735787045;1735787945&q-key-time=1735787045;1735787945&q-header-list=host&q-url-param-list=&q-signature=93c9e27971fb1f2d3cab348d6c66e6780072b580'
		);
	});
});

describe('ObjectStorageService request construction', () => {
	it('normalizes user object keys and URL-encodes only HTTP path segments', () => {
		const key = buildObjectKey(' reading-desk//images/../ ', '../实验 图.png');

		expect(key).toBe('reading-desk/images/实验 图.png');
		expect(buildObjectUrl(ossSettings, key)).toBe(
			'https://research-bucket.oss-cn-hangzhou.aliyuncs.com/reading-desk/images/%E5%AE%9E%E9%AA%8C%20%E5%9B%BE.png'
		);
	});

	it('throws a precise configuration error before making a request without credentials', async () => {
		const fetcher = vi.fn();
		const service = new ObjectStorageService(
			{ ...ossSettings, accessKeyId: '' },
			fetcher as unknown as ObjectStorageFetch
		);

		const error = await service.upload({
			key: 'images/test.png',
			body: new Uint8Array([1]),
			contentType: 'image/png'
		}).catch(reason => reason);

		expect(error).toBeInstanceOf(ObjectStorageConfigurationError);
		expect(error).toMatchObject({
			code: 'missing-access-key-id',
			message: '对象存储缺少 AccessKey ID。'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('propagates a failed storage response instead of claiming an upload succeeded', async () => {
		const fetcher = vi.fn(async () => new Response('forbidden', { status: 403 }));
		const service = new ObjectStorageService(
			ossSettings,
			fetcher as unknown as ObjectStorageFetch,
			{ now: () => fixedDate }
		);

		const error = await service.upload({
			key: 'images/test.png',
			body: new Uint8Array([1]),
			contentType: 'image/png'
		}).catch(reason => reason);

		expect(error).toBeInstanceOf(ObjectStorageRequestError);
		expect(error).toMatchObject({ operation: 'upload', status: 403 });
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('uses a read-only signed bucket request for connection testing', async () => {
		const fetcher = vi.fn(async () => new Response('', { status: 200 }));
		const service = new ObjectStorageService(
			cosSettings,
			fetcher as unknown as ObjectStorageFetch,
			{ now: () => fixedDate }
		);

		await expect(service.testConnection()).resolves.toMatchObject({
			provider: 'cos',
			status: 200
		});
		expect(fetcher.mock.calls[0]?.[0]).toBe(
			'https://research-bucket.cos.ap-shanghai.myqcloud.com/?max-keys=1'
		);
		expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
		expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
			headers: {
				authorization: 'q-sign-algorithm=sha1&q-ak=test-ak&q-sign-time=1735787045;1735787945&q-key-time=1735787045;1735787945&q-header-list=host&q-url-param-list=max-keys&q-signature=7a4c9ffa809d0295f5e7d9ecbf5d759a7a811675'
			}
		});
	});
});
