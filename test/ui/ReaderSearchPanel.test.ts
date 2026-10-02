import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderSearchPanel } from '../../src/ui/search/ReaderSearchPanel';
import { findPageHits } from '../../src/reader/ReaderSearchService';
import { deferred, flushReaderTasks, ReaderTestDocument } from '../reader/ReaderTestDom';

function fixture(run: (query: string, signal?: AbortSignal) => ReturnType<ReturnType<typeof vi.fn>>) {
	const doc = new ReaderTestDocument(); const host = { run: vi.fn(run), goTo: vi.fn(async () => undefined), cancel: vi.fn(), changed: vi.fn() };
	const panel = new ReaderSearchPanel(host); panel.mount(doc.body as unknown as HTMLElement); panel.show();
	const input = doc.body.querySelector('input'); if (!input) throw new Error('missing input'); input.value = 'needle';
	return { doc, host, panel, input };
}
afterEach(() => vi.useRealTimers());
describe('Reader search panel ownership and recovery', () => {
	it('close aborts pending work and late results never jump', async () => {
		const task = deferred<ReturnType<typeof findPageHits>>(); let signal: AbortSignal | undefined;
		const f = fixture(async (_query, request) => { signal = request; return task.promise; });
		const refresh = f.panel.refresh(); f.panel.close(); task.resolve(findPageHits(9, 'needle', 'needle')); await refresh;
		expect(signal?.aborted).toBe(true); expect(f.host.goTo).not.toHaveBeenCalled(); expect(f.panel.currentHit()).toBeNull();
	});
	it('repeated identical query generations allow only newest results and offsets', async () => {
		const old = deferred<ReturnType<typeof findPageHits>>(); const next = deferred<ReturnType<typeof findPageHits>>();
		const f = fixture(async () => old.promise); f.host.run.mockImplementationOnce(async () => old.promise).mockImplementationOnce(async () => next.promise);
		const a = f.panel.refresh(); const b = f.panel.refresh(); next.resolve(findPageHits(3, 'x needle', 'needle')); await b;
		old.resolve(findPageHits(1, 'needle', 'needle')); await a;
		expect(f.host.goTo).toHaveBeenCalledOnce(); expect(f.panel.currentHit()).toMatchObject({ page: 3, start: 2, end: 8 });
	});
	it('rejection recovers on next query and reset invalidates pending navigation', async () => {
		const f = fixture(async () => { throw new Error('text extraction'); }); await f.panel.refresh();
		expect(f.doc.body.querySelector('.rd-search-panel__status')?.textContent).toContain('失败');
		f.host.run.mockResolvedValue(findPageHits(7, 'needle needle', 'needle')); await f.panel.refresh();
		expect(f.host.goTo).toHaveBeenCalledOnce(); await f.panel.step(1); expect(f.panel.currentHit()?.start).toBe(7);
		const task = deferred<ReturnType<typeof findPageHits>>(); f.host.run.mockReturnValue(task.promise);
		const refresh = f.panel.refresh(); f.panel.reset(); task.resolve(findPageHits(99, 'needle', 'needle')); await refresh;
		expect(f.panel.currentQuery()).toBe(''); expect(f.host.goTo).toHaveBeenCalledTimes(2);
	});
	it('all 100 hits remain navigable while only sixty centered rows are displayed', async () => {
		const f = fixture(async () => findPageHits(1, Array.from({ length: 100 }, () => 'needle').join(' '), 'needle'));
		await f.panel.refresh(); await f.panel.step(-1);
		expect(f.panel.currentHit()?.start).toBe(99 * 7);
		expect(f.doc.body.querySelectorAll('.rd-search-panel__hit')).toHaveLength(60);
		expect(f.doc.body.querySelector('.rd-search-panel__status')?.textContent).toBe('100 / 100 处');
		await flushReaderTasks();
	});
});
