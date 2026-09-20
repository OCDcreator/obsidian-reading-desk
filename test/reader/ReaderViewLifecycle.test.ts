import { describe, expect, it, vi } from 'vitest';
import { ReaderViewLifecycle } from '../../src/reader/ReaderViewLifecycle';

function deferred(): { promise: Promise<void>; resolve(): void } {
	let resolve = (): void => undefined;
	const promise = new Promise<void>(next => { resolve = next; });
	return { promise, resolve };
}

describe('ReaderViewLifecycle', () => {
	it('opens restored state once when setState arrives before onOpen', async () => {
		const lifecycle = new ReaderViewLifecycle();
		const open = vi.fn(async () => undefined);
		const state = { pdfPath: 'fixtures/book.pdf', page: 8 };
		await lifecycle.onState(state, open);
		await lifecycle.onOpen(state, open);
		await lifecycle.onState(state, open);
		expect(open).toHaveBeenCalledOnce();
		expect(open).toHaveBeenCalledWith('fixtures/book.pdf', 8);
	});

	it('opens restored state once when onOpen arrives before setState', async () => {
		const lifecycle = new ReaderViewLifecycle();
		const open = vi.fn(async () => undefined);
		await lifecycle.onOpen({}, open);
		const state = { pdfPath: 'fixtures/book.pdf', page: 3 };
		await lifecycle.onState(state, open);
		await lifecycle.onState(state, open);
		expect(open).toHaveBeenCalledOnce();
		expect(open).toHaveBeenCalledWith('fixtures/book.pdf', 3);
	});

	it('ignores state that arrives after close', async () => {
		const lifecycle = new ReaderViewLifecycle();
		const open = vi.fn(async () => undefined);
		await lifecycle.onOpen({}, open);
		lifecycle.close();
		await lifecycle.onState({ pdfPath: 'fixtures/book.pdf', page: 1 }, open);
		expect(open).not.toHaveBeenCalled();
	});

	it('starts the latest different state while an older restore is pending', async () => {
		const lifecycle = new ReaderViewLifecycle();
		const pendingA = deferred();
		const pendingB = deferred();
		const open = vi.fn((path: string) => path === 'A.pdf' ? pendingA.promise : pendingB.promise);
		const restoreA = lifecycle.onOpen({ pdfPath: 'A.pdf', page: 1 }, open);
		const restoreB = lifecycle.onState({ pdfPath: 'B.pdf', page: 2 }, open);
		expect(open.mock.calls).toEqual([['A.pdf', 1], ['B.pdf', 2]]);
		pendingB.resolve();
		await restoreB;
		pendingA.resolve();
		await restoreA;
		await lifecycle.onState({ pdfPath: 'B.pdf', page: 2 }, open);
		expect(open).toHaveBeenCalledTimes(2);
	});

	it('close invalidates the latest queued completion and blocks later state', async () => {
		const lifecycle = new ReaderViewLifecycle();
		const pending = deferred();
		const open = vi.fn(() => pending.promise);
		const restore = lifecycle.onOpen({ pdfPath: 'A.pdf', page: 1 }, open);
		lifecycle.close();
		pending.resolve();
		await restore;
		await lifecycle.onState({ pdfPath: 'B.pdf', page: 2 }, open);
		expect(open).toHaveBeenCalledOnce();
	});
});
