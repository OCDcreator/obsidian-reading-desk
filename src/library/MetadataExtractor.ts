import * as JSZip from 'jszip';
import { createHash } from 'crypto';
import type { BookMetadataExtractor, LibraryFile } from './LibraryIndex';

export interface BinaryReader {
	readBinary(path: string): Promise<ArrayBuffer>;
	writeBinary(path: string, value: ArrayBuffer): Promise<void>;
}

export interface PdfDocumentLike {
	numPages: number;
	getMetadata(): Promise<{ info?: object; metadata?: { get(name: string): unknown } }>;
	getPage(page: number): Promise<{ getViewport(options: { scale: number }): { width: number; height: number }; render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> } }>;
	destroy(): Promise<void>;
}

export interface PdfLoader {
	load(data: ArrayBuffer): Promise<PdfDocumentLike>;
}

export class MetadataExtractor implements BookMetadataExtractor {
	constructor(private readonly files: BinaryReader, private readonly pdf: PdfLoader, private readonly coverDirectory = '.obsidian/plugins/obsidian-reading-desk/covers') { }

	async extract(file: LibraryFile): Promise<{ title: string; author: string; pageCount?: number; coverPath?: string }> {
		return file.extension.toLowerCase() === 'epub' ? this.extractEpub(file) : this.extractPdf(file);
	}

	private async extractPdf(file: LibraryFile): Promise<{ title: string; author: string; pageCount: number; coverPath?: string; coverRetryable?: boolean; coverError?: string }> {
		const document = await this.pdf.load(await this.files.readBinary(file.path));
		try {
			const metadata = await document.getMetadata();
			const info = metadata.info as Record<string, unknown> | undefined;
			const title = asString(metadata.metadata?.get('dc:title')) || asString(info?.Title) || file.path.split('/').pop()?.replace(/\.pdf$/i, '') || file.path;
			const author = asString(metadata.metadata?.get('dc:creator')) || asString(info?.Author) || '';
			try {
				const coverPath = await this.renderPdfCover(document, file.path);
				return { title, author, pageCount: document.numPages, coverPath };
			} catch (error) {
				return { title, author, pageCount: document.numPages, coverRetryable: true, coverError: error instanceof Error ? error.message : 'PDF 封面生成失败' };
			}
		} finally {
			await document.destroy();
		}
	}

	private async extractEpub(file: LibraryFile): Promise<{ title: string; author: string; coverPath?: string }> {
		const archive = await JSZip.loadAsync(await this.files.readBinary(file.path));
		const container = await archive.file('META-INF/container.xml')?.async('text');
		const opfPath = container?.match(/full-path=["']([^"']+)["']/i)?.[1];
		if (!opfPath) throw new Error('EPUB 缺少 OPF 清单');
		const opf = await archive.file(opfPath)?.async('text');
		if (!opf) throw new Error('EPUB OPF 无法读取');
		const title = xmlText(opf, 'dc:title') || file.path.split('/').pop()?.replace(/\.epub$/i, '') || file.path;
		const author = xmlText(opf, 'dc:creator') || '';
		const coverPath = await this.extractEpubCover(archive, opf, opfPath, file.path).catch(() => undefined);
		return { title, author, coverPath };
	}

	private async renderPdfCover(document: PdfDocumentLike, sourcePath: string): Promise<string> {
		if (typeof document === 'undefined' || typeof window === 'undefined') throw new Error('当前环境不能生成 PDF 封面');
		const page = await document.getPage(1);
		const viewport = page.getViewport({ scale: 0.35 });
		const canvas = globalThis.document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('无法创建封面 canvas');
		await page.render({ canvasContext: context, viewport }).promise;
		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('PDF 封面编码失败');
		const path = this.coverPath(sourcePath, 'png');
		await this.files.writeBinary(path, await blob.arrayBuffer());
		return path;
	}

	private async extractEpubCover(archive: JSZip, opf: string, opfPath: string, sourcePath: string): Promise<string> {
		const manifest = [...opf.matchAll(/<item\b([^>]+)>/gi)];
		const coverId = findEpub2CoverId(opf);
		const item = manifest.find(match => attributeValue(match[1], 'id') === coverId)
			?? manifest.find(match => hasAttributeToken(match[1], 'properties', 'cover-image'));
		const href = item ? attributeValue(item[1], 'href') : undefined;
		if (!href) throw new Error('EPUB 未声明封面');
		const base = opfPath.split('/').slice(0, -1).join('/');
		const entry = archive.file(base ? `${base}/${href}` : href);
		if (!entry) throw new Error('EPUB 封面资源不存在');
		const mime = (item ? attributeValue(item[1], 'media-type') : undefined) ?? 'image/png';
		const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'img';
		const path = this.coverPath(sourcePath, extension);
		await this.files.writeBinary(path, await entry.async('arraybuffer'));
		return path;
	}

	private coverPath(sourcePath: string, extension: string): string {
		// A fixed-length SHA-256 digest stays below filesystem basename limits
		// even for long Unicode vault paths while retaining collision resistance.
		const key = createHash('sha256').update(sourcePath, 'utf8').digest('hex');
		return `${this.coverDirectory}/${key}.${extension}`;
	}
}

function asString(value: unknown): string {
	return (Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '').trim();
}

function xmlText(xml: string, tag: string): string {
	const escaped = tag.replace(':', '\\:');
	const raw = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i'))?.[1].replace(/<[^>]*>/g, '').trim() ?? '';
	return decodeXml(raw);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEpub2CoverId(opf: string): string | undefined {
	for (const match of opf.matchAll(/<meta\b([^>]*)>/gi)) {
		if (attributeValue(match[1], 'name')?.toLowerCase() === 'cover') return attributeValue(match[1], 'content');
	}
	return undefined;
}

function attributeValue(attributes: string, name: string): string | undefined {
	const expression = new RegExp(`(?:^|\\s)${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
	const value = expression.exec(attributes)?.[2];
	return value === undefined ? undefined : decodeXml(value);
}

function hasAttributeToken(attributes: string, name: string, token: string): boolean {
	return attributeValue(attributes, name)?.split(/\s+/).some(value => value.toLowerCase() === token.toLowerCase()) ?? false;
}

function decodeXml(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
		const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
		const normalized = entity.toLowerCase();
		if (named[normalized] !== undefined) return named[normalized];
		const codePoint = normalized.startsWith('#x') ? Number.parseInt(normalized.slice(2), 16) : Number.parseInt(normalized.slice(1), 10);
		return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
	});
}
