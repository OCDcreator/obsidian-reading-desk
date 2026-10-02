import { describe, expect, it, vi } from 'vitest';
import { ReaderView } from '../../src/views/ReaderView';
import { ReaderSessionState } from '../../src/reader/ReaderSessionState';
import { ReaderOpenRequests } from '../../src/reader/ReaderOpenRequests';
import { ReaderViewLifecycle } from '../../src/reader/ReaderViewLifecycle';
import { ReaderOutlineLoader } from '../../src/reader/ReaderOutlineLoader';
import { ReaderPersistenceController } from '../../src/reader/ReaderPersistenceController';
import { ReaderHistory } from '../../src/reader/ReaderHistory';
import { ReaderPageLabels } from '../../src/reader/ReaderPageLabels';
import { createPageCitation } from '../../src/reader/ReadingDeskLinks';
import type { ReaderSavedPosition } from '../../src/types/contracts';
const saved: ReaderSavedPosition = { page: 6, x: -0.12, y: 0.64, rotation: 90, scale: 1.8, fitMode: 'manual', updatedAt: 1 };
function fixture(position: ReaderSavedPosition | undefined = saved) {
	const order: string[] = [];
	const pdf = { open: async () => 20, close: vi.fn(async () => undefined), getOutline: async () => [], pageLabels: async () => ['i', 'ii', '1'] };
	const view = Object.create(ReaderView.prototype) as ReaderView & Record<string, unknown>;
	Object.assign(view, { pdf, session: new ReaderSessionState(), labels: new ReaderPageLabels(), openRequests: new ReaderOpenRequests(), lifecycle: new ReaderViewLifecycle(),
		outlineLoader: new ReaderOutlineLoader(), history: new ReaderHistory(), outlineSyncedTargets: new Set(), surface: null,
		tools: { resetForDocument: vi.fn() }, positions: { cancel: vi.fn(), goTo: vi.fn(async () => { order.push('offset'); }) },
		persistence: { changed: vi.fn(), leave: vi.fn(async () => undefined), begin: () => position, activate: vi.fn() },
		display: { restoreRotation: vi.fn(() => order.push('rotation')) }, fitController: { restore: vi.fn(() => order.push('scale/fit')) },
		host: { createPdfRenderer: () => pdf, copyPageLink: vi.fn() }, render: vi.fn(async () => { order.push('page'); }) });
	return { view, order };
}
describe('saved reader navigation wiring', () => {
	it('reopens with rotation then scale/fit then physical page and exact signed offset', async () => {
		const { view, order } = fixture(); await view.openPdf('book.pdf');
		expect(order).toEqual(['rotation', 'scale/fit', 'page', 'offset']);
		expect(view.getState()).toEqual({ pdfPath: 'book.pdf', page: 7 });
		expect((view['positions'] as { goTo: unknown }).goTo).toHaveBeenCalledWith(7, { smooth: false, location: { page: 7, x: -0.12, y: 0.64 } });
	});
	it('preserves fit modes and honors explicit physical page links over a saved location', async () => {
		const { view, order } = fixture({ ...saved, fitMode: 'width' }); await view.openPdf('book.pdf', 3);
		expect(order).toEqual(['rotation', 'page']); expect(view.getState()).toEqual({ pdfPath: 'book.pdf', page: 3 });
		await view.copyCurrentPageLink(); expect((view['host'] as { copyPageLink: unknown }).copyPageLink).toHaveBeenCalledWith('book.pdf', 3, '1');
	});
	it('opens legacy data at its requested page and defaults to physical page one', async () => {
		const { view } = fixture(undefined); (view['persistence'] as { begin: () => undefined }).begin = () => undefined;
		await view.openPdf('legacy.pdf'); expect(view.getState()).toEqual({ pdfPath: 'legacy.pdf', page: 1 });
	});
	it('resumes scroll persistence after a failed bookmark restore without saving failed geometry', async () => {
		const { view } = fixture(); const stage = new EventTarget() as HTMLElement; const savePosition = vi.fn(async () => undefined);
		const persistence = new ReaderPersistenceController({ port: { read: () => ({ bookId: 'a', path: 'book.pdf', bookmarks: [] }), savePosition, saveBookmark: vi.fn(), removeBookmark: vi.fn() }, capture: () => ({ ...saved, page: 9 }), restore: vi.fn(), error: vi.fn() });
		persistence.begin('book.pdf'); persistence.activate(stage);
		Object.assign(view, { persistence, surface: { stage }, pages: 20, cropLauncher: { destroy: vi.fn() }, rebuildSurface: vi.fn(async () => { throw new Error('render failed'); }) });
		await expect((view as unknown as { restorePosition(position: ReaderSavedPosition): Promise<void> }).restorePosition(saved)).rejects.toThrow('render failed');
		await persistence.flush(); expect(savePosition).not.toHaveBeenCalled();
		stage.dispatchEvent(new Event('scroll')); await persistence.leave(); expect(savePosition).toHaveBeenCalledWith('a', expect.objectContaining({ page: 9 }));
	});
	it('does not let the old navigation mode overwrite an explicitly selected tab', () => {
		const { view } = fixture(); const old = { getMode: () => 'outline', destroy: vi.fn() }; const modes: string[] = [];
		Object.assign(view, { navigationMode: 'outline', readerNavigation: old, navigationContainer: {}, attachNavigation: () => { modes.push(view['readerNavigation'] ? 'stale-outline' : String(view['navigationMode'])); } });
		view.setPreferredNavigationMode('thumbnails'); expect(modes).toEqual(['thumbnails']); expect(old.destroy).toHaveBeenCalledOnce();
	});
	it('writes progress through reader state once and does not timestamp passive workspace restores', async () => {
		const { view } = fixture(); const changed = vi.fn(); const recordProgress = vi.fn();
		Object.assign(view, { surface: { stage: new EventTarget() }, controls: null, readerNavigation: null });
		Object.assign(view['persistence'] as object, { changed }); Object.assign(view['host'] as object, { readerState: {}, recordProgress });
		await view.openPdf('book.pdf', 7, true); expect(changed).not.toHaveBeenCalled();
		await view.openPdf('book.pdf', 7); expect(changed).toHaveBeenCalledOnce();
		Object.assign(view['positions'] as object, { recordPageChanged: vi.fn() });
		(view as unknown as { handlePageChanged(page: number): void }).handlePageChanged(8);
		expect(recordProgress).not.toHaveBeenCalled(); expect(changed).toHaveBeenCalledTimes(2);
	});
	it('copies an escaped printed label while keeping the original physical destination', () => {
		const citation = createPageCitation({ file: 'a.pdf', page: 7, pageLabel: 'iv [appendix]\nline' });
		expect(citation).toContain('[第 iv \\[appendix\\] line 页]'); expect(citation).toContain('page=7');
		expect(createPageCitation({ file: 'a.pdf', page: 7, pageLabel: '7' })).toMatch(/^obsidian:/);
	});
});
