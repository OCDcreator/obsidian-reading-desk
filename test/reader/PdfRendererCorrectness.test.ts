import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfRenderer } from '../../src/reader/PdfRenderer';
import { budgetCanvasSize, MAX_PAGE_PIXELS, MAX_READER_PIXELS, PdfCanvasBudget } from '../../src/reader/PdfCanvasBudget';
import { freezeCropRequest } from '../../src/crop/ReaderCropController';
import { deferred, flushReaderTasks, ReaderTestDocument, type ReaderTestElement } from './ReaderTestDom';
import { testViewport } from './TestViewport';
vi.mock('pdfjs-dist', () => ({
	getDocument: vi.fn(), GlobalWorkerOptions: {},
	TextLayer: class {
		textDivs: ReaderTestElement[] = [];
		constructor(private input: { textContentSource: { items: Array<{ str: string }> }; container: ReaderTestElement }) { }
		async render() { for (const item of this.input.textContentSource.items) { const span = this.input.container.createEl('span', { text: item.str }); this.textDivs.push(span); } }
	}
}));
let doc: ReaderTestDocument;
beforeEach(() => { doc = new ReaderTestDocument(); vi.stubGlobal('document', doc); });
afterEach(() => vi.unstubAllGlobals());
function fixture() {
	const renderTasks: Array<ReturnType<typeof deferred<void>>> = [];
	const page = { getViewport: vi.fn(({ scale, rotation }: { scale: number; rotation: number }) => testViewport(rotation, scale)),
		render: vi.fn(() => { const task = deferred<void>(); renderTasks.push(task); return { promise: task.promise, cancel: vi.fn() }; }),
		getTextContent: vi.fn(async () => ({ items: [{ str: 'actual text', hasEOL: false }] })), getAnnotations: vi.fn(async () => []) };
	const pdf = { numPages: 600, getPage: vi.fn(async () => page), getDestination: vi.fn(), getPageIndex: vi.fn(), destroy: vi.fn() };
	const renderer = new PdfRenderer({ readBinary: async () => new ArrayBuffer(0), resourceUrl: () => null });
	Object.assign(renderer, { document: pdf }); return { renderer, pdf, page, renderTasks };
}
describe('PDF render ownership and pixel budget', () => {
	it('late scale epoch raster never replaces the current target', async () => {
		const f = fixture(); const target = doc.body.createDiv(); target.textContent = 'prior DOM';
		const old = f.renderer.renderPage(1, target as unknown as HTMLElement, []); await flushReaderTasks();
		f.renderer.setScale(2); f.renderTasks[0].resolve(); expect(await old).toBeNull(); expect(target.textContent).toBe('prior DOM');
	});
	it('same-target supersession keeps the latest result while different pages render concurrently', async () => {
		const f = fixture(); const target = doc.body.createDiv(); const second = doc.body.createDiv();
		const old = f.renderer.renderPage(1, target as unknown as HTMLElement, []); await flushReaderTasks();
		const newest = f.renderer.renderPage(2, target as unknown as HTMLElement, []); const other = f.renderer.renderPage(3, second as unknown as HTMLElement, []); await flushReaderTasks();
		f.renderTasks[1].resolve(); f.renderTasks[2].resolve(); expect((await newest)?.page).toBe(2); expect((await other)?.page).toBe(3);
		const currentCanvas = target.querySelector('canvas'); f.renderTasks[0].resolve(); expect(await old).toBeNull(); expect(target.querySelector('canvas')).toBe(currentCanvas);
	});
	it('explicit crop gets page 7 with frozen 90 degrees despite page 99 being last rendered', async () => {
		const f = fixture(); Object.assign(f.renderer, { renderedPageNumber: 99, rotation: 180, scale: 3 });
		const request = freezeCropRequest({ page: 6, rect: { x: 0.2, y: 0.3, width: 0.4, height: 0.2 }, target: 'canvas' }, testViewport(90, 2));
		const crop = f.renderer.renderCrop(request); await flushReaderTasks(); f.renderTasks[0].resolve(); const blob = await crop;
		expect(blob.type).toBe('image/png'); expect(f.pdf.getPage).toHaveBeenCalledWith(7);
		expect(f.page.getViewport).toHaveBeenCalledWith({ scale: 2, rotation: 90 });
	});
	it('clamps high DPI and enlarged pages to both per-page and live renderer budgets', () => {
		const size = budgetCanvasSize(20_000, 30_000, 4); expect(size.width * size.height).toBeLessThanOrEqual(MAX_PAGE_PIXELS); expect(size.ratio).toBeLessThan(1);
		const manager = new PdfCanvasBudget(); const canvases: ReaderTestElement[] = [];
		for (let index = 0; index < 6; index += 1) { const canvas = doc.body.createEl('canvas'); manager.allocate(canvas as unknown as HTMLCanvasElement, 2000, 2000, 4); canvases.push(canvas); }
		expect(canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0)).toBeLessThanOrEqual(MAX_READER_PIXELS);
		expect(() => manager.allocate(doc.createElement('canvas') as unknown as HTMLCanvasElement, 2000, 2000, 4)).toThrow('预算');
		manager.release(canvases[0] as unknown as HTMLCanvasElement); expect(canvases[0].width).toBe(0);
	});
	it('completed detached staging survives another concurrent allocation until adopted', async () => {
		const f = fixture(); const stagingA = doc.createElement('div'); const stagingB = doc.createElement('div');
		const renderA = f.renderer.renderPage(1, stagingA as unknown as HTMLElement, []); await flushReaderTasks();
		f.renderTasks[0].resolve(); await renderA;
		const canvasA = stagingA.querySelector('canvas'); const widthA = canvasA?.width;
		const renderB = f.renderer.renderPage(2, stagingB as unknown as HTMLElement, []); await flushReaderTasks();
		expect(canvasA?.width).toBe(widthA); expect(canvasA?.width).toBeGreaterThan(0);
		f.renderTasks[1].resolve(); await renderB;
		const hostA = doc.body.createDiv(); const hostB = doc.body.createDiv();
		hostA.replaceChildren(...stagingA.childNodes); hostB.replaceChildren(...stagingB.childNodes);
		f.renderer.adoptTarget(hostA as unknown as HTMLElement); f.renderer.adoptTarget(hostB as unknown as HTMLElement);
		expect(canvasA?.width).toBe(widthA); expect(hostB.querySelector('canvas')?.width).toBeGreaterThan(0);
	});
	it('only canvases that were connected and later removed are swept', () => {
		const manager = new PdfCanvasBudget(); const staging = doc.createElement('canvas'); const old = doc.body.createEl('canvas');
		manager.allocate(staging as unknown as HTMLCanvasElement, 200, 100, 2); manager.complete(staging as unknown as HTMLCanvasElement);
		manager.allocate(old as unknown as HTMLCanvasElement, 200, 100, 2); manager.complete(old as unknown as HTMLCanvasElement); manager.adopt(old as unknown as HTMLCanvasElement); old.remove();
		manager.allocate(doc.createElement('canvas') as unknown as HTMLCanvasElement, 200, 100, 2);
		expect(staging.width).toBeGreaterThan(0); expect(old.width).toBe(0);
	});

});
