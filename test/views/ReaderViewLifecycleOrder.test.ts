import { describe, expect, it, vi } from 'vitest';
import { ReaderView } from '../../src/views/ReaderView';
import { ReaderSessionState } from '../../src/reader/ReaderSessionState';
import { ReaderViewLifecycle } from '../../src/reader/ReaderViewLifecycle';

function viewDouble(): ReaderView & Record<string, unknown> {
	const view = Object.create(ReaderView.prototype) as ReaderView & Record<string, unknown>;
	const lifecycle = new ReaderViewLifecycle();
	const session = new ReaderSessionState();
	const openPdf = vi.fn(async (path: string, page: number) => { lifecycle.markLoaded(path, page); });
	Object.assign(view, { lifecycle, session, openPdf, render: vi.fn(async () => undefined) });
	return view;
}

describe('ReaderView workspace restore ordering', () => {
	it('opens exactly once when setState precedes onOpen', async () => {
		const view = viewDouble();
		await view.setState({ pdfPath: 'fixtures/restored.pdf', page: 9 }, {} as never);
		await view.onOpen();
		await view.setState({ pdfPath: 'fixtures/restored.pdf', page: 9 }, {} as never);
		expect(view['openPdf']).toHaveBeenCalledOnce();
		expect(view['openPdf']).toHaveBeenCalledWith('fixtures/restored.pdf', 9);
	});

	it('opens exactly once when onOpen precedes setState', async () => {
		const view = viewDouble();
		await view.onOpen();
		await view.setState({ pdfPath: 'fixtures/restored.pdf', page: 4 }, {} as never);
		await view.setState({ pdfPath: 'fixtures/restored.pdf', page: 4 }, {} as never);
		expect(view['openPdf']).toHaveBeenCalledOnce();
		expect(view['openPdf']).toHaveBeenCalledWith('fixtures/restored.pdf', 4);
	});
});
