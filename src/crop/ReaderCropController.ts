import type { PageViewport } from 'pdfjs-dist';
import type { NormalizedPdfRect } from '../types/contracts';
import type { PageSurface } from '../reader/PageSurface';
import { normalizeClientRect } from '../reader/PdfSelectionGeometry';
import type { CropSelectionPayload } from '../ui/crop/CropSelectionOverlay';
import { CropLauncher } from '../ui/crop/CropLauncher';
import type { PreparedCropDrag } from '../ui/crop/CropDragTransport';
import { readerAbortError } from '../reader/ReaderCancellation';

export interface PdfCropRequest {
	/** Zero-based source page, independent of the last rendered page. */
	page: number;
	rect: NormalizedPdfRect;
	rotation: number;
	viewport: PageViewport;
}
/** Overlay rectangles are displayed-space fractions; persist canonical PDF space. */
export function freezeCropRequest(payload: CropSelectionPayload, viewport: PageViewport): PdfCropRequest {
	const rect = payload.rect;
	if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1 || rect.y + rect.height > 1) throw new Error('裁剪区域无效。');
	const canonical = normalizeClientRect({ left: rect.x * viewport.width, top: rect.y * viewport.height,
		right: (rect.x + rect.width) * viewport.width, bottom: (rect.y + rect.height) * viewport.height } as DOMRect,
		{ left: 0, top: 0 } as DOMRect, viewport);
	return { page: payload.page, rect: canonical, rotation: viewport.rotation, viewport: viewport.clone() };
}
export interface ReaderCropIO {
	surface: PageSurface;
	page: number;
	prepare(payload: CropSelectionPayload, request: PdfCropRequest): Promise<PreparedCropDrag>;
	commit(token: string): Promise<void>;
	discard(token: string): Promise<void>;
}
/** Per-leaf crop lifetime freezes geometry before the user changes scale or page. */
export class ReaderCropController {
	private readonly launcher = new CropLauncher();
	private request: AbortController | null = null;
	destroy(): void { this.request?.abort(); this.request = null; this.launcher.destroy(); }
	async enter(io: ReaderCropIO): Promise<void> {
		this.destroy();
		const request = new AbortController(); this.request = request;
		const host = await io.surface.ensurePageRendered(io.page, request.signal);
		const measured = io.surface.viewportForPage(io.page);
		if (!host || !measured || request.signal.aborted) return;
		const viewport = measured.clone();
		await this.launcher.enter({
			ensureRenderedHost: async () => request.signal.aborted ? null : host,
			prepareCrop: async payload => {
				if (request.signal.aborted || payload.page !== io.page - 1) throw readerAbortError();
				const frozen = freezeCropRequest(payload, viewport);
				return io.prepare({ ...payload, rect: frozen.rect }, frozen);
			},
			commit: token => io.commit(token), discard: token => io.discard(token)
		});
	}
}
