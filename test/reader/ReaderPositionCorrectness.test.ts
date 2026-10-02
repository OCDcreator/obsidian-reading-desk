import { describe, expect, it, vi } from 'vitest';
import { ReaderPositionController } from '../../src/reader/ReaderPositionController';
import { ReaderHistory } from '../../src/reader/ReaderHistory';
import { deferred, flushReaderTasks, ReaderTestDocument } from './ReaderTestDom';
import { testViewport } from './TestViewport';
describe('precise reader positions and cold highlights', () => {
	it('history restores source and destination offsets including same-page jumps', async () => {
		const doc = new ReaderTestDocument(); const stage = doc.body.createDiv(); let currentPage = 1;
		const host = doc.createElement('div'); host.getBoundingClientRect = () => ({ left: -stage.scrollLeft, top: (currentPage - 1) * 100 - stage.scrollTop, width: 200, height: 100, right: 200 - stage.scrollLeft, bottom: currentPage * 100 - stage.scrollTop });
		const surface = { stage, hostForPage: () => host, goToPage: async (page: number) => { stage.scrollTop = (page - 1) * 100; }, ensurePageRendered: async () => host };
		const history = new ReaderHistory(); const controller = new ReaderPositionController({ surface: () => surface as never, pdf: () => ({ pageViewport: async () => testViewport() }) as never, page: () => currentPage, pageCount: () => 10, setPage: page => { currentPage = page; }, history, changed: vi.fn(), showTarget: vi.fn(), onError: vi.fn() });
		stage.scrollTop = 40;
		await controller.goTo(9, { jump: true, location: { page: 9, x: 0.2, y: 0.65 } }); expect(stage.scrollTop).toBe(865);
		await controller.history(-1); expect(currentPage).toBe(1); expect(stage.scrollTop).toBe(40);
		await controller.history(1); expect(currentPage).toBe(9); expect(stage.scrollTop).toBe(865); expect(stage.scrollLeft).toBe(40);
		await controller.goTo(9, { jump: true, location: { page: 9, x: 0.1, y: 0.1 } }); expect(history.canBack()).toBe(true);
		await controller.history(-1); expect(stage.scrollTop).toBe(865);
	});
	it('keeps signed offsets when the center page begins below the viewport top', async () => {
		const stage = { scrollTop: 80, scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) };
		let page = 2;
		const tops = [0, 116, 432, 498, 914, 1030, 1146, 1262];
		const heights = [100, 300, 50, 400, 100, 100, 100, 100];
		const hostForPage = (requested: number) => ({ getBoundingClientRect: () => ({ left: 0, top: tops[requested - 1] - stage.scrollTop, width: 200, height: heights[requested - 1] }) });
		const surface = { stage, hostForPage, goToPage: async (requested: number) => { stage.scrollTop = tops[requested - 1]; }, ensurePageRendered: async (requested: number) => hostForPage(requested) };
		const controller = new ReaderPositionController({ surface: () => surface as never, pdf: () => ({}) as never, page: () => page, pageCount: () => 8, setPage: next => { page = next; }, history: new ReaderHistory(), changed: vi.fn(), showTarget: vi.fn(), onError: vi.fn() });
		expect(controller.capture().y).toBeCloseTo(-0.12);
		await controller.goTo(8, { jump: true });
		await controller.history(-1); expect(stage.scrollTop).toBe(80);
		await controller.history(1); expect(stage.scrollTop).toBe(1262);
	});
	it('two cold highlight jumps only focus/show the latest and wait for its render', async () => {
		const doc = new ReaderTestDocument(); const stage = doc.body.createDiv(); const old = deferred<HTMLElement | null>(); const next = deferred<HTMLElement | null>();
		const oldHost = doc.createElement('div'); const newHost = doc.createElement('div'); const oldMark = oldHost.createDiv(); oldMark.dataset.highlightId = 'old'; const newMark = newHost.createDiv(); newMark.dataset.highlightId = 'new';
		let page = 1; const surface = { stage, hostForPage: () => newHost, goToPage: async () => undefined, ensurePageRendered: (requested: number) => requested === 8 ? old.promise : next.promise };
		const showTarget = vi.fn(); const controller = new ReaderPositionController({ surface: () => surface as never, pdf: () => ({}) as never, page: () => page, pageCount: () => 20, setPage: next => { page = next; }, history: new ReaderHistory(), changed: vi.fn(), showTarget, onError: vi.fn() });
		const a = controller.focusHighlight({ id: 'old', page: 7, target: { path: 'old.md' } } as never).catch(error => error.name); await flushReaderTasks();
		const b = controller.focusHighlight({ id: 'new', page: 15, target: { path: 'new.md' } } as never); await flushReaderTasks();
		expect(showTarget).not.toHaveBeenCalled(); expect(newMark.scrollCount).toBe(0);
		next.resolve(newHost as unknown as HTMLElement); await b; old.resolve(oldHost as unknown as HTMLElement); expect(await a).toBe('AbortError');
		expect(oldMark.scrollCount).toBe(0); expect(newMark.scrollCount).toBe(1); expect(showTarget).toHaveBeenCalledOnce(); expect(showTarget).toHaveBeenCalledWith('new.md', undefined);
	});
	it('late destination resolution after cancellation never navigates', async () => {
		const viewport = deferred<ReturnType<typeof testViewport>>(); const doc = new ReaderTestDocument(); const surface = { stage: doc.body, hostForPage: () => doc.body, goToPage: vi.fn(), ensurePageRendered: vi.fn() };
		const controller = new ReaderPositionController({ surface: () => surface as never, pdf: () => ({ pageViewport: () => viewport.promise }) as never, page: () => 1, pageCount: () => 10, setPage: vi.fn(), history: new ReaderHistory(), changed: vi.fn(), showTarget: vi.fn(), onError: vi.fn() });
		const jump = controller.destination({ page: 7 }).catch(error => error.name); controller.cancel(); viewport.resolve(testViewport());
		expect(await jump).toBe('AbortError'); expect(surface.goToPage).not.toHaveBeenCalled();
	});
});
