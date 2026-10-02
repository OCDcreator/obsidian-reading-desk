import type { TFile } from 'obsidian';
import { ClipboardImageError } from '../storage/MarkdownImagePasteService';
import { ObjectStorageConfigurationError, ObjectStorageRequestError } from '../storage/ObjectStorageService';
import type { TargetType } from '../types/contracts';

export function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function describeImageUploadFailure(error: unknown): string {
	if (error instanceof ObjectStorageConfigurationError) return '图片上传失败：对象存储配置不完整。请到 Reading Desk 设置的“对象存储与图床”中补全 Endpoint、Bucket 与密钥。';
	if (error instanceof ObjectStorageRequestError) {
		if (error.status === 401 || error.status === 403) return `图片上传失败：图床返回 HTTP ${error.status}，通常是 Access Key 或 Secret Key 不正确。请核对密钥后重试。`;
		return `图片上传失败：图床返回 HTTP ${error.status}。请检查 Endpoint 与 Bucket 设置后重试，图片仍保留在剪贴板中。`;
	}
	if (error instanceof ClipboardImageError) return '图片上传失败：剪贴板中没有可上传的图片。';
	return '图片上传失败：无法连接图床。请检查网络与对象存储设置后重试，图片仍保留在剪贴板中。';
}

export function targetMatches(file: TFile, type: TargetType): boolean {
	return type === 'canvas' ? file.extension === 'canvas' : type === 'excalidraw' ? file.path.endsWith('.excalidraw.md') : file.extension === 'md' && !file.path.endsWith('.excalidraw.md');
}

export function isAlreadyExistingFolderError(error: unknown): boolean {
	return error instanceof Error && /folder already exists|already exists/i.test(error.message);
}

export function readingDeskHighlightId(element: { customData?: Record<string, unknown> }): string | undefined {
	const readingDesk = element.customData?.readingDesk;
	if (typeof readingDesk !== 'object' || readingDesk === null) return undefined;
	const highlightId = (readingDesk as { highlightId?: unknown }).highlightId;
	return typeof highlightId === 'string' ? highlightId : undefined;
}

export function createExcalidrawDocument(): string {
	const scene = { type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements: [] as unknown[], appState: {}, files: {} };
	return `---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n# Excalidraw Data\n\n## Text Elements\n%%\n## Drawing\n\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\`\n%%\n`;
}
