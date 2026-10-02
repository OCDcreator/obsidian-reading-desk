import { describe, expect, it } from 'vitest';
import { AnnotationStore, type AnnotationPersistence } from '../../src/annotations/AnnotationStore';
import { TargetService } from '../../src/targets/TargetService';
import type { DeletedAnnotation, ExcerptCardState, PdfComment, PdfHighlight } from '../../src/types/contracts';

const highlight: PdfHighlight = { id: 'h', pdfPath: 'book.pdf', page: 2, rotation: 0, rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }], text: '原文', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1 };
const target = { type: 'canvas' as const, path: 'notes.canvas' };

/** The persisted snapshot survives a new Store/Service; failures can mutate memory. */
function setup(failedCommit = 0, failedTarget = false) {
	let state = { highlights: {} as Record<string, PdfHighlight>, comments: {} as Record<string, PdfComment[]>, cards: {} as Record<string, ExcerptCardState>, deleted: {} as Record<string, DeletedAnnotation>, pending: {} as Record<string, PdfHighlight> };
	let disk = structuredClone(state);
	let content = '{"nodes":[],"edges":[]}';
	let commits = 0;
	let writes = 0;
	const order: string[] = [];
	const port: AnnotationPersistence = {
		readHighlights: () => state.highlights, readComments: () => state.comments, readExcerptCards: () => state.cards,
		readDeletedAnnotations: () => state.deleted, readPendingTargetWrites: () => state.pending,
		commit: async mutation => {
			commits += 1;
			mutation();
			order.push(`save-${commits}`);
			if (commits === failedCommit) throw new Error('data save failed');
			disk = structuredClone(state);
		}
	};
	const gateway = { read: async () => content, atomicTransform: async (_path: string, transform: (content: string) => string) => {
		order.push('target');
		writes += 1;
		if (failedTarget && writes === 1) throw new Error('target save failed');
		content = transform(content);
	} };
	return { store: new AnnotationStore(port), service: new TargetService(gateway), port, gateway, order, disk: () => disk, content: () => content, writes: () => writes,
		restart: () => { state = structuredClone(disk); return { store: new AnnotationStore(port), service: new TargetService(gateway) }; } };
}

describe('durable target write recovery', () => {
	it('saves intent before target I/O and only clears after source/objectId are durable', async () => {
		const state = setup();
		const written = await state.service.writeAndSaveExcerpt(target, highlight, state.store, { title: '自定义标题', folded: true });
		expect(state.order).toEqual(['save-1', 'target', 'save-2']);
		expect(state.disk().highlights.h.target).toEqual(written.target);
		expect(state.disk().cards.h).toEqual({ title: '自定义标题', folded: true });
		expect(state.disk().pending).toEqual({});
	});

	it('does not write a target when the initial intent save fails', async () => {
		const state = setup(1);
		await expect(state.service.writeAndSaveExcerpt(target, highlight, state.store)).rejects.toThrow('data save failed');
		expect(state.writes()).toBe(0);
		expect(state.disk().highlights).toEqual({});
	});

	it('recovers target failure after restart with geometry/card state intact', async () => {
		const state = setup(0, true);
		await expect(state.service.writeAndSaveExcerpt(target, highlight, state.store, { title: '保存的标题', folded: true })).rejects.toThrow('target save failed');
		expect(state.disk().pending.h).toMatchObject({ rects: highlight.rects, target });
		const restarted = state.restart();
		expect(await restarted.service.retryPendingTargetWrites(restarted.store)).toEqual([{ highlightId: 'h', status: 'recovered' }]);
		expect(state.content()).toContain('保存的标题');
		expect(state.content()).toContain('"folded": true');
		expect(state.disk().pending).toEqual({});
	});

	it('replays failed atomic completion without duplicate target nodes', async () => {
		const failedCommit = 2;
		const state = setup(failedCommit);
		await expect(state.service.writeAndSaveExcerpt(target, highlight, state.store)).rejects.toThrow('data save failed');
		expect(state.store.listPendingTargetWrites()).toHaveLength(1);
		expect(state.disk().pending.h).toBeDefined();
		const firstObjectId = JSON.parse(state.content()).nodes[0].id;
		const restarted = state.restart();
		expect(await restarted.service.retryPendingTargetWrites(restarted.store)).toEqual([{ highlightId: 'h', status: 'recovered' }]);
		expect(JSON.parse(state.content()).nodes).toHaveLength(1);
		expect(state.disk().highlights.h.target?.objectId).toBe(firstObjectId);
		expect(state.disk().pending).toEqual({});
	});

	it('covers process exit between intent and target, and continues retry after one bad target', async () => {
		const state = setup();
		await state.store.stageTargetWrite({ ...highlight, id: 'bad', target: { type: 'excalidraw', path: 'bad.excalidraw.md' } });
		await state.store.stageTargetWrite({ ...highlight, target });
		const restarted = state.restart();
		const results = await restarted.service.retryPendingTargetWrites(restarted.store);
		expect(results).toMatchObject([{ highlightId: 'bad', status: 'pending' }, { highlightId: 'h', status: 'recovered' }]);
		expect(restarted.store.listPendingTargetWrites().map(item => item.id)).toEqual(['bad']);
	});

	it('prevents own modify events from deleting a staged annotation and keeps path writes serialized', async () => {
		const state = setup();
		const results = await Promise.all([
			state.service.writeAndSaveExcerpt(target, highlight, state.store),
			state.service.removeMissingTargetHighlights(target, [{ ...highlight, target }], state.store),
			state.service.writeAndSaveExcerpt(target, { ...highlight, color: 'brick' }, state.store)
		]);
		expect(results[1]).toEqual([]);
		expect(state.store.get('h')?.color).toBe('brick');
		expect(JSON.parse(state.content()).nodes).toHaveLength(1);
	});
});
