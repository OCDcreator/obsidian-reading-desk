import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfRenderer } from '../../src/reader/PdfRenderer';
import { paintPdfLinks, resolvePdfDestination, safePdfExternalUrl } from '../../src/reader/PdfLinks';
import { ReaderLinkPreview } from '../../src/reader/ReaderLinkPreview';
import { ReaderPositionController } from '../../src/reader/ReaderPositionController';
import { ReaderHistory } from '../../src/reader/ReaderHistory';
import { deferred, flushReaderTasks, ReaderTestDocument, ReaderTestElement } from './ReaderTestDom';
import { testViewport } from './TestViewport';
import { FakeEvent } from '../support/fake-dom';
afterEach(() => vi.unstubAllGlobals());
describe('safe PDF annotation links and previews', () => {
	it('resolves page zero, named XYZ and page-internal coordinates', async () => {
		const pdf = { numPages: 10, getDestination: vi.fn(async () => [0, { name: 'XYZ' }, 20, 70, null]), getPageIndex: vi.fn(async () => 4) };
		expect(await resolvePdfDestination(pdf as never, 'footnote')).toEqual({ page: 1, x: 20, y: 70 });
		expect(await resolvePdfDestination(pdf as never, [{ num: 12 }, { name: 'FitH' }, 40])).toEqual({ page: 5, y: 40 });
		expect(await resolvePdfDestination(pdf as never, [99, { name: 'Fit' }])).toBeNull();
	});
	it('filters JavaScript/actions/custom schemes and paints only safe explicit links', async () => {
		const doc = new ReaderTestDocument(); const annotations = [
			{ id: 'a', subtype: 'Link', rect: [0, 60, 40, 80], dest: [0, { name: 'XYZ' }, 10, 60] },
			{ id: 'b', subtype: 'Link', rect: [0, 20, 50, 40], url: 'https://example.com', newWindow: true },
			{ id: 'c', subtype: 'Link', rect: [0, 0, 10, 10], url: 'javascript:alert(1)' },
			{ id: 'd', subtype: 'Link', rect: [0, 0, 10, 10], url: 'https://example.com', actions: { JS: ['evil()'] } },
			{ id: 'e', subtype: 'Link', rect: [0, 0, 10, 10], url: 'file:///private' }
		];
		const pdf = { numPages: 10, getPage: vi.fn(async () => ({ getAnnotations: vi.fn(async () => annotations) })) };
		const renderer = new PdfRenderer({ readBinary: async () => new ArrayBuffer(0), resourceUrl: () => null }); Object.assign(renderer, { document: pdf });
		const links = await renderer.pageLinks(1); expect(links).toHaveLength(2);
		const host = doc.body.createDiv(); paintPdfLinks(host as unknown as HTMLElement, testViewport(), links);
		expect(host.querySelectorAll('[data-pdf-link]')).toHaveLength(1); expect(host.querySelectorAll('[data-pdf-preview]')).toHaveLength(1);
		const anchor = host.querySelector('a') as ReaderTestElement & { href: string; target: string; rel: string };
		expect(anchor.href).toBe('https://example.com/'); expect(anchor.rel).toBe('noopener noreferrer'); expect(anchor.target).toBe('_blank');
		expect(safePdfExternalUrl('data:text/html,evil')).toBeNull(); expect(safePdfExternalUrl('obsidian://open')).toBeNull();
		expect(safePdfExternalUrl('https:\n//evil')).toBeNull();
	});
	it('preview neither jumps nor adds history, closes on Escape and offers explicit open', async () => {
		const doc = new ReaderTestDocument(); const origin = doc.body.createEl('button'); const open = vi.fn(async () => undefined);
		const pdf = { pageViewport: vi.fn(async () => testViewport()), renderPage: vi.fn(async () => ({ viewport: testViewport() })), releaseTarget: vi.fn() };
		const preview = new ReaderLinkPreview(); const reader = doc.body.createDiv(); reader.scrollTop = 45;
		await preview.show(reader as unknown as HTMLElement, pdf as never, { page: 3, y: 50 }, origin as unknown as HTMLElement, open);
		expect(open).not.toHaveBeenCalled(); expect(reader.scrollTop).toBe(45);
		expect(pdf.renderPage).toHaveBeenCalledWith(3, expect.anything(), [], expect.objectContaining({ links: false, scale: 0.8 }));
		const root = reader.querySelector('.rd-pdf-preview'); root?.dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
		expect(reader.querySelector('.rd-pdf-preview')).toBeNull(); expect(doc.activeElement).toBe(origin);
		await preview.show(reader as unknown as HTMLElement, pdf as never, { page: 3 }, origin as unknown as HTMLElement, open);
		const jump = reader.querySelectorAll('button').find(button => button.textContent === '打开此位置'); jump?.click(); await flushReaderTasks();
		expect(open).toHaveBeenCalledOnce(); expect(reader.querySelector('.rd-pdf-preview')).toBeNull();
	});
	it('closing a late preview frees its canvas and never reopens it', async () => {
		const doc = new ReaderTestDocument(); const task = deferred<{ viewport: ReturnType<typeof testViewport> }>();
		let renderHost: ReaderTestElement | undefined; let signal: AbortSignal | undefined;
		const pdf = { pageViewport: async () => testViewport(), renderPage: vi.fn(async (_page, host, _marks, options) => { renderHost = host; signal = options.signal; return task.promise; }),
			releaseTarget: vi.fn((host: ReaderTestElement) => { for (const canvas of host.querySelectorAll('canvas')) canvas.width = 0; }) };
		const preview = new ReaderLinkPreview(); const showing = preview.show(doc.body as unknown as HTMLElement, pdf as never, { page: 2 }, doc.body.createEl('button') as unknown as HTMLElement, async () => undefined);
		await flushReaderTasks(); preview.close(); const canvas = renderHost?.createEl('canvas'); if (canvas) canvas.width = 100;
		task.resolve({ viewport: testViewport() }); await showing;
		expect(signal?.aborted).toBe(true); expect(canvas?.width).toBe(0); expect(doc.body.querySelector('.rd-pdf-preview')).toBeNull();
	});
	it('click internal link performs a jump; preview action only opens a temporary dialog', async () => {
		const doc = new ReaderTestDocument(); const stage = doc.body.createDiv(); const pdf = { pageViewport: async () => testViewport(), renderPage: async () => ({ viewport: testViewport() }), releaseTarget: vi.fn() };
		const surface = { stage, hostForPage: () => stage, goToPage: vi.fn(async () => undefined), ensurePageRendered: vi.fn(async () => stage) };
		let page = 1; const history = new ReaderHistory(); const controller = new ReaderPositionController({ surface: () => surface as never, pdf: () => pdf as never, page: () => page, pageCount: () => 10, setPage: next => { page = next; }, history, changed: vi.fn(), showTarget: vi.fn(), onError: vi.fn() });
		controller.bindLinks(stage as unknown as HTMLElement); paintPdfLinks(stage as unknown as HTMLElement, testViewport(), [{ id: 'note', rect: [0, 50, 10, 60], destination: { page: 4, y: 60 } }]);
		stage.querySelector('[data-pdf-preview]')?.click(); await flushReaderTasks(); expect(surface.goToPage).not.toHaveBeenCalled(); expect(history.canBack()).toBe(false);
		stage.querySelector('[data-pdf-link]')?.click(); await flushReaderTasks(); expect(surface.goToPage).toHaveBeenCalledWith(4, expect.anything()); expect(history.canBack()).toBe(true);
	});
});
