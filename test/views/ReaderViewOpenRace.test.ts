import { describe, expect, it, vi } from 'vitest';
import { ReaderView } from '../../src/views/ReaderView';
import { ReaderSessionState } from '../../src/reader/ReaderSessionState';
import { ReaderOutlineLoader } from '../../src/reader/ReaderOutlineLoader';
import { ReaderOpenRequests } from '../../src/reader/ReaderOpenRequests';
import { ReaderViewLifecycle } from '../../src/reader/ReaderViewLifecycle';
import { ReaderHistory } from '../../src/reader/ReaderHistory';
import type { PdfOutlineEntry, PdfRenderer } from '../../src/reader/PdfRenderer';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
	let resolve = (_value: T): void => undefined;
	const promise = new Promise<T>(next => { resolve = next; });
	return { promise, resolve };
}

function renderer(openResult: Promise<number>, outline: PdfOutlineEntry[]) {
	return {
		open: vi.fn(() => openResult),
		close: vi.fn(async () => undefined),
		getOutline: vi.fn(async () => outline)
	};
}

describe('ReaderView.openPdf document ownership', () => {
	it('keeps every committed surface on B when B opens before the older A', async () => {
		const openA = deferred<number>();
		const openB = deferred<number>();
		const outlineA = [{ title: 'A 章节', page: 1, path: ['A 章节'] }];
		const outlineB = [{ title: 'B 章节', page: 6, path: ['B 章节'] }];
		const rendererA = renderer(openA.promise, outlineA);
		const rendererB = renderer(openB.promise, outlineB);
		const initial = renderer(Promise.resolve(0), []);
		const navigation = { setOutline: vi.fn() };
		const updateProgress = vi.fn(async () => undefined);
		const view = Object.create(ReaderView.prototype) as ReaderView & Record<string, unknown>;
		const renderedPaths: string[] = [];
		const render = vi.fn(async () => {
			const state = view.getState() as { pdfPath: string };
			renderedPaths.push(state.pdfPath);
			await updateProgress(state.pdfPath, 7 / 20);
		});
		Object.assign(view, {
			pdf: initial as unknown as PdfRenderer,
			session: new ReaderSessionState(),
			openRequests: new ReaderOpenRequests(),
			lifecycle: new ReaderViewLifecycle(),
			outlineLoader: new ReaderOutlineLoader(),
			outlineSyncedTargets: new Set<string>(),
			history: new ReaderHistory(),
			tools: { resetForDocument: () => undefined } as never,
			scannedNoticeShown: false,
			readerNavigation: navigation,
			sourceMissing: false,
			pages: 0,
			page: 1,
			outline: [],
			host: { createPdfRenderer: vi.fn().mockReturnValueOnce(rendererA).mockReturnValueOnce(rendererB), updateProgress },
			render
		});

		const requestA = view.openPdf('A.pdf', 2);
		const requestB = view.openPdf('B.pdf', 7);
		openB.resolve(20);
		await requestB;
		openA.resolve(10);
		await requestA;

		expect(view.getState()).toEqual({ pdfPath: 'B.pdf', page: 7 });
		expect(view['pages']).toBe(20);
		expect(view['outline']).toEqual(outlineB);
		expect(view['pdf']).toBe(rendererB);
		expect(render).toHaveBeenCalledOnce();
		expect(renderedPaths).toEqual(['B.pdf']);
		expect(navigation.setOutline).toHaveBeenCalledWith(outlineB, 'ready', '');
		expect(rendererA.getOutline).not.toHaveBeenCalled();
		expect(rendererA.close).toHaveBeenCalledOnce();
		expect(updateProgress).toHaveBeenCalledOnce();
		expect(updateProgress).toHaveBeenCalledWith('B.pdf', 7 / 20);
		expect((view as unknown as { chapterForPage(page: number): string[] }).chapterForPage(6)).toEqual(['B 章节']);
	});

	it.each(['A-first', 'B-first'] as const)('keeps queued workspace state B when pending A resolves %s', async order => {
		const openA = deferred<number>();
		const openB = deferred<number>();
		const rendererA = renderer(openA.promise, [{ title: 'A 章节', page: 0, path: ['A 章节'] }]);
		const outlineB = [{ title: 'B 章节', page: 2, path: ['B 章节'] }];
		const rendererB = renderer(openB.promise, outlineB);
		const initial = renderer(Promise.resolve(0), []);
		const session = new ReaderSessionState();
		session.open('A.pdf', 1);
		const renderedPaths: string[] = [];
		const view = Object.create(ReaderView.prototype) as ReaderView & Record<string, unknown>;
		Object.assign(view, {
			pdf: initial as unknown as PdfRenderer,
			session,
			lifecycle: new ReaderViewLifecycle(),
			openRequests: new ReaderOpenRequests(),
			outlineLoader: new ReaderOutlineLoader(),
			outlineSyncedTargets: new Set<string>(),
			history: new ReaderHistory(),
			tools: { resetForDocument: () => undefined } as never,
			scannedNoticeShown: false,
			readerNavigation: { setOutline: vi.fn() },
			sourceMissing: false,
			pages: 0,
			page: 1,
			outline: [],
			host: { createPdfRenderer: vi.fn().mockReturnValueOnce(rendererA).mockReturnValueOnce(rendererB) },
			render: vi.fn(async () => { renderedPaths.push((view.getState() as { pdfPath: string }).pdfPath); })
		});

		const restoreA = view.onOpen();
		const restoreB = view.setState({ pdfPath: 'B.pdf', page: 3 }, {} as never);
		if (order === 'A-first') { openA.resolve(10); await restoreA; openB.resolve(20); }
		else { openB.resolve(20); await restoreB; openA.resolve(10); }
		await Promise.all([restoreA, restoreB]);

		expect(view.getState()).toEqual({ pdfPath: 'B.pdf', page: 3 });
		expect(view['pages']).toBe(20);
		expect(view['outline']).toEqual(outlineB);
		expect(view['pdf']).toBe(rendererB);
		expect(renderedPaths).toEqual(['B.pdf']);
		expect(rendererA.getOutline).not.toHaveBeenCalled();
		expect(rendererA.close).toHaveBeenCalledOnce();
	});
});
