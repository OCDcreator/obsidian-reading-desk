import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';
export interface PdfLinkDestination {
	/** One-based surface page. */
	page: number;
	/** PDF coordinates; null retains the corresponding page origin. */
	x?: number;
	y?: number;
}
export interface PdfPageLink {
	id: string;
	rect: number[];
	destination?: PdfLinkDestination;
	url?: string;
}
/** No JavaScript, file launch, remote GoTo, custom schemes or automatic navigation. */
export function safePdfExternalUrl(value: unknown): string | null {
	if (typeof value !== 'string' || Array.from(value).some(character => character.charCodeAt(0) < 32)) return null;
	try { const url = new URL(value); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null; }
	catch { return null; }
}
export async function resolvePdfDestination(pdf: PDFDocumentProxy, destination: unknown): Promise<PdfLinkDestination | null> {
	const resolved = typeof destination === 'string' ? await pdf.getDestination(destination) : destination;
	if (!Array.isArray(resolved) || !resolved.length) return null;
	const reference = resolved[0];
	const index = typeof reference === 'number' ? reference : await pdf.getPageIndex(reference);
	if (!Number.isInteger(index) || index < 0 || index >= pdf.numPages) return null;
	const result: PdfLinkDestination = { page: index + 1 };
	const kind = resolved[1]?.name;
	if (kind === 'XYZ' || kind === 'FitR') {
		if (typeof resolved[2] === 'number' && Number.isFinite(resolved[2])) result.x = resolved[2];
		const y = kind === 'FitR' ? resolved[5] : resolved[3];
		if (typeof y === 'number' && Number.isFinite(y)) result.y = y;
	} else if (kind === 'FitH' || kind === 'FitBH') {
		if (typeof resolved[2] === 'number' && Number.isFinite(resolved[2])) result.y = resolved[2];
	} else if (kind === 'FitV' || kind === 'FitBV') {
		if (typeof resolved[2] === 'number' && Number.isFinite(resolved[2])) result.x = resolved[2];
	}
	return result;
}
/** Annotation links remain semantic controls; CSS owns interaction and chrome. */
export function paintPdfLinks(target: HTMLElement, viewport: PageViewport, links: PdfPageLink[]): void {
	const layer = target.ownerDocument.createElement('div'); layer.className = 'rd-pdf-link-layer';
	for (const link of links) {
		const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(link.rect);
		if (link.destination) {
			const button = target.ownerDocument.createElement('button'); button.type = 'button';
			button.className = 'rd-pdf-link'; button.dataset.pdfLink = JSON.stringify(link.destination);
			button.setAttribute('aria-label', `跳到 PDF 第 ${link.destination.page} 页，Shift 点击预览`);
			button.title = '点击跳转；Shift 点击预览';
			Object.assign(button.style, { left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`, width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px` });
			layer.append(button);
			const preview = target.ownerDocument.createElement('button'); preview.type = 'button'; preview.className = 'rd-pdf-link-preview';
			preview.dataset.pdfPreview = JSON.stringify(link.destination); preview.setAttribute('aria-label', `预览 PDF 第 ${link.destination.page} 页`);
			preview.textContent = '预览';
			Object.assign(preview.style, { left: `${Math.max(x1, x2)}px`, top: `${Math.min(y1, y2)}px` }); layer.append(preview);
		} else if (link.url) {
			const anchor = target.ownerDocument.createElement('a'); anchor.className = 'rd-pdf-link'; anchor.href = link.url;
			anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.setAttribute('aria-label', `打开外部链接：${link.url}`); anchor.title = link.url;
			Object.assign(anchor.style, { left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`, width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px` }); layer.append(anchor);
		}
	}
	target.append(layer);
}
