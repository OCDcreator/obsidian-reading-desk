import { DISPLAY_PAGE_PIXELS, PdfCanvasBudget } from './PdfCanvasBudget';
import { indexPdfText, type PdfPageTextIndex } from './PdfTextIndex';
import { abortableReaderTask, isReaderAbort, throwIfReaderAborted } from './ReaderCancellation';
import type { PdfCropRequest } from '../crop/ReaderCropController';
import { paintPdfLinks, resolvePdfDestination, safePdfExternalUrl, type PdfPageLink } from './PdfLinks';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask } from 'pdfjs-dist';
import type { PdfHighlight } from '../types/contracts';
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
	private readonly activeRenderTasks = new Map<HTMLElement, RenderTask>();
	private readonly targetEpoch = new WeakMap<HTMLElement, number>();
	private readonly canvasBudget = new PdfCanvasBudget();

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
		this.invalidateRendering();
		this.scale = Math.max(0.5, Math.min(3, scale));
	}

	getScale(): number { return this.scale; }
	getRotation(): number { return this.rotation; }
	getRenderedViewport(): PageViewport | null { return this.renderedViewport; }

	setRotation(rotation: number): void {
		this.invalidateRendering();
		this.rotation = ((rotation % 360) + 360) % 360;
	}

	async renderPage(pageNumber: number, target: HTMLElement, highlights: PdfHighlight[], options: { signal?: AbortSignal; scale?: number; rotation?: number; links?: boolean } = {}): Promise<RenderedPage | null> {
		throwIfReaderAborted(options.signal);
		const generation = this.renderGeneration;
		const epoch = (this.targetEpoch.get(target) ?? 0) + 1; this.targetEpoch.set(target, epoch);
		this.activeRenderTasks.get(target)?.cancel();
		const proxy = this.requireDocument();
		const scale = options.scale ?? this.scale; const rotation = options.rotation ?? this.rotation;
		const owns = (): boolean => this.ownsRender(generation, proxy) && this.targetEpoch.get(target) === epoch && !options.signal?.aborted;
		const staging = target.ownerDocument.createElement('div');
		let canvas: HTMLCanvasElement | null = null;
		try {
			const page = await abortableReaderTask(proxy.getPage(pageNumber), options.signal);
			if (!owns()) return null;
			const viewport = page.getViewport({ scale, rotation });
			staging.style.width = `${viewport.width}px`; staging.style.height = `${viewport.height}px`;
			staging.style.setProperty('--scale-factor', String(viewport.scale));
			canvas = target.ownerDocument.createElement('canvas'); canvas.className = 'rd-pdf-canvas'; staging.append(canvas);
			const ratio = this.canvasBudget.allocate(canvas, viewport.width, viewport.height, canvasPixelRatio(canvas), DISPLAY_PAGE_PIXELS);
			canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
			const context = canvas.getContext('2d'); if (!context) throw new Error('无法创建 PDF canvas 上下文');
			const task = page.render({ canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
			this.activeRenderTasks.set(target, task);
			const abort = (): void => task.cancel(); options.signal?.addEventListener('abort', abort, { once: true });
			try { await abortableReaderTask(task.promise, options.signal); }
			finally { options.signal?.removeEventListener('abort', abort); if (this.activeRenderTasks.get(target) === task) this.activeRenderTasks.delete(target); }
			if (!owns()) return null;
			const textSelectable = await abortableReaderTask(this.renderTextLayer(page, viewport, staging, generation), options.signal);
			if (!owns()) return null;
			this.renderHighlights(staging, viewport, highlights.filter(highlight => highlight.page === pageNumber - 1));
			if (options.links !== false) {
				const links = await abortableReaderTask(this.pageLinks(pageNumber).catch(() => []), options.signal);
				paintPdfLinks(staging, viewport, links);
			}
			if (!owns()) return null;
			this.releaseTarget(target); target.classList.add('rd-pdf-page'); target.style.cssText = staging.style.cssText;
			target.replaceChildren(...Array.from(staging.childNodes));
			this.renderedViewport = viewport; this.renderedPageNumber = pageNumber;
			this.canvasBudget.complete(canvas); canvas = null;
			return { page: pageNumber, viewport, container: target, textSelectable };
		} catch (error) { if (isReaderAbort(error) || !owns()) return null; throw error; }
		finally { if (canvas) this.canvasBudget.release(canvas); this.releaseTarget(staging); }
	}
	/** Frees backing stores when a virtual page or temporary preview is evicted. */
	releaseTarget(target: HTMLElement): void {
		this.activeRenderTasks.get(target)?.cancel();
		for (const canvas of Array.from(target.querySelectorAll('canvas'))) this.activeRenderTasks.get(canvas)?.cancel();
		this.canvasBudget.releaseTarget(target);
	}
	adoptTarget(target: HTMLElement): void { for (const canvas of Array.from(target.querySelectorAll('canvas'))) this.canvasBudget.adopt(canvas); }
	private invalidateRendering(): void {
		this.renderGeneration += 1;
		for (const task of this.activeRenderTasks.values()) task.cancel();
		this.activeRenderTasks.clear();
	}

	/** Paints a lightweight, real PDF-page preview without changing Reader scale state. */
	async renderThumbnail(pageNumber: number, canvas: HTMLCanvasElement, maxWidth = 136): Promise<void> {
		const proxy = this.requireDocument(); const generation = this.renderGeneration; const rotation = this.rotation;
		const page = await proxy.getPage(pageNumber);
		if (!this.ownsRender(generation, proxy)) return;
		const natural = page.getViewport({ scale: 1, rotation });
		const viewport = page.getViewport({ scale: maxWidth / natural.width, rotation });
		this.activeRenderTasks.get(canvas)?.cancel();
		const ratio = this.canvasBudget.allocate(canvas, viewport.width, viewport.height, canvasPixelRatio(canvas));
		canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
		const context = canvas.getContext('2d'); if (!context) { this.canvasBudget.release(canvas); throw new Error('无法创建缩略图 canvas 上下文'); }
		const task = page.render({ canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
		this.activeRenderTasks.set(canvas, task);
		try {
			await task.promise;
			if (!this.ownsRender(generation, proxy)) this.canvasBudget.release(canvas);
			else this.canvasBudget.complete(canvas);
		} catch (error) { this.canvasBudget.release(canvas); if (!isReaderAbort(error)) throw error; }
		finally { if (this.activeRenderTasks.get(canvas) === task) this.activeRenderTasks.delete(canvas); }
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
	async pageText(pageNumber: number): Promise<string> { return (await this.pageTextIndex(pageNumber)).text; }
	async pageTextIndex(pageNumber: number): Promise<PdfPageTextIndex> {
		const page = await this.requireDocument().getPage(pageNumber);
		const content = await page.getTextContent();
		return indexPdfText(content.items as Array<{ str?: string; hasEOL?: boolean }>);
	}
	async pageLinks(pageNumber: number): Promise<PdfPageLink[]> {
		const pdf = this.requireDocument(); const page = await pdf.getPage(pageNumber);
		const annotations = await page.getAnnotations({ intent: 'display' });
		const links: PdfPageLink[] = [];
		for (const annotation of annotations) {
			if (annotation.subtype !== 'Link' || annotation.jsAction || annotation.actions || !Array.isArray(annotation.rect) || annotation.rect.length !== 4 || !annotation.rect.every(Number.isFinite)) continue;
			const url = safePdfExternalUrl(annotation.url);
			try {
				const destination = annotation.dest ? await resolvePdfDestination(pdf, annotation.dest) : null;
				if (destination || url) links.push({ id: String(annotation.id), rect: annotation.rect, destination: destination ?? undefined, url: url ?? undefined });
			} catch { /* Broken links do not prevent reading the page. */ }
		}
		return links;
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
		this.invalidateRendering();
		this.canvasBudget.clear();
		if (!this.document) return;
		const document = this.document;
		this.document = null;
		this.renderedViewport = null;
		this.renderedPageNumber = null;
		await document.destroy();
	}

	async renderCrop(request: PdfCropRequest): Promise<Blob> {
		if (!Number.isInteger(request.page) || request.page < 0 || ![0, 90, 180, 270].includes(request.rotation)) throw new Error('裁剪源页或旋转无效。');
		const pdf = this.requireDocument(); const generation = this.renderGeneration;
		const page = await pdf.getPage(request.page + 1);
		const viewport = page.getViewport({ scale: Math.max(request.viewport.scale, 1.5), rotation: request.rotation });
		const source = document.createElement('canvas'); const output = document.createElement('canvas');
		try {
			const ratio = this.canvasBudget.allocate(source, viewport.width, viewport.height, canvasPixelRatio(source));
			const context = source.getContext('2d'); if (!context) throw new Error('无法创建裁剪画布。');
			await page.render({ canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] }).promise;
			if (!this.ownsRender(generation, pdf)) throw new Error('PDF 已切换，请重新裁剪。');
			const crop = denormalizeRect(request.rect, viewport);
			this.canvasBudget.allocate(output, crop.width, crop.height, ratio);
			const outputContext = output.getContext('2d'); if (!outputContext) throw new Error('无法创建裁剪输出画布。');
			outputContext.drawImage(source, crop.left * ratio, crop.top * ratio, crop.width * ratio, crop.height * ratio, 0, 0, output.width, output.height);
			const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'));
			if (!blob) throw new Error('裁剪图片编码失败。');
			return blob;
		} finally { this.canvasBudget.release(source); this.canvasBudget.release(output); }
	}

	private ownsRender(generation: number, document: PDFDocumentProxy | null): boolean {
		return generation === this.renderGeneration && document !== null && document === this.document;
	}

	private async renderTextLayer(page: PDFPageProxy, viewport: PageViewport, target: HTMLElement, generation: number): Promise<boolean> {
		const textLayer = document.createElement('div');
		textLayer.className = 'rd-pdf-text-layer';
		textLayer.style.setProperty('--scale-factor', String(viewport.scale));
		target.append(textLayer);
		const content = await page.getTextContent();
		const index = indexPdfText(content.items as Array<{ str?: string; hasEOL?: boolean }>);
		const layer = new TextLayer({ textContentSource: content, container: textLayer, viewport });
		await layer.render();
		textLayer.dataset.rdPageText = index.text;
		layer.textDivs.forEach((span, item) => {
			const part = index.spans[item]; if (!part) return;
			span.dataset.rdTextStart = String(part.start); span.dataset.rdTextEnd = String(part.end);
		});
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

/** Builds a unique accessible name from the highlight text, or its page as a fallback. */
function commentButtonName(highlight: PdfHighlight): string {
	const text = highlight.text.replace(/\s+/g, ' ').trim();
	const excerpt = text.length > 32 ? `${text.slice(0, 32)}…` : text;
	return excerpt ? `打开高亮评论：${excerpt}` : `打开高亮评论：第 ${highlight.page + 1} 页`;
}
