/** Bound DPR by both one-canvas and renderer-wide live backing-store pixels. */
export const MAX_PAGE_PIXELS = 4_000_000;
export const MAX_READER_PIXELS = 24_000_000;
/** Thumbnail pixels share the total cap but cannot consume the display reserve. */
export const MAX_THUMBNAIL_PIXELS = 3_000_000;
export const THUMBNAIL_PAGE_PIXELS = 200_000;
/** Nine retained pages plus two replacement tasks leave space for crop/preview. */
export const DISPLAY_PAGE_PIXELS = 1_500_000;
export function budgetCanvasSize(width: number, height: number, dpr: number, budget = MAX_PAGE_PIXELS): { width: number; height: number; ratio: number } {
	if (![width, height, budget].every(Number.isFinite) || width <= 0 || height <= 0 || budget < 1) throw new Error('PDF 画布预算不足。');
	const ratio = Math.min(Math.max(0.01, Number.isFinite(dpr) ? dpr : 1), Math.sqrt(Math.min(budget, MAX_PAGE_PIXELS) / (Math.ceil(width) * Math.ceil(height))));
	const pixelWidth = Math.max(1, Math.floor(Math.ceil(width) * ratio));
	const pixelHeight = Math.max(1, Math.min(Math.floor(budget / pixelWidth), Math.floor(Math.ceil(height) * ratio)));
	return { width: pixelWidth, height: pixelHeight, ratio: Math.min(pixelWidth / width, pixelHeight / height) };
}
interface CanvasAllocation {
	thumbnail: boolean;
	reservedPixels: number;
	complete: boolean;
	adopted: boolean;
	everConnected: boolean;
}
export class PdfCanvasBudget {
	private readonly canvases = new Map<HTMLCanvasElement, CanvasAllocation>();
	allocate(canvas: HTMLCanvasElement, width: number, height: number, dpr: number, limit = MAX_PAGE_PIXELS, thumbnail = false, reserveCopy = false): number {
		if (this.canvases.has(canvas)) this.release(canvas);
		for (const [existing, allocation] of this.canvases) {
			allocation.everConnected ||= existing.isConnected;
			// A completed detached staging target still belongs to its waiting deck
			// task. Only canvas stores that actually left the DOM may be swept.
			if (allocation.complete && allocation.everConnected && !existing.isConnected) this.release(existing);
		}
		let used = 0; let thumbnailUsed = 0;
		for (const [existing, allocation] of this.canvases) {
			const pixels = existing.width * existing.height + allocation.reservedPixels; used += pixels;
			if (allocation.thumbnail) thumbnailUsed += pixels;
		}
		const available = thumbnail ? Math.min(MAX_THUMBNAIL_PIXELS - thumbnailUsed, MAX_READER_PIXELS - used) : MAX_READER_PIXELS - used;
		const size = budgetCanvasSize(width, height, dpr, Math.min(limit, Math.floor(available / (reserveCopy ? 2 : 1))));
		canvas.width = size.width; canvas.height = size.height;
		this.canvases.set(canvas, { complete: false, adopted: false, everConnected: canvas.isConnected, thumbnail, reservedPixels: reserveCopy ? canvas.width * canvas.height : 0 });
		return size.ratio;
	}
	/** Convert reserved copy capacity into a second backing store before drawing. */
	copyTarget(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
		const allocation = this.canvases.get(source);
		if (!allocation || allocation.reservedPixels < source.width * source.height) throw new Error('缩略图复制预算未预留。');
		this.release(target); allocation.reservedPixels = 0;
		target.width = source.width; target.height = source.height;
		this.canvases.set(target, { ...allocation, complete: false, adopted: false, everConnected: target.isConnected });
	}
	/** Raster completion never transfers ownership away from detached staging. */
	complete(canvas: HTMLCanvasElement): void {
		const allocation = this.canvases.get(canvas); if (!allocation) return;
		allocation.complete = true; allocation.everConnected ||= canvas.isConnected;
	}
	/** Surface commit transfers the canvas to its page host. */
	adopt(canvas: HTMLCanvasElement): void {
		const allocation = this.canvases.get(canvas); if (!allocation) return;
		allocation.adopted = true; allocation.everConnected ||= canvas.isConnected;
	}
	release(canvas: HTMLCanvasElement): void { canvas.width = 0; canvas.height = 0; this.canvases.delete(canvas); }
	releaseTarget(target: HTMLElement): void {
		if (target.tagName === 'CANVAS') this.release(target as HTMLCanvasElement);
		for (const canvas of Array.from(target.querySelectorAll('canvas'))) this.release(canvas);
	}
	clear(): void { for (const canvas of this.canvases.keys()) this.release(canvas); }
}
