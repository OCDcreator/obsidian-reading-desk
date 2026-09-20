import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask } from 'pdfjs-dist';
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
	/** False when the page carries no selectable text (typically a scan). */
	textSelectable: boolean;
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
	private renderGeneration = 0;
	private activeRenderTask: RenderTask | null = null;

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
	getRotation(): number { return this.rotation; }
	getRenderedViewport(): PageViewport | null { return this.renderedViewport; }

	setRotation(rotation: number): void {
		this.rotation = ((rotation % 360) + 360) % 360;
	}

	async renderPage(pageNumber: number, target: HTMLElement, highlights: PdfHighlight[]): Promise<RenderedPage | null> {
		const generation = ++this.renderGeneration;
		const proxy = this.requireDocument();
		const page = await proxy.getPage(pageNumber);
		const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
		if (!this.ownsRender(generation, proxy)) return null;
		this.renderedViewport = viewport;
		this.renderedPageNumber = pageNumber;
		target.replaceChildren();
		target.classList.add('rd-pdf-page');
		target.style.width = `${viewport.width}px`;
		target.style.height = `${viewport.height}px`;
		// pdf.js sizes text-layer spans with calc(var(--scale-factor) * Npx); without the
		// variable the font-size silently falls back to the inherited value and misaligns selection.
		target.style.setProperty('--scale-factor', String(viewport.scale));
		const canvas = document.createElement('canvas');
		canvas.className = 'rd-pdf-canvas';
		target.append(canvas);
		const pixelRatio = canvasPixelRatio(canvas);
		const cssWidth = Math.ceil(viewport.width);
		const cssHeight = Math.ceil(viewport.height);
		canvas.width = Math.ceil(cssWidth * pixelRatio);
		canvas.height = Math.ceil(cssHeight * pixelRatio);
		canvas.style.width = `${cssWidth}px`;
		canvas.style.height = `${cssHeight}px`;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('无法创建 PDF canvas 上下文');
		const task = page.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
		this.activeRenderTask?.cancel();
		this.activeRenderTask = task;
		try {
			await task.promise;
		} catch (error) {
			if (isCancelledRender(error) || !this.ownsRender(generation, proxy)) return null;
			throw error;
		} finally {
			if (this.activeRenderTask === task) this.activeRenderTask = null;
		}
		if (!this.ownsRender(generation, proxy)) return null;
		const textSelectable = await this.renderTextLayer(page, viewport, target, generation);
		if (!this.ownsRender(generation, proxy)) return null;
		this.renderHighlights(target, viewport, highlights.filter(highlight => highlight.page === pageNumber - 1));
		return { page: pageNumber, viewport, container: target, textSelectable };
	}

	/** Paints a lightweight, real PDF-page preview without changing Reader scale state. */
	async renderThumbnail(pageNumber: number, canvas: HTMLCanvasElement, maxWidth = 136): Promise<void> {
		const page = await this.requireDocument().getPage(pageNumber);
		const natural = page.getViewport({ scale: 1, rotation: this.rotation });
		const cssScale = maxWidth / natural.width;
		const viewport = page.getViewport({ scale: cssScale, rotation: this.rotation });
		const pixelRatio = canvasPixelRatio(canvas);
		canvas.width = Math.ceil(viewport.width * pixelRatio);
		canvas.height = Math.ceil(viewport.height * pixelRatio);
		canvas.style.width = `${Math.ceil(viewport.width)}px`;
		canvas.style.height = `${Math.ceil(viewport.height)}px`;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('无法创建缩略图 canvas 上下文');
		await page.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] }).promise;
	}

	/** Repaints only the annotation overlay, leaving PDF canvas/text selection intact. */
	updateHighlights(target: HTMLElement, highlights: PdfHighlight[], pageNumber?: number): void {
		if (!this.renderedViewport || !this.renderedPageNumber) return;
		const page = pageNumber ?? this.renderedPageNumber;
		target.querySelector('.rd-highlight-layer')?.remove();
		this.renderHighlights(target, this.renderedViewport, highlights.filter(highlight => highlight.page === page - 1));
	}

	/** Paints a highlight overlay for an arbitrary host/viewport pair (deck pages). */
	paintHighlights(target: HTMLElement, viewport: PageViewport, highlights: PdfHighlight[]): void {
		target.querySelector('.rd-highlight-layer')?.remove();
		this.renderHighlights(target, viewport, highlights);
	}

	/** Synchronous viewport for a page already measured by this renderer, else null. */
	measuredViewport(pageNumber: number): PageViewport | null {
		return pageNumber === this.renderedPageNumber ? this.renderedViewport : null;
	}

	/** Resolves the viewport for any page without mutating render state. */
	async pageViewport(pageNumber: number): Promise<PageViewport> {
		const page = await this.requireDocument().getPage(pageNumber);
		return page.getViewport({ scale: this.scale, rotation: this.rotation });
	}

	/** Extracts the selectable text of one page, joined with layout line breaks. */
	async pageText(pageNumber: number): Promise<string> {
		const page = await this.requireDocument().getPage(pageNumber);
		const content = await page.getTextContent();
		let text = '';
		for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
			if (typeof item.str !== 'string') continue;
			text += item.str;
			if (item.hasEOL) text += '\n';
		}
		return text;
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
		this.renderGeneration += 1;
		this.activeRenderTask?.cancel();
		this.activeRenderTask = null;
		if (!this.document) return;
		const document = this.document;
		this.document = null;
		this.renderedViewport = null;
		this.renderedPageNumber = null;
		await document.destroy();
	}

	async renderCrop(rect: NormalizedPdfRect): Promise<Blob> {
		const pageNumber = this.renderedPageNumber;
		if (!pageNumber) throw new Error('请先渲染 PDF 页面后再裁剪。');
		const page = await this.requireDocument().getPage(pageNumber);
		const viewport = page.getViewport({ scale: Math.max(this.scale, 1.5), rotation: this.rotation });
		const source = document.createElement('canvas');
		const ratio = Math.max(1, window.devicePixelRatio ?? 1);
		source.width = Math.ceil(viewport.width * ratio);
		source.height = Math.ceil(viewport.height * ratio);
		const context = source.getContext('2d');
		if (!context) throw new Error('无法创建裁剪画布。');
		await page.render({ canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise;
		const crop = denormalizeRect(rect, viewport);
		const output = document.createElement('canvas');
		output.width = Math.max(1, Math.round(crop.width * ratio));
		output.height = Math.max(1, Math.round(crop.height * ratio));
		const outputContext = output.getContext('2d');
		if (!outputContext) throw new Error('无法创建裁剪输出画布。');
		outputContext.drawImage(source, crop.left * ratio, crop.top * ratio, crop.width * ratio, crop.height * ratio, 0, 0, output.width, output.height);
		const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('裁剪图片编码失败。');
		return blob;
	}

	private ownsRender(generation: number, document: PDFDocumentProxy | null): boolean {
		return generation === this.renderGeneration && document !== null && document === this.document;
	}

	private async renderTextLayer(page: PDFPageProxy, viewport: PageViewport, target: HTMLElement, generation: number): Promise<boolean> {
		const textLayer = document.createElement('div');
		textLayer.className = 'rd-pdf-text-layer';
		textLayer.style.setProperty('--scale-factor', String(viewport.scale));
		target.append(textLayer);
		await new TextLayer({
			textContentSource: page.streamTextContent(),
			container: textLayer,
			viewport
		}).render();
		if (generation !== this.renderGeneration) return false;
		let selectable = false;
		for (const span of Array.from(textLayer.children)) {
			const text = span.textContent ?? '';
			if (text.trim().length > 0) { selectable = true; break; }
		}
		return selectable;
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

function canvasPixelRatio(canvas: HTMLCanvasElement): number {
	return Math.max(1, canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1);
}

function isCancelledRender(error: unknown): boolean {
	return error instanceof Error && error.name === 'RenderingCancelledException';
}

/** Builds a unique accessible name from the highlight text, or its page as a fallback. */
function commentButtonName(highlight: PdfHighlight): string {
	const text = highlight.text.replace(/\s+/g, ' ').trim();
	const excerpt = text.length > 32 ? `${text.slice(0, 32)}…` : text;
	return excerpt ? `打开高亮评论：${excerpt}` : `打开高亮评论：第 ${highlight.page + 1} 页`;
}
