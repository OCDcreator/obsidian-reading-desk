import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfRenderer } from '../../src/reader/PdfRenderer';
import { ThumbnailObserverLifecycle } from '../../src/reader/ReaderNavigation';
import { ReaderTestDocument, deferred, flushReaderTasks } from './ReaderTestDom';
import { testViewport } from './TestViewport';
vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {}, TextLayer: class { textDivs: never[] = []; async render() { return undefined; } } }));
afterEach(() => vi.unstubAllGlobals());
function fixture() {
	const doc = new ReaderTestDocument(); vi.stubGlobal('document', doc);
	const page = { getViewport: ({ scale, rotation }: { scale: number; rotation: number }) => ({ ...testViewport(rotation, scale), width: 600 * scale, height: 800 * scale }), render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })), getTextContent: async () => ({ items: [] }), getAnnotations: async () => [] };
	const renderer = new PdfRenderer({ readBinary: async () => new ArrayBuffer(0), resourceUrl: () => null });
	Object.assign(renderer, { document: { numPages: 600, getPage: async () => page, destroy: vi.fn() } });
	let callback: IntersectionObserverCallback = () => undefined;
	const observer = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
	const lifecycle = new ThumbnailObserverLifecycle(next => { callback = next; return observer as unknown as IntersectionObserver; });
	const sidebar = doc.body.createDiv();
	const canvases = Array.from({ length: 350 }, () => sidebar.createEl('canvas'));
	for (const [index, canvas] of canvases.entries()) lifecycle.observe(canvas as unknown as HTMLCanvasElement, index + 1, sidebar as unknown as HTMLElement,
		(target, number, signal) => renderer.renderThumbnail(number, target, 148, signal), target => renderer.releaseTarget(target));
	const show = (index: number, visible: boolean) => callback([{ isIntersecting: visible, target: canvases[index] } as unknown as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
	return { doc, page, renderer, lifecycle, canvases, show };
}
describe('bounded thumbnail sidebar', () => {
	it('scrolls top to bottom to top without blocking the main page or retaining departed canvases', async () => {
		const f = fixture();
		for (let index = 0; index < f.canvases.length; index += 1) {
			if (index) f.show(index - 1, false);
			f.show(index, true); await flushReaderTasks();
			if (index) expect(f.canvases[index - 1].width).toBe(0);
		}
		f.show(349, false); f.show(0, true); await flushReaderTasks();
		expect(f.canvases[0].width).toBeGreaterThan(0);
		await expect(f.renderer.renderPage(301, f.doc.body.createDiv() as unknown as HTMLElement, [])).resolves.not.toBeNull();
		f.lifecycle.destroy(); expect(f.canvases.every(canvas => canvas.width === 0)).toBe(true);
	});
	it('does not republish an in-flight thumbnail after leaving or closing the sidebar', async () => {
		const f = fixture(); const raster = deferred<void>();
		f.page.render.mockImplementation(() => ({ promise: raster.promise, cancel: vi.fn() }));
		f.show(0, true); await flushReaderTasks(); f.show(0, false);
		f.lifecycle.destroy(); raster.resolve(); await flushReaderTasks();
		expect(f.canvases[0].width).toBe(0); expect(f.canvases[0].dataset.rendered).toBeUndefined();
	});
	it('keeps cancelled raster memory until PDF.js settles and starts returning thumbnails afterward', async () => {
		const f = fixture(); const raster = deferred<void>();
		f.page.render.mockImplementation(() => ({ promise: raster.promise, cancel: vi.fn() }));
		f.show(0, true); await flushReaderTasks();
		const manager = (f.renderer as unknown as { canvasBudget: { canvases: Map<{ width: number; height: number }, unknown> } }).canvasBudget;
		const staging = Array.from(manager.canvases.keys())[0];
		f.show(0, false); f.show(0, true); await flushReaderTasks();
		expect(staging.width * staging.height).toBeGreaterThan(0); expect(f.page.render).toHaveBeenCalledOnce();
		raster.resolve(); await flushReaderTasks();
		expect(f.page.render).toHaveBeenCalledTimes(2); expect(f.canvases[0].width).toBeGreaterThan(0);
		f.lifecycle.destroy();
	});
	it('reserves copy capacity for concurrently visible thumbnails while protecting main rendering', async () => {
		const f = fixture();
		for (let index = 0; index < 12; index += 1) f.show(index, true);
		for (let round = 0; round < 12; round += 1) await flushReaderTasks();
		for (const canvas of f.canvases.slice(0, 12)) { expect(canvas.width).toBeGreaterThan(0); expect(canvas.dataset.renderError).toBeUndefined(); }
		await expect(f.renderer.renderPage(301, f.doc.body.createDiv() as unknown as HTMLElement, [])).resolves.not.toBeNull();
		f.lifecycle.destroy();
	});
	it('cannot spend the main-page reserve even if connected thumbnail clients never evict', async () => {
		const f = fixture();
		for (let index = 0; index < 100; index += 1) {
			try { await f.renderer.renderThumbnail(index + 1, f.canvases[index] as unknown as HTMLCanvasElement, 148); }
			catch { break; }
		}
		const pixels = f.canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);
		expect(pixels).toBeLessThanOrEqual(3_000_000);
		await expect(f.renderer.renderPage(301, f.doc.body.createDiv() as unknown as HTMLElement, [])).resolves.not.toBeNull();
		f.lifecycle.destroy();
	});
	it('does not complete an old document thumbnail after the renderer closes', async () => {
		const f = fixture(); const raster = deferred<void>(); f.page.render.mockImplementation(() => ({ promise: raster.promise, cancel: vi.fn() }));
		f.show(0, true); await flushReaderTasks(); const closing = f.renderer.close(); raster.resolve(); await closing; await flushReaderTasks();
		expect(f.canvases[0].width).toBe(0); expect(f.canvases[0].dataset.rendered).toBeUndefined();
		f.lifecycle.destroy();
	});
});
