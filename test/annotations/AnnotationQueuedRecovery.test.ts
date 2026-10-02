import { describe, expect, it } from 'vitest';
import { remapAnnotationPaths } from '../../src/host/SourcePathRemap';
import { concurrentHighlight as highlight, concurrentState, concurrentTarget as target } from '../targets/TargetConcurrencyFixtures';

const id = highlight.id;

describe('queued deletion recovery through the actual Repository', () => {
	it('restores the latest tombstone paths, comments and card after an earlier queued rename', async () => {
		const state = await concurrentState();
		await state.store.save({ ...highlight, target }, { title: '原标题', folded: false });
		await state.store.addComment(id, '原评论', 'pdf');
		await state.store.remove(id);
		const paused = state.pauseRepository();
		const rename = state.repository.commit(() => {
			const deleted = state.repository.readDeletedAnnotations();
			remapAnnotationPaths({ highlights: state.repository.readHighlights(), pendingTargetWrites: state.repository.readPendingTargetWrites(), deletedAnnotations: deleted }, 'books', 'renamed-books');
			remapAnnotationPaths({ highlights: state.repository.readHighlights(), pendingTargetWrites: state.repository.readPendingTargetWrites(), deletedAnnotations: deleted }, 'notes', 'renamed-notes');
			// A newer tombstone can also replace the object itself while queued.
			deleted[id] = { ...deleted[id], comments: [...deleted[id].comments, { id: 'latest-comment', highlightId: id, content: '最新评论', source: 'pdf', createdAt: 2, showTimestamp: true }], excerptCard: { title: '最新标题', folded: true } };
		});
		await paused.entered;
		const recovery = state.store.restoreDeleted(id);
		paused.release();
		await rename;
		const restored = await recovery;
		expect(restored).toMatchObject({ pdfPath: 'renamed-books/book.pdf', target: { path: 'renamed-notes/book.canvas' } });
		expect(restored).toEqual(state.disk()?.highlights[id]);
		expect(state.disk()?.pendingTargetWrites?.[id]).toEqual(restored);
		expect(state.disk()?.comments[id].map(comment => comment.content)).toEqual(['原评论', '最新评论']);
		expect(state.disk()?.excerptCards[id]).toEqual({ title: '最新标题', folded: true });
		expect(state.disk()?.deletedAnnotations).toEqual({});
		state.contents['renamed-notes/book.canvas'] = '{"nodes":[],"edges":[]}';
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: id, status: 'recovered' }]);
		expect(state.store.comments(id).map(comment => comment.content)).toEqual(['原评论', '最新评论']);
	});

	it('evaluates existence in queue order when deletion is already queued ahead of recovery', async () => {
		const state = await concurrentState();
		await state.store.save(highlight);
		await state.store.addComment(id, '删除/恢复评论', 'pdf');
		const paused = state.pauseRepository();
		const deletion = state.store.remove(id);
		await paused.entered;
		const recovery = state.store.restoreDeleted(id);
		paused.release();
		await deletion;
		expect(await recovery).toEqual(highlight);
		expect(state.store.comments(id)[0].content).toBe('删除/恢复评论');
		expect(state.store.listDeleted()).toEqual([]);
	});

	it('rejects a missing tombstone discovered at commit time without clearing another record', async () => {
		const state = await concurrentState();
		await state.store.save(highlight);
		await state.store.remove(id);
		const paused = state.pauseRepository();
		const consumed = state.repository.commit(() => { delete state.repository.readDeletedAnnotations()[id]; });
		await paused.entered;
		const recovery = state.store.restoreDeleted(id).catch(error => error);
		paused.release();
		await consumed;
		expect(await recovery).toBeInstanceOf(Error);
		expect(state.store.get(id)).toBeUndefined();
		expect(state.store.listPendingTargetWrites()).toEqual([]);
	});

	it('rejects an active ID created ahead of recovery without changing comments or its tombstone', async () => {
		const state = await concurrentState();
		await state.store.save(highlight);
		await state.store.addComment(id, '墓碑评论', 'pdf');
		await state.store.remove(id);
		const paused = state.pauseRepository();
		const recreation = state.store.save({ ...highlight, text: '最新活动标注' });
		await paused.entered;
		const recovery = state.store.restoreDeleted(id).catch(error => error);
		paused.release();
		await recreation;
		expect(await recovery).toBeInstanceOf(Error);
		expect(state.store.get(id)?.text).toBe('最新活动标注');
		expect(state.store.listDeleted()[0].comments[0].content).toBe('墓碑评论');
	});
});
