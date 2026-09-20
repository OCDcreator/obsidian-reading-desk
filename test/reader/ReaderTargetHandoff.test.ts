import { describe, expect, it, vi } from 'vitest';
import { revealCreatedCanvasTarget } from '../../src/reader/ReaderTargetHandoff';

describe('native target handoff after excerpt creation', () => {
	it('opens the adjacent native Canvas and requests focus for the new node', async () => {
		const openTargetInSplit = vi.fn(async () => undefined);
		await expect(revealCreatedCanvasTarget({ type: 'canvas', path: '研究笔记.canvas', objectId: 'node-new' }, { openTargetInSplit })).resolves.toBe('opened');
		expect(openTargetInSplit).toHaveBeenCalledWith('研究笔记.canvas', 'node-new');
	});

	it('preserves Markdown and Excalidraw creation without forcing a new leaf', async () => {
		const openTargetInSplit = vi.fn(async () => undefined);
		await expect(revealCreatedCanvasTarget({ type: 'markdown', path: '笔记.md', objectId: 'block' }, { openTargetInSplit })).resolves.toBe('not-canvas');
		await expect(revealCreatedCanvasTarget({ type: 'excalidraw', path: '图.excalidraw.md', objectId: 'shape' }, { openTargetInSplit })).resolves.toBe('not-canvas');
		expect(openTargetInSplit).not.toHaveBeenCalled();
	});

	it('keeps the persisted Canvas excerpt successful when native reveal fails', async () => {
		const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const openTargetInSplit = vi.fn(async () => { throw new Error('leaf unavailable'); });
		await expect(revealCreatedCanvasTarget({ type: 'canvas', path: '研究笔记.canvas', objectId: 'node-saved' }, { openTargetInSplit })).resolves.toBe('open-failed');
		expect(openTargetInSplit).toHaveBeenCalledOnce();
		expect(report).toHaveBeenCalledWith('[Reading Desk] Canvas 摘录已创建，但原生目标打开失败', expect.any(Error));
		report.mockRestore();
	});
});
