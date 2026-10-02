import type { PdfRenderer } from './PdfRenderer';
import type { PdfLinkDestination } from './PdfLinks';
import { isReaderAbort } from './ReaderCancellation';

export class ReaderLinkPreview {
	private root: HTMLElement | null = null;
	private request: AbortController | null = null;
	private renderer: PdfRenderer | null = null;
	private origin: HTMLElement | null = null;
	close(): void {
		this.request?.abort(); this.request = null;
		if (this.root) this.renderer?.releaseTarget(this.root);
		this.root?.remove(); this.root = null; this.renderer = null;
		if (this.origin?.isConnected) this.origin.focus(); this.origin = null;
	}
	async show(parent: HTMLElement, pdf: PdfRenderer, destination: PdfLinkDestination, origin: HTMLElement, open: () => Promise<void>): Promise<void> {
		this.close();
		const request = new AbortController(); this.request = request; this.renderer = pdf; this.origin = origin;
		const doc = parent.ownerDocument;
		const root = doc.createElement('div'); root.className = 'rd-pdf-preview'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', `PDF 第 ${destination.page} 页预览`);
		this.root = root; parent.append(root);
		const actions = doc.createElement('div'); actions.className = 'rd-pdf-preview__actions'; root.append(actions);
		const jump = doc.createElement('button'); jump.type = 'button'; jump.className = 'rd-button'; jump.textContent = '打开此位置';
		jump.addEventListener('click', () => { this.close(); void open().catch(error => console.error('[Reading Desk] PDF 内链跳转失败', error)); }); actions.append(jump);
		const close = doc.createElement('button'); close.type = 'button'; close.className = 'rd-button'; close.textContent = '关闭预览'; close.addEventListener('click', () => this.close()); actions.append(close);
		const body = doc.createElement('div'); body.className = 'rd-pdf-preview__body'; body.tabIndex = 0; root.append(body);
		root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); } });
		close.focus();
		const host = doc.createElement('div'); host.className = 'rd-pdf-page'; body.append(host);
		try {
			const measured = await pdf.pageViewport(destination.page);
			if (request.signal.aborted) return;
			const result = await pdf.renderPage(destination.page, host, [], { signal: request.signal, scale: Math.min(0.8, measured.scale * 420 / measured.width), rotation: measured.rotation, links: false });
			if (request.signal.aborted || this.root !== root) { pdf.releaseTarget(host); return; }
			if (!result) { body.textContent = '预览无法载入，请重试。'; return; }
			if (destination.x !== undefined || destination.y !== undefined) {
				const point = result.viewport.convertToViewportPoint(destination.x ?? result.viewport.viewBox[0], destination.y ?? result.viewport.viewBox[3]);
				body.scrollTop = Math.max(0, point[1] - 40); body.scrollLeft = Math.max(0, point[0]);
			}
		} catch (error) { if (!request.signal.aborted && !isReaderAbort(error)) body.textContent = '预览无法载入，请重试。'; }
	}
}
