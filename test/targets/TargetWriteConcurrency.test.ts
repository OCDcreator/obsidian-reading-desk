import { describe, expect, it } from 'vitest';
import { remapAnnotationPaths } from '../../src/host/SourcePathRemap';
import { concurrentHighlight as highlight, concurrentState, concurrentTarget as target } from './TargetConcurrencyFixtures';

const id = highlight.id;

describe('target completion with concurrent Repository mutations', () => {
	it('creates an initial annotation and atomically completes its target reference/card/intent', async () => {
		const state = await concurrentState();
		const written = await state.service.writeAndSaveExcerpt(target, highlight, state.store, { title: '初始标题', folded: true });
		expect(state.disk()?.highlights[id]).toEqual({ ...highlight, target: written.target });
		expect(state.disk()?.excerptCards[id]).toEqual({ title: '初始标题', folded: true });
		expect(state.disk()?.pendingTargetWrites).toEqual({});
	});

	it.each([
		['books/book.pdf', 'books/renamed.pdf', 'books/renamed.pdf', target.path],
		[target.path, 'notes/renamed.canvas', highlight.pdfPath, 'notes/renamed.canvas']
	])('preserves paused-I/O remap %s plus newer tags/color/comments and fully retries', async (from, to, pdfPath, targetPath) => {
		const state = await concurrentState();
		const paused = state.pauseTarget();
		const result = state.service.writeAndSaveExcerpt(target, highlight, state.store).catch(error => error);
		await paused.entered;
		await state.repository.commit(() => {
			remapAnnotationPaths({ highlights: state.repository.readHighlights(), pendingTargetWrites: state.repository.readPendingTargetWrites(), deletedAnnotations: state.repository.readDeletedAnnotations() }, from, to);
		});
		await state.store.recolor(id, 'brick');
		await state.store.setTags(id, ['新标签']);
		await state.store.addComment(id, 'I/O 期间的评论', 'pdf');
		const latestIntent = structuredClone(state.repository.readPendingTargetWrites()[id]);
		paused.release();
		expect(await result).toBeInstanceOf(Error);
		expect(state.disk()?.highlights[id]).toMatchObject({ pdfPath, target: { path: targetPath }, color: 'brick', tags: ['新标签'] });
		expect(state.disk()?.highlights[id].target?.objectId).toBeUndefined();
		expect(state.repository.readPendingTargetWrites()[id]).toEqual(latestIntent);
		expect(state.store.comments(id)[0].content).toBe('I/O 期间的评论');
		state.contents[targetPath] ??= '{"nodes":[],"edges":[]}';
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: id, status: 'recovered' }]);
		expect(state.disk()?.highlights[id]).toMatchObject({ pdfPath, target: { path: targetPath, objectId: expect.any(String) }, color: 'brick', tags: ['新标签'] });
		expect(state.disk()?.pendingTargetWrites).toEqual({});
		expect(JSON.parse(state.contents[targetPath]).nodes.filter((node: { readingDesk?: { kind?: string } }) => node.readingDesk?.kind === 'excerpt')).toHaveLength(1);
	});

	it('refreshes an unchanged old intent from newer live fields without overwriting card/geometry', async () => {
		const state = await concurrentState();
		const paused = state.pauseTarget();
		const result = state.service.writeAndSaveExcerpt(target, highlight, state.store).catch(error => error);
		await paused.entered;
		await state.repository.commit(() => {
			const live = state.repository.readHighlights()[id];
			live.pdfPath = 'books/new.pdf'; live.tags = ['external-edit']; live.color = 'plum';
			live.rects = [{ x: 0.4, y: 0.5, width: 0.1, height: 0.2 }];
			state.repository.readExcerptCards()[id] = { title: '更新标题', folded: true };
		});
		paused.release();
		expect(await result).toBeInstanceOf(Error);
		expect(state.repository.readPendingTargetWrites()[id]).toEqual(state.store.get(id));
		expect(state.disk()?.excerptCards[id]).toEqual({ title: '更新标题', folded: true });
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: id, status: 'recovered' }]);
		expect(state.disk()?.highlights[id]).toMatchObject({ pdfPath: 'books/new.pdf', tags: ['external-edit'], color: 'plum', rects: [{ x: 0.4, y: 0.5, width: 0.1, height: 0.2 }] });
		expect(state.disk()?.excerptCards[id]).toEqual({ title: '更新标题', folded: true });
	});

	it('keeps a newer same-ID intent even when its payload is identical to the old write', async () => {
		const state = await concurrentState();
		const paused = state.pauseTarget();
		const result = state.service.writeAndSaveExcerpt(target, highlight, state.store).catch(error => error);
		await paused.entered;
		await state.store.stageTargetWrite({ ...highlight, target });
		const replacement = state.repository.readPendingTargetWrites()[id];
		paused.release();
		expect(await result).toBeInstanceOf(Error);
		expect(state.repository.readPendingTargetWrites()[id]).toBe(replacement);
		expect(state.disk()?.highlights[id].target?.objectId).toBeUndefined();
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: id, status: 'recovered' }]);
		expect(state.disk()?.pendingTargetWrites).toEqual({});
	});

	it('does not revive a deleted annotation or overwrite its comments on a second deletion', async () => {
		const state = await concurrentState();
		await state.store.save(highlight, { title: '删除前标题', folded: true });
		await state.store.addComment(id, '第一次删除必须保留', 'pdf');
		const paused = state.pauseTarget();
		const result = state.service.writeAndSaveExcerpt(target, highlight, state.store).catch(error => error);
		await paused.entered;
		await state.store.addComment(id, '第二条评论', 'pdf');
		await state.store.remove(id);
		const tombstone = structuredClone(state.repository.readDeletedAnnotations()[id]);
		paused.release();
		expect(await result).toBeInstanceOf(Error);
		expect(state.store.get(id)).toBeUndefined();
		expect(state.store.listPendingTargetWrites()).toEqual([]);
		await state.store.remove(id);
		expect(state.repository.readDeletedAnnotations()[id]).toEqual(tombstone);
		expect(state.disk()?.deletedAnnotations?.[id].comments.map(comment => comment.content)).toEqual(['第一次删除必须保留', '第二条评论']);
		expect(state.disk()?.deletedAnnotations?.[id].excerptCard).toEqual({ title: '删除前标题', folded: true });
	});

	it('does not clear the new restore intent after deletion and restoration during old target I/O', async () => {
		const state = await concurrentState();
		const paused = state.pauseTarget();
		const result = state.service.writeAndSaveExcerpt(target, highlight, state.store).catch(error => error);
		await paused.entered;
		await state.store.addComment(id, '随恢复保留', 'pdf');
		await state.store.remove(id);
		await state.store.restoreDeleted(id);
		const restoredIntent = state.repository.readPendingTargetWrites()[id];
		paused.release();
		expect(await result).toBeInstanceOf(Error);
		expect(state.repository.readPendingTargetWrites()[id]).toBe(restoredIntent);
		expect(state.store.comments(id)[0].content).toBe('随恢复保留');
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: id, status: 'recovered' }]);
		expect(state.store.comments(id)[0].content).toBe('随恢复保留');
		expect(state.store.listDeleted()).toEqual([]);
	});

	it('validates completion in its queued commit after an earlier queued remap', async () => {
		const state = await concurrentState();
		const receipt = await state.store.stageTargetWrite({ ...highlight, target });
		const paused = state.pauseRepository();
		const rename = state.repository.commit(() => {
			remapAnnotationPaths({ highlights: state.repository.readHighlights(), pendingTargetWrites: state.repository.readPendingTargetWrites() }, target.path, 'notes/queued.canvas');
		});
		await paused.entered;
		const completion = state.store.completeTargetWrite(receipt, { ...target, objectId: 'stale-node' }, { title: '旧标题', folded: false });
		paused.release();
		await rename;
		expect(await completion).toBe('pending');
		expect(state.disk()?.highlights[id].target).toEqual({ ...target, path: 'notes/queued.canvas' });
		expect(state.disk()?.pendingTargetWrites?.[id].target?.path).toBe('notes/queued.canvas');
	});

	it('reads a deletion queued ahead of completion and leaves its comment tombstone untouched', async () => {
		const state = await concurrentState();
		const receipt = await state.store.stageTargetWrite({ ...highlight, target });
		await state.store.addComment(id, '提交队列中的评论', 'pdf');
		const paused = state.pauseRepository();
		const deletion = state.store.remove(id);
		await paused.entered;
		const completion = state.store.completeTargetWrite(receipt, { ...target, objectId: 'stale-node' });
		paused.release();
		await deletion;
		expect(await completion).toBe('deleted');
		expect(state.disk()?.highlights[id]).toBeUndefined();
		expect(state.disk()?.deletedAnnotations?.[id].comments[0].content).toBe('提交队列中的评论');
		expect(state.store.listPendingTargetWrites()).toEqual([]);
	});

	it('keeps newer card state when the highlight and intent payload have not changed', async () => {
		const state = await concurrentState();
		const paused = state.pauseTarget();
		const result = state.service.writeAndSaveExcerpt(target, highlight, state.store, { title: '旧卡片标题', folded: false }).catch(error => error);
		await paused.entered;
		await state.repository.commit(() => { state.repository.readExcerptCards()[id] = { title: '新卡片标题', folded: true }; });
		paused.release();
		expect(await result).toBeInstanceOf(Error);
		expect(state.disk()?.excerptCards[id]).toEqual({ title: '新卡片标题', folded: true });
		expect(state.store.listPendingTargetWrites()).toHaveLength(1);
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: id, status: 'recovered' }]);
		expect(state.disk()?.excerptCards[id]).toEqual({ title: '新卡片标题', folded: true });
	});

	it('does not stage a stale write over an existing deletion record', async () => {
		const state = await concurrentState();
		await state.store.save(highlight);
		await state.store.addComment(id, '已删除评论', 'pdf');
		await state.store.remove(id);
		await expect(state.service.writeAndSaveExcerpt(target, highlight, state.store)).rejects.toThrow('标注已删除');
		expect(state.store.get(id)).toBeUndefined();
		expect(state.store.listDeleted()[0].comments[0].content).toBe('已删除评论');
		expect(state.contents[target.path]).toBe('{"nodes":[],"edges":[]}');
	});

	it('legacy finish cannot clear an intent replaced ahead of it in the Repository queue', async () => {
		const state = await concurrentState();
		await state.store.stageTargetWrite({ ...highlight, target });
		const paused = state.pauseRepository();
		const recolor = state.store.recolor(id, 'indigo');
		await paused.entered;
		const finish = state.store.finishTargetWrite(id);
		paused.release();
		await recolor;
		await finish;
		expect(state.disk()?.pendingTargetWrites?.[id].color).toBe('indigo');
	});
});
