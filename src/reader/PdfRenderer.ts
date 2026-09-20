import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { NormalizedPdfRect, PdfHighlight } from '../types/contracts';
import { denormalizeRect } from './PdfSelectionGeometry';

export interface PdfBinarySource {
	readBinary(path: string): Promise<ArrayBuffer>;
	resourceUrl(path: string): string | null;
}

export interface RenderedPage {
	page: number;
	viewport: PageViewport;
	container: HTMLElement;
}

export interface PdfOutlineEntry {
	title: string;
	page: number;
	path: string[];
}

/** Returns the unbounded scale required to render a page at its host width. */
export function scaleToFitWidth(currentScale: number, renderedWidth: number, availableWidth: number): number {
	if (!Number.isFinite(currentScale) || !Number.isFinite(renderedWidth) || !Number.isFinite(availableWidth)
		|| currentScale <= 0 || renderedWidth <= 0 || availableWidth <= 0) return currentScale;
	return currentScale * availableWidth / renderedWidth;
}

/** Returns the unbounded scale required to render a page at its host height. */
export function scaleToFitHeight(currentScale: number, renderedHeight: number, availableHeight: number): number {
	if (!Number.isFinite(currentScale) || !Number.isFinite(renderedHeight) || !Number.isFinite(availableHeight)
		|| currentScale <= 0 || renderedHeight <= 0 || availableHeight <= 0) return currentScale;
	return currentScale * availableHeight / renderedHeight;
}

export class PdfRenderer {
	private document: PDFDocumentProxy | null = null;
	private scale = 1.25;
	private rotation = 0;
	private renderedViewport: PageViewport | null = null;
	private renderedPageNumber: number | null = null;

	constructor(private readonly source: PdfBinarySource) { }

	async open(path: string): Promise<number> {
		await this.close();
		const worker = this.source.resourceUrl('pdf.worker.mjs');
		GlobalWorkerOptions.workerSrc = worker ?? '';
		const bytes = new Uint8Array(await this.source.readBinary(path));
		this.document = await getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: !!worker }).promise;
		return this.document.numPages;
	}

	setScale(scale: number): void {
		this.scale = Math.max(0.5, Math.min(3, scale));
	}

	getScale(): number { return this.scale; }
	getRenderedViewport(): PageViewport | null { return this.renderedViewport; }

	setRotation(rotation: number): void {
		this.rotation = ((rotation % 360) + 360) % 360;
	}

	async renderPage(pageNumber: number, target: HTMLElement, highlights: PdfHighlight[]): Promise<RenderedPage> {
		const page = await this.requireDocument().getPage(pageNumber);
		const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
		this.renderedViewport = viewport;
		this.renderedPageNumber = pageNumber;
		target.replaceChildren();
		target.classList.add('rd-pdf-page');
		target.style.width = `${viewport.width}px`;
		target.style.height = `${viewport.height}px`;
		const canvas = document.createElement('canvas');
		canvas.className = 'rd-pdf-canvas';
		target.append(canvas);
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('无法创建 PDF canvas 上下文');
		await page.render({ canvasContext: context, viewport }).promise;
		await this.renderTextLayer(page, viewport, target);
		this.renderHighlights(target, viewport, highlights.filter(highlight => highlight.page === pageNumber - 1));
		return { page: pageNumber, viewport, container: target };
	}

	/** Paints a lightweight, real PDF-page preview without changing Reader scale state. */
	async renderThumbnail(pageNumber: number, canvas: HTMLCanvasElement, maxWidth = 136): Promise<void> {
		const page = await this.requireDocument().getPage(pageNumber);
		const natural = page.getViewport({ scale: 1, rotation: this.rotation });
		const cssScale = maxWidth / natural.width;
		const viewport = page.getViewport({ scale: cssScale, rotation: this.rotation });
		const pixelRatio = Math.max(1, canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1);
		canvas.width = Math.ceil(viewport.width * pixelRatio);
		canvas.height = Math.ceil(viewport.height * pixelRatio);
		canvas.style.width = `${Math.ceil(viewport.width)}px`;
		canvas.style.height = `${Math.ceil(viewport.height)}px`;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('无法创建 PDF 缩略图 canvas 上下文');
		await page.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] }).promise;
	}

	/** Repaints only the annotation overlay, leaving PDF canvas/text selection intact. */
	updateHighlights(target: HTMLElement, highlights: PdfHighlight[]): void {
		if (!this.renderedViewport || !this.renderedPageNumber) return;
		target.querySelector('.rd-highlight-layer')?.remove();
		this.renderHighlights(target, this.renderedViewport, highlights.filter(highlight => highlight.page === this.renderedPageNumber - 1));
	}

	async getOutline(): Promise<PdfOutlineEntry[]> {
		const items = (await this.requireDocument().getOutline()) ?? [];
		const entries: PdfOutlineEntry[] = [];
		const visit = async (nodes: Array<{ title: string; dest?: string | unknown[]; items?: unknown[] }>, parents: string[]): Promise<void> => {
			for (const node of nodes) {
				const path = [...parents, node.title];
				const page = await this.outlinePage(node.dest);
				if (page !== null) entries.push({ title: node.title, page, path });
				if (Array.isArray(node.items)) await visit(node.items as Array<{ title: string; dest?: string | unknown[]; items?: unknown[] }>, path);
			}
		};
		await visit(items as Array<{ title: string; dest?: string | unknown[]; items?: unknown[] }>, []);
		return entries;
	}

	async close(): Promise<void> {
		if (!this.document) return;
		await this.document.destroy();
		this.document = null;
		this.renderedViewport = null;
		this.renderedPageNumber = null;
	}

	async renderCrop(rect: NormalizedPdfRect): Promise<Blob> {
		const pageNumber = this.renderedPageNumber;
		if (!pageNumber) throw new Error('请先渲染 PDF 页面后再裁剪。');
		const page = await this.requireDocument().getPage(pageNumber);
		const viewport = page.getViewport({ scale: Math.max(this.scale, 1.5), rotation: this.rotation });
		const source = document.createElement('canvas');
		source.width = Math.ceil(viewport.width);
		source.height = Math.ceil(viewport.height);
		const context = source.getContext('2d');
		if (!context) throw new Error('无法创建裁剪画布。');
		await page.render({ canvasContext: context, viewport }).promise;
		const crop = denormalizeRect(rect, viewport);
		const output = document.createElement('canvas');
		output.width = Math.max(1, Math.round(crop.width));
		output.height = Math.max(1, Math.round(crop.height));
		const outputContext = output.getContext('2d');
		if (!outputContext) throw new Error('无法创建裁剪输出画布。');
		outputContext.drawImage(source, crop.left, crop.top, crop.width, crop.height, 0, 0, output.width, output.height);
		const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('裁剪图片编码失败。');
		return blob;
	}

	private async renderTextLayer(page: PDFPageProxy, viewport: PageViewport, target: HTMLElement): Promise<void> {
		const textLayer = document.createElement('div');
		textLayer.className = 'rd-pdf-text-layer';
		target.append(textLayer);
		await new TextLayer({
			textContentSource: page.streamTextContent(),
			container: textLayer,
			viewport
		}).render();
	}

	private renderHighlights(target: HTMLElement, viewport: PageViewport, highlights: PdfHighlight[]): void {
		const layer = document.createElement('div');
		layer.className = 'rd-highlight-layer';
		target.append(layer);
		for (const highlight of highlights) {
			highlight.rects.forEach((rect, index) => {
				const coordinates = denormalizeRect(rect, viewport);
				const mark = document.createElement('div');
				mark.className = `rd-highlight rd-highlight--${highlight.color}`;
				layer.append(mark);
				mark.dataset.highlightId = highlight.id;
				Object.assign(mark.style, {
					left: `${coordinates.left}px`,
					top: `${coordinates.top}px`,
					width: `${coordinates.width}px`,
					height: `${coordinates.height}px`
				});
				if (index === highlight.rects.length - 1) this.renderCommentButton(layer, coordinates, highlight);
			});
		}
	}

	private renderCommentButton(layer: HTMLElement, coordinates: { left: number; top: number; width: number; height: number }, highlight: PdfHighlight): void {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'rd-highlight-comment-button';
		button.dataset.highlightId = highlight.id;
		// Unique per highlight so screen readers can tell the buttons apart.
		button.setAttribute('aria-label', commentButtonName(highlight));
		// An authored mark, not a text glyph standing in for an icon.
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 16 16');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('focusable', 'false');
		const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		bubble.setAttribute('d', 'M3 3.5h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H8.5L5.5 13.5V10.5H3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z');
		bubble.setAttribute('fill', 'none');
		bubble.setAttribute('stroke', 'currentColor');
		bubble.setAttribute('stroke-width', '1.4');
		bubble.setAttribute('stroke-linejoin', 'round');
		svg.append(bubble);
		button.append(svg);
		// Live geometry from the rendered viewport; keep the inline positioning.
		Object.assign(button.style, { left: `${coordinates.left + coordinates.width + 3}px`, top: `${coordinates.top}px` });
		layer.append(button);
	}

	private requireDocument(): PDFDocumentProxy {
		if (!this.document) throw new Error('PDF 尚未载入');
		return this.document;
	}

	private async outlinePage(destination: string | unknown[] | undefined): Promise<number | null> {
		if (!destination) return null;
		const resolved = typeof destination === 'string' ? await this.requireDocument().getDestination(destination) : destination;
		const reference = resolved?.[0];
		if (!reference) return null;
		return this.requireDocument().getPageIndex(reference as never);
	}
}

/** Builds a unique accessible name from the highlight text, or its page as a fallback. */
function commentButtonName(highlight: PdfHighlight): string {
	const text = highlight.text.replace(/\s+/g, ' ').trim();
	const excerpt = text.length > 32 ? `${text.slice(0, 32)}…` : text;
	return excerpt ? `打开高亮评论：${excerpt}` : `打开高亮评论：第 ${highlight.page + 1} 页`;
}
