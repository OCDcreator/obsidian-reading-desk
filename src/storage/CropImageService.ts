import { TFile, type App, type TAbstractFile } from 'obsidian';
import type { ObjectStorageSettings, NormalizedPdfRect } from '../types/contracts';
import { ObjectStorageService } from './ObjectStorageService';

export type CropTargetKind = 'canvas' | 'image' | 'markdown';

export interface PreparedCropInput {
	pdfPath: string;
	page: number;
	rect: NormalizedPdfRect;
	target: CropTargetKind;
	image: Blob;
	previewUrl: string;
}

export interface CropImageFileOps {
	app: App;
	ensureFile(path: string, content: string): Promise<void>;
	atomicTransform(path: string, transform: (current: string) => string): Promise<void>;
	writeBinary(path: string, value: ArrayBuffer): Promise<void>;
}

const CROP_FOLDER = 'Reading Desk/裁剪';

/** Persists crop bytes locally or to object storage and lands the embed in the chosen target. */
export class CropImageService {
	private readonly prepared = new Map<string, PreparedCropInput>();

	constructor(private readonly files: CropImageFileOps, private readonly readStorage: () => ObjectStorageSettings) { }

	prepare(input: Omit<PreparedCropInput, 'previewUrl'>): { dragToken: string; previewUrl: string; mimeType: string } {
		const dragToken = `crop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const previewUrl = URL.createObjectURL(input.image);
		this.prepared.set(dragToken, { ...input, previewUrl });
		return { dragToken, previewUrl, mimeType: input.image.type || 'image/png' };
	}

	revokeAll(): void {
		for (const prepared of this.prepared.values()) URL.revokeObjectURL(prepared.previewUrl);
		this.prepared.clear();
	}

	async discard(dragToken: string): Promise<void> {
		const prepared = this.prepared.get(dragToken);
		if (!prepared) return;
		this.prepared.delete(dragToken);
		URL.revokeObjectURL(prepared.previewUrl);
	}

	async commit(dragToken: string, targetPath?: string): Promise<void> {
		const prepared = this.prepared.get(dragToken);
		if (!prepared) throw new Error('裁剪预览已失效，请重新框选。');
		this.prepared.delete(dragToken);
		URL.revokeObjectURL(prepared.previewUrl);
		await this.persist(prepared, targetPath);
	}

	private async persist(input: PreparedCropInput, targetPath?: string): Promise<void> {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const storage = this.readStorage();
		const imagePath = `${CROP_FOLDER}/裁剪-${id}.png`;
		let renderedImage: string;
		if (storage.enabled) {
			const uploaded = await new ObjectStorageService(storage).upload({ key: `crops/${id}.png`, body: input.image, contentType: 'image/png' });
			renderedImage = `![PDF 裁剪](<${uploaded.url}>)`;
		} else {
			await this.files.writeBinary(imagePath, await input.image.arrayBuffer());
			renderedImage = `![[${imagePath}]]`;
		}
		const sourceLine = `来源：${input.pdfPath} 第 ${input.page + 1} 页`;
		if (input.target === 'image') {
			const notePath = `${CROP_FOLDER}/裁剪-${id}.md`;
			await this.files.ensureFile(notePath, `# PDF 裁剪\n\n${renderedImage}\n\n${sourceLine}\n`);
			await this.files.app.workspace.openLinkText(notePath, '', false);
			return;
		}
		if (input.target === 'markdown') {
			const notePath = targetPath ?? `Reading Desk/裁剪-${id}.md`;
			await this.appendMarkdownEmbed(notePath, renderedImage, sourceLine, id);
			await this.files.app.workspace.openLinkText(notePath, '', false);
			return;
		}
		const canvasPath = targetPath ?? `Reading Desk/裁剪-${id}.canvas`;
		const cropNode = storage.enabled
			? { id: `rd-crop-${id}`, type: 'text', text: `${renderedImage}\n\n${sourceLine}`, x: 0, y: 0, width: 640, height: 420,
				readingDesk: { schemaVersion: 1, kind: 'crop', pdfPath: input.pdfPath, page: input.page, rect: input.rect, remoteImage: renderedImage } }
			: { id: `rd-crop-${id}`, type: 'file', file: imagePath, x: 0, y: 0, width: 640, height: 420,
				readingDesk: { schemaVersion: 1, kind: 'crop', pdfPath: input.pdfPath, page: input.page, rect: input.rect } };
		await this.appendCropNode(canvasPath, cropNode);
		await this.files.app.workspace.openLinkText(canvasPath, '', false);
	}

	/** Appends the embed to an existing markdown target; creates a dated note otherwise. */
	private async appendMarkdownEmbed(notePath: string, renderedImage: string, sourceLine: string, id: string): Promise<void> {
		const existing = this.files.app.vault.getAbstractFileByPath(notePath);
		if (!(existing instanceof TFile)) {
			await this.files.ensureFile(notePath, `# PDF 裁剪摘录\n\n${renderedImage}\n\n${sourceLine}\n`);
			return;
		}
		await this.files.atomicTransform(notePath, current => `${current.replace(/\s*$/, '')}\n\n${renderedImage}\n\n${sourceLine}\n<!-- reading-desk-crop ${id} -->\n`);
	}

	private async appendCropNode(path: string, node: Record<string, unknown>): Promise<void> {
		const existing: TAbstractFile | null = this.files.app.vault.getAbstractFileByPath(path);
		if (!(existing instanceof TFile)) await this.files.ensureFile(path, '{\n  "nodes": [],\n  "edges": []\n}\n');
		await this.files.atomicTransform(path, current => {
			const parsed: unknown = JSON.parse(current);
			if (!isCanvasDocument(parsed)) throw new Error('裁剪目标不是有效 Canvas 文件。');
			parsed.nodes.push(node);
			return `${JSON.stringify(parsed, null, 2)}\n`;
		});
	}
}

function isCanvasDocument(value: unknown): value is { nodes: Record<string, unknown>[]; edges: unknown[] } {
	return typeof value === 'object' && value !== null
		&& Array.isArray((value as { nodes?: unknown }).nodes)
		&& Array.isArray((value as { edges?: unknown }).edges);
}
