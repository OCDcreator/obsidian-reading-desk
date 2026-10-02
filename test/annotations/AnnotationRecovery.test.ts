import { describe, expect, it } from 'vitest';
import { AnnotationStore, type AnnotationPersistence } from '../../src/annotations/AnnotationStore';
import type { DeletedAnnotation, ExcerptCardState, PdfComment, PdfHighlight } from '../../src/types/contracts';

const original: PdfHighlight = {
	id: 'h', pdfPath: 'book.pdf', page: 0, rotation: 90, rects: [{ x: 0.2, y: 0.3, width: 0.1, height: 0.2 }],
	text: '源文字', color: 'moss', chapterPath: ['章'], tags: ['标签'], createdAt: 1, updatedAt: 1,
	target: { type: 'markdown', path: 'notes.md', objectId: 'h' }
};

function setup() {
	const highlights: Record<string, PdfHighlight> = {};
	const comments: Record<string, PdfComment[]> = {};
	const cards: Record<string, ExcerptCardState> = {};
	const deleted: Record<string, DeletedAnnotation> = {};
	const pending: Record<string, PdfHighlight> = {};
	let commits = 0;
	let fail = false;
	const port: AnnotationPersistence = {
		readHighlights: () => highlights, readComments: () => comments, readExcerptCards: () => cards,
		readDeletedAnnotations: () => deleted, readPendingTargetWrites: () => pending,
		commit: async mutation => { commits += 1; mutation(); if (fail) throw new Error('save failed'); }
	};
	return { store: new AnnotationStore(port), port, highlights, comments, cards, deleted, pending, commits: () => commits, fail: () => { fail = true; } };
}

describe('recoverable annotation deletion', () => {
	it('archives a complete detached snapshot and restores comments/card/normalized geometry after restart', async () => {
		const state = setup();
		await state.store.save(structuredClone(original));
		await state.store.addComment('h', '我的评论', 'pdf');
		state.cards.h = { title: '手写标题', folded: true };
		await state.store.removeMissingTargetIds(['h', 'h']);
		expect(state.store.listAll()).toEqual([]);
		expect(state.comments.h).toBeUndefined();
		expect(state.cards.h).toBeUndefined();
		expect(state.deleted.h).toMatchObject({ reason: 'target-deleted', highlight: original, comments: [{ content: '我的评论' }], excerptCard: { title: '手写标题', folded: true } });
		const snapshot = state.store.listDeleted();
		snapshot[0].highlight.rects[0].x = 0.9;
		expect(state.deleted.h.highlight.rects[0].x).toBe(0.2);
		const restarted = new AnnotationStore(state.port);
		const before = state.commits();
		expect(await restarted.restoreDeleted('h')).toEqual(original);
		expect(state.commits() - before).toBe(1);
		expect(restarted.comments('h')[0].content).toBe('我的评论');
		expect(state.cards.h).toEqual({ title: '手写标题', folded: true });
		expect(restarted.listDeleted()).toEqual([]);
		expect(restarted.listPendingTargetWrites()).toEqual([original]);
	});

	it('records explicit deletion and batches reverse cleanup in a single save', async () => {
		const state = setup();
		await state.store.save({ ...original, target: undefined });
		await state.store.remove('h');
		expect(state.deleted.h.reason).toBe('user-deleted');
		await state.store.restoreDeleted('h');
		expect(state.pending).toEqual({});
		await state.store.save({ ...original, id: 'other' });
		const before = state.commits();
		await state.store.removeMissingTargetIds(['h', 'other']);
		expect(state.commits() - before).toBe(1);
		expect(state.store.listDeleted()).toHaveLength(2);
	});

	it('refuses to overwrite an active annotation during recovery', async () => {
		const state = setup();
		await state.store.save(original);
		await state.store.remove('h');
		await state.store.save({ ...original, text: '较新的数据' });
		await expect(state.store.restoreDeleted('h')).rejects.toThrow('不能覆盖');
		expect(state.store.get('h')?.text).toBe('较新的数据');
		expect(state.store.listDeleted()).toHaveLength(1);
	});
});

describe('durable annotation write intents', () => {
	it('stages detached geometry, keeps later source edits in the intent and cancels it on deletion', async () => {
		const state = setup();
		const input = structuredClone(original);
		await state.store.stageTargetWrite(input, { title: '自定义', folded: true });
		input.rects[0].x = 0.99;
		expect(state.store.listPendingTargetWrites()[0].rects[0].x).toBe(0.2);
		await state.store.recolor('h', 'brick');
		await state.store.setTags('h', ['新标签']);
		expect(state.pending.h).toMatchObject({ color: 'brick', tags: ['新标签'] });
		await state.store.remove('h');
		expect(state.pending.h).toBeUndefined();
	});

	it('retains intent in memory if the final clear fails with a legacy mutating port', async () => {
		const state = setup();
		await state.store.stageTargetWrite(original);
		state.fail();
		await expect(state.store.finishTargetWrite('h')).rejects.toThrow('save failed');
		expect(state.store.listPendingTargetWrites()).toEqual([original]);
	});

	it('rejects a nondurable port before staging target I/O', async () => {
		const state = setup();
		const port = { ...state.port, readPendingTargetWrites: undefined };
		await expect(new AnnotationStore(port).stageTargetWrite(original)).rejects.toThrow('readPendingTargetWrites');
		expect(state.highlights).toEqual({});
	});
});
