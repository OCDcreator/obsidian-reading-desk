import { describe, expect, it, vi } from 'vitest';
import { ThumbnailObserverLifecycle } from '../../src/reader/ReaderNavigation';

describe('thumbnail observer lifecycle', () => {
	it('disconnects on destroy and ignores queued entries for detached canvases', () => {
		let callback: IntersectionObserverCallback = () => undefined;
		const observer = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
		const lifecycle = new ThumbnailObserverLifecycle((next) => {
			callback = next;
			return observer as unknown as IntersectionObserver;
		});
		const canvas = { dataset: {}, tagName: 'CANVAS' } as unknown as HTMLCanvasElement;
		const render = vi.fn();
		lifecycle.observe(canvas, 12, {} as HTMLElement, render);
		lifecycle.destroy();
		callback([{ isIntersecting: true, target: canvas } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
		expect(observer.disconnect).toHaveBeenCalledOnce();
		expect(render).not.toHaveBeenCalled();
	});
});
