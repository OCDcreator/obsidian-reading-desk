import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContinuousPageSurface } from '../../src/reader/ReaderPageDeck';
import { SinglePageSurface, type PageSurfaceIO } from '../../src/reader/PageSurface';
import { deferred, flushReaderTasks, ReaderTestDocument, type ReaderTestElement } from './ReaderTestDom';
import { testViewport } from './TestViewport';
import type { RenderedPage } from '../../src/reader/PdfRenderer';
let doc: ReaderTestDocument;
beforeEach(() => { doc = new ReaderTestDocument(); vi.stubGlobal('document', doc); });
afterEach(() => vi.unstubAllGlobals());
function fixture() {
	const tasks: Array<{ page: number; target: ReaderTestElement; request: ReturnType<typeof deferred<RenderedPage | null>>; signal?: AbortSignal }> = [];
	const pdf = { getScale: () => 1, pageViewport: async () => testViewport(),
		renderPage: vi.fn((page, target, _marks, options) => { const request = deferred<RenderedPage | null>(); tasks.push({ page, target, request, signal: options?.signal }); return request.promise; }),
		paintHighlights: vi.fn(), releaseTarget: vi.fn((host: ReaderTestElement) => { for (const canvas of host.querySelectorAll('canvas')) { canvas.width = 0; canvas.height = 0; } }), adoptTarget: vi.fn() };
	const io = { pdf, pageCount: 600, initialPage: 1, callbacks: { getHighlights: () => [], onPageChange: vi.fn(), onTextSignal: vi.fn(), onPageRendered: vi.fn() } } as unknown as PageSurfaceIO;
	const resolve = (index: number) => { const task = tasks[index]; task.target.createEl('canvas').width = 10; task.request.resolve({ page: task.page, container: task.target as unknown as HTMLElement, viewport: testViewport(), textSelectable: true }); };
	return { tasks, pdf, io, resolve };
}
describe('virtual page epochs and cancellation', () => {
	it('deduplicates in-flight ensure and discards a late page after jumping hundreds of pages', async () => {
		const f = fixture(); const surface = new ContinuousPageSurface(f.io); doc.body.append(surface.stage as unknown as ReaderTestElement);
		const initial = surface.render(); await flushReaderTasks(); const again = surface.ensurePageRendered(1);
		expect(f.pdf.renderPage).toHaveBeenCalledOnce(); f.resolve(0); await initial; await again;
		const abort = new AbortController(); const old = surface.goToPage(2, { signal: abort.signal }).catch(error => error.name); await flushReaderTasks();
		abort.abort(); expect(await old).toBe('AbortError');
		const far = surface.goToPage(500); await flushReaderTasks(); expect(f.tasks[1].signal?.aborted).toBe(true);
		f.resolve(2); await far; f.resolve(1); await flushReaderTasks();
		expect(surface.viewportForPage(2)).toBeNull(); expect(surface.hostForPage(2)?.querySelector('canvas')).toBeNull();
		expect(surface.viewportForPage(1)).toBeNull(); expect(surface.hostForPage(500)?.querySelector('canvas')).not.toBeNull();
	});
	it('scale epoch rejects old result then renders fresh viewport without old DOM commit', async () => {
		const f = fixture(); const surface = new ContinuousPageSurface(f.io); const initial = surface.render().catch(error => error.name); await flushReaderTasks();
		surface.relayoutPending(); expect(await initial).toBe('AbortError'); f.resolve(0); await flushReaderTasks();
		expect(surface.viewportForPage(1)).toBeNull(); expect(surface.hostForPage(1)?.querySelector('canvas')).toBeNull();
		expect(f.tasks).toHaveLength(2); f.resolve(1); await flushReaderTasks(); expect(surface.viewportForPage(1)).not.toBeNull();
	});
	it('destroy cancels waiters and late render cannot publish text or viewport', async () => {
		const f = fixture(); const surface = new ContinuousPageSurface(f.io); const initial = surface.render().catch(error => error.name); await flushReaderTasks();
		surface.destroy(); expect(await initial).toBe('AbortError'); f.resolve(0); await flushReaderTasks();
		expect(f.io.callbacks.onTextSignal).not.toHaveBeenCalled(); expect(surface.hostForPage(1)).toBeNull();
	});
	it('single-page late render cannot overwrite a newer page', async () => {
		const f = fixture(); const surface = new SinglePageSurface(f.io);
		const first = surface.render(); await flushReaderTasks(); const next = surface.goToPage(7); await flushReaderTasks();
		f.resolve(1); await next; f.resolve(0); await first;
		expect(surface.getPage()).toBe(7); expect(surface.hostForPage(7)?.dataset.page).toBe('7');
		expect(f.io.callbacks.onTextSignal).toHaveBeenCalledOnce(); expect(f.io.callbacks.onTextSignal).toHaveBeenCalledWith(7, true);
	});
});
