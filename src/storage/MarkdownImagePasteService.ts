import type { ObjectStorageSettings } from '../types/contracts';
import {
	buildObjectKey,
	ObjectStorageService,
	type UploadedObject,
	validateStorageSettings
} from './ObjectStorageService';

export interface ClipboardImageItem {
	type: string;
	getAsFile(): Blob | null;
}

export interface ImagePasteResult extends UploadedObject {
	markdown: string;
}

export interface IdentifierGenerator {
	(): string;
}

export interface PasteClock {
	now(): Date;
}

export class ClipboardImageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ClipboardImageError';
	}
}

/**
 * Converts an actual clipboard image blob into an uploaded external Markdown
 * image. It deliberately has no editor dependency; the caller owns insertion.
 */
export class MarkdownImagePasteService {
	private readonly clock: PasteClock;
	private readonly identifier: IdentifierGenerator;

	constructor(
		private readonly settings: ObjectStorageSettings,
		private readonly storage: ObjectStorageService,
		clock: PasteClock = { now: () => new Date() },
		identifier: IdentifierGenerator = createIdentifier
	) {
		this.clock = clock;
		this.identifier = identifier;
	}

	async uploadClipboardImage(image: Blob | ArrayBuffer | Uint8Array, mimeType?: string): Promise<ImagePasteResult> {
		validateStorageSettings(this.settings, { requireImageHost: true });
		const resolvedType = getImageMimeType(image, mimeType);
		const key = this.createImageKey(resolvedType);
		const uploaded = await this.storage.upload({
			key,
			body: image,
			contentType: resolvedType
		});

		return {
			...uploaded,
			markdown: `![${escapeMarkdownAlt(key.split('/').pop() ?? 'image')}](<${uploaded.url}>)`
		};
	}

	async uploadFirstClipboardImage(items: Iterable<ClipboardImageItem>): Promise<ImagePasteResult> {
		for (const item of items) {
			if (!item.type.toLowerCase().startsWith('image/')) {
				continue;
			}
			const image = item.getAsFile();
			if (image) {
				return this.uploadClipboardImage(image, item.type);
			}
		}
		throw new ClipboardImageError('剪贴板中没有可上传的图片。');
	}

	private createImageKey(mimeType: string): string {
		const now = this.clock.now();
		const datePath = [
			now.getUTCFullYear(),
			String(now.getUTCMonth() + 1).padStart(2, '0'),
			String(now.getUTCDate()).padStart(2, '0')
		].join('/');
		return buildObjectKey(
			`${this.settings.prefix}/images/${datePath}`,
			`clipboard-${this.identifier()}.${extensionForMimeType(mimeType)}`
		);
	}
}

function getImageMimeType(image: Blob | ArrayBuffer | Uint8Array, supplied?: string): string {
	const type = (supplied || (image instanceof Blob ? image.type : '')).toLowerCase().split(';')[0].trim();
	if (!type.startsWith('image/')) {
		throw new ClipboardImageError('剪贴板内容不是图片，无法上传到图床。');
	}
	return type;
}

function extensionForMimeType(mimeType: string): string {
	const extensions: Record<string, string> = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/gif': 'gif',
		'image/webp': 'webp',
		'image/svg+xml': 'svg',
		'image/bmp': 'bmp',
		'image/tiff': 'tiff'
	};
	return extensions[mimeType] ?? 'img';
}

function escapeMarkdownAlt(value: string): string {
	return value.split('\\').join('\\\\').split('[').join('\\[').split(']').join('\\]');
}

function createIdentifier(): string {
	if (typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
