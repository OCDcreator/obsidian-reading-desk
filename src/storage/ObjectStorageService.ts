import type { ObjectStorageSettings } from '../types/contracts';

export type StorageProvider = ObjectStorageSettings['provider'];

export interface ObjectStorageFetch {
	(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface Clock {
	now(): Date;
}

export interface UploadedObject {
	key: string;
	url: string;
	status: number;
}

export interface StorageConnectionResult {
	provider: StorageProvider;
	endpoint: string;
	status: number;
}

export interface ObjectUploadInput {
	key: string;
	body: Blob | ArrayBuffer | Uint8Array;
	contentType: string;
}

export interface SignedRequest {
	url: string;
	headers: Record<string, string>;
}

export type ObjectStorageConfigurationCode =
	| 'storage-disabled'
	| 'image-host-disabled'
	| 'missing-endpoint'
	| 'missing-region'
	| 'missing-bucket'
	| 'missing-access-key-id'
	| 'missing-secret-access-key';

const textEncoder = new TextEncoder();

export class ObjectStorageConfigurationError extends Error {
	readonly code: ObjectStorageConfigurationCode;

	constructor(code: ObjectStorageConfigurationCode, message: string) {
		super(message);
		this.name = 'ObjectStorageConfigurationError';
		this.code = code;
	}
}

export class ObjectStorageRequestError extends Error {
	readonly status: number;
	readonly operation: 'upload' | 'connection';

	constructor(operation: 'upload' | 'connection', status: number, message: string) {
		super(message);
		this.name = 'ObjectStorageRequestError';
		this.operation = operation;
		this.status = status;
	}
}

/**
 * Builds a stable object key without accepting path traversal from a filename.
 * The returned key is not URL encoded; signing receives the provider's expected
 * canonical object path while request construction encodes every key segment.
 */
export function buildObjectKey(prefix: string, filename: string): string {
	const normalizedPrefix = prefix
		.split('/')
		.map(part => part.trim())
		.filter(part => part.length > 0 && part !== '.' && part !== '..')
		.join('/');
	const safeFilename = filename
		.replace(/\\/g, '/')
		.split('/')
		.pop()
		?.split('')
		.filter(character => character.charCodeAt(0) >= 32)
		.join('')
		.replace(/[<>:"|?*]/g, '-')
		.replace(/^\.+/, '')
		.trim() || 'upload';

	return normalizedPrefix.length > 0 ? `${normalizedPrefix}/${safeFilename}` : safeFilename;
}

/** URL-safe request path, preserving object-key slash delimiters. */
export function encodeObjectKey(key: string): string {
	return key.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function buildObjectUrl(settings: ObjectStorageSettings, key: string): string {
	const endpoint = parseEndpoint(settings.endpoint);
	const pathname = joinUrlPath(endpoint.pathname, encodeObjectKey(key));
	const host = endpoint.hostname.toLowerCase();
	const bucket = settings.bucket.trim();

	if (settings.provider === 'oss') {
		const bucketHost = host.startsWith(`${bucket.toLowerCase()}.`)
			? endpoint.host
			: `${bucket}.${endpoint.host}`;
		return `${endpoint.protocol}//${bucketHost}${pathname}`;
	}

	const bucketHost = host.startsWith(`${bucket.toLowerCase()}.`)
		? endpoint.host
		: `${bucket}.${endpoint.host}`;
	return `${endpoint.protocol}//${bucketHost}${pathname}`;
}

export class ObjectStorageService {
	private readonly fetcher: ObjectStorageFetch;
	private readonly clock: Clock;

	constructor(
		private readonly settings: ObjectStorageSettings,
		fetcher: ObjectStorageFetch = fetch,
		clock: Clock = { now: () => new Date() }
	) {
		this.fetcher = fetcher;
		this.clock = clock;
	}

	async upload(input: ObjectUploadInput): Promise<UploadedObject> {
		validateStorageSettings(this.settings);
		const key = normalizeObjectKey(input.key);
		const signedRequest = await this.signObjectRequest('PUT', key, input.contentType);
		const response = await this.fetcher(signedRequest.url, {
			method: 'PUT',
			headers: signedRequest.headers,
			body: toBlob(input.body, input.contentType)
		});

		if (!response.ok) {
			throw new ObjectStorageRequestError(
				'upload',
				response.status,
				`对象存储上传失败（HTTP ${response.status}）。`
			);
		}

		return {
			key,
			url: buildObjectUrl(this.settings, key),
			status: response.status
		};
	}

	async testConnection(): Promise<StorageConnectionResult> {
		validateStorageSettings(this.settings);
		const signedRequest = await this.signBucketRequest();
		const response = await this.fetcher(signedRequest.url, {
			method: 'GET',
			headers: signedRequest.headers
		});

		if (!response.ok) {
			throw new ObjectStorageRequestError(
				'connection',
				response.status,
				`对象存储连接测试失败（HTTP ${response.status}）。`
			);
		}

		return {
			provider: this.settings.provider,
			endpoint: buildBucketUrl(this.settings),
			status: response.status
		};
	}

	async signObjectRequest(method: string, key: string, contentType: string): Promise<SignedRequest> {
		validateStorageSettings(this.settings);
		if (this.settings.provider === 'oss') {
			return signOssRequest(this.settings, method, key, contentType, this.clock.now());
		}
		return signCosRequest(this.settings, method, key, contentType, this.clock.now());
	}

	private async signBucketRequest(): Promise<SignedRequest> {
		if (this.settings.provider === 'oss') {
			return signOssBucketRequest(this.settings, this.clock.now());
		}
		return signCosBucketRequest(this.settings, this.clock.now());
	}
}

export function validateStorageSettings(
	settings: ObjectStorageSettings,
	options: { requireImageHost?: boolean } = {}
): void {
	if (!settings.enabled) {
		throw configurationError('storage-disabled');
	}
	if (options.requireImageHost && !settings.imageHostEnabled) {
		throw configurationError('image-host-disabled');
	}
	if (!settings.endpoint.trim()) {
		throw configurationError('missing-endpoint');
	}
	if (!settings.bucket.trim()) {
		throw configurationError('missing-bucket');
	}
	if (!settings.accessKeyId.trim()) {
		throw configurationError('missing-access-key-id');
	}
	if (!settings.secretAccessKey.trim()) {
		throw configurationError('missing-secret-access-key');
	}
	if (settings.provider === 'cos' && !settings.region.trim()) {
		throw configurationError('missing-region');
	}
}

export async function signOssRequest(
	settings: ObjectStorageSettings,
	method: string,
	key: string,
	contentType: string,
	now: Date
): Promise<SignedRequest> {
	const date = now.toUTCString();
	const canonicalHeaders = `x-oss-date:${date}\n`;
	const canonicalResource = `/${settings.bucket.trim()}/${key}`;
	const stringToSign = `${method.toUpperCase()}\n\n${contentType}\n\n${canonicalHeaders}${canonicalResource}`;
	const signature = await hmacSha1Base64(settings.secretAccessKey, stringToSign);

	return {
		url: buildObjectUrl(settings, key),
		headers: {
			'content-type': contentType,
			'x-oss-date': date,
			authorization: `OSS ${settings.accessKeyId}:${signature}`
		}
	};
}

export async function signCosRequest(
	settings: ObjectStorageSettings,
	method: string,
	key: string,
	contentType: string,
	now: Date
): Promise<SignedRequest> {
	return signCosRequestWithQuery(settings, method, key, contentType, now, {});
}

async function signCosRequestWithQuery(
	settings: ObjectStorageSettings,
	method: string,
	key: string,
	contentType: string,
	now: Date,
	query: Record<string, string>
): Promise<SignedRequest> {
	const url = buildObjectUrl(settings, key);
	const host = new URL(url).host;
	const keyTime = buildCosKeyTime(now);
	const canonicalQuery = canonicalizeCosQuery(query);
	const queryNames = Object.keys(query).sort().join(';');
	// COS V5 signs the raw normalized pathname. URL serialization below is
	// separately encoded for fetch, so Unicode and spaces must not leak into
	// the canonical signature as percent escapes.
	const canonicalRequest = `${method.toLowerCase()}\n/${key}\n${canonicalQuery}\nhost=${encodeCosComponent(host)}\n`;
	const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(canonicalRequest)}\n`;
	const signingKey = await hmacSha1Hex(settings.secretAccessKey, keyTime);
	const signature = await hmacSha1Hex(signingKey, stringToSign);
	const authorization = [
		'q-sign-algorithm=sha1',
		`q-ak=${encodeURIComponent(settings.accessKeyId)}`,
		`q-sign-time=${keyTime}`,
		`q-key-time=${keyTime}`,
		'q-header-list=host',
		`q-url-param-list=${queryNames}`,
		`q-signature=${signature}`
	].join('&');

	return {
		url: canonicalQuery.length > 0 ? `${url}?${canonicalQuery}` : url,
		headers: {
			'content-type': contentType,
			authorization
		}
	};
}

async function signOssBucketRequest(settings: ObjectStorageSettings, now: Date): Promise<SignedRequest> {
	const date = now.toUTCString();
	const canonicalResource = `/${settings.bucket.trim()}/`;
	const stringToSign = `GET\n\n\n\n${`x-oss-date:${date}\n`}${canonicalResource}`;
	const signature = await hmacSha1Base64(settings.secretAccessKey, stringToSign);

	return {
		url: `${buildBucketUrl(settings)}?max-keys=1`,
		headers: {
			'x-oss-date': date,
			authorization: `OSS ${settings.accessKeyId}:${signature}`
		}
	};
}

async function signCosBucketRequest(settings: ObjectStorageSettings, now: Date): Promise<SignedRequest> {
	return signCosRequestWithQuery(settings, 'GET', '', '', now, { 'max-keys': '1' });
}

function buildBucketUrl(settings: ObjectStorageSettings): string {
	return buildObjectUrl(settings, '').replace(/\/$/, '');
}

function parseEndpoint(value: string): URL {
	const endpoint = value.trim();
	try {
		return new URL(endpoint.includes('://') ? endpoint : `https://${endpoint}`);
	} catch (_error) {
		throw new ObjectStorageConfigurationError('missing-endpoint', '对象存储 Endpoint 格式无效。');
	}
}

function joinUrlPath(basePath: string, encodedKey: string): string {
	const normalizedBase = basePath.replace(/\/+$/, '');
	return `${normalizedBase}/${encodedKey}`.replace(/^$/, '/');
}

function normalizeObjectKey(value: string): string {
	const parts = value.replace(/\\/g, '/').split('/');
	const filename = parts.pop() ?? '';
	return buildObjectKey(parts.join('/'), filename);
}

function canonicalizeCosQuery(query: Record<string, string>): string {
	return Object.entries(query)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${encodeCosComponent(key)}=${encodeCosComponent(value)}`)
		.join('&');
}

function encodeCosComponent(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function configurationError(code: ObjectStorageConfigurationCode): ObjectStorageConfigurationError {
	const messages: Record<ObjectStorageConfigurationCode, string> = {
		'storage-disabled': '对象存储未启用。',
		'image-host-disabled': 'Markdown 图床未启用。',
		'missing-endpoint': '对象存储缺少 Endpoint。',
		'missing-region': '腾讯 COS 缺少 Region。',
		'missing-bucket': '对象存储缺少 Bucket。',
		'missing-access-key-id': '对象存储缺少 AccessKey ID。',
		'missing-secret-access-key': '对象存储缺少 SecretAccessKey。'
	};
	return new ObjectStorageConfigurationError(code, messages[code]);
}

function toBlob(body: Blob | ArrayBuffer | Uint8Array, contentType: string): Blob {
	if (body instanceof Blob) {
		return body;
	}
	return new Blob([body], { type: contentType });
}

function buildCosKeyTime(now: Date): string {
	const start = Math.floor(now.getTime() / 1000);
	return `${start};${start + 900}`;
}

async function sha1Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-1', textEncoder.encode(value));
	return bytesToHex(new Uint8Array(digest));
}

async function hmacSha1Base64(secret: string, value: string): Promise<string> {
	return bytesToBase64(await hmacSha1Bytes(secret, value));
}

async function hmacSha1Hex(secret: string | Uint8Array, value: string): Promise<string> {
	return bytesToHex(await hmacSha1Bytes(secret, value));
}

async function hmacSha1Bytes(secret: string | Uint8Array, value: string): Promise<Uint8Array> {
	const material = typeof secret === 'string' ? textEncoder.encode(secret) : secret;
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		material,
		{ name: 'HMAC', hash: 'SHA-1' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(value));
	return new Uint8Array(signature);
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes).map(value => value.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const value of bytes) {
		binary += String.fromCharCode(value);
	}
	return btoa(binary);
}
