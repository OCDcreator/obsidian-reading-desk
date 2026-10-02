import { describe, expect, it } from 'vitest';
import { remapAnnotationPaths } from '../../src/host/SourcePathRemap';
import { concurrentState, concurrentHighlight, concurrentTarget } from './TargetConcurrencyFixtures';
import type { AnnotationStore } from '../../src/annotations/AnnotationStore';

function requiredHighlight(store: AnnotationStore, id: string) {
	const highlight = store.get(id);
	if (!highlight) throw new Error(`Missing fixture highlight: ${id}`);
	return highlight;
}

describe('target operations queued behind independent persistence', () => {
	it('refuses a color snapshot that became stale while waiting for the target path', async () => {
		const state = await concurrentState();
		const id = concurrentHighlight.id;
		await state.service.writeAndSaveExcerpt(concurrentTarget, structuredClone(concurrentHighlight), state.store);
		const paused = state.pauseTarget();
		const first = state.service.writeAndSaveExcerpt(concurrentTarget, { ...requiredHighlight(state.store, id) }, state.store, { title: 'First edit' }).catch(error => error);
		await paused.entered;
		const queued = state.service.writeAndSaveExcerpt(concurrentTarget, { ...requiredHighlight(state.store, id), color: 'brick', updatedAt: Date.now() }, state.store).catch(error => error);
		await state.store.setTags(id, ['new-tag-after-queue']);
		paused.release();
		expect(await first).toBeInstanceOf(Error);
		expect(await queued).toBeInstanceOf(Error);
		expect(state.store.get(id)?.tags).toEqual(['new-tag-after-queue']);
		expect(state.disk()?.highlights[id].tags).toEqual(['new-tag-after-queue']);
		expect(state.store.listPendingTargetWrites().map(item => item.id)).toEqual([id]);
	});

	it.each(['rename', 'stage', 'tags'] as const)('does not delete a source changed by a preceding queued %s', async change => {
		const state = await concurrentState();
		const id = concurrentHighlight.id;
		await state.store.save({ ...structuredClone(concurrentHighlight), target: { ...concurrentTarget } });
		await state.store.addComment(id, 'must survive relocation', 'pdf');
		const paused = state.pauseRepository();
		const mutation = state.repository.commit(() => {
			if (change === 'rename') remapAnnotationPaths({ highlights: state.repository.readHighlights(), pendingTargetWrites: state.repository.readPendingTargetWrites(), deletedAnnotations: state.repository.readDeletedAnnotations() }, concurrentTarget.path, 'notes/moved.canvas');
			if (change === 'tags') requiredHighlight(state.store, id).tags = ['queued-tag'];
			else state.repository.readPendingTargetWrites()[id] = structuredClone(requiredHighlight(state.store, id));
		});
		await paused.entered;
		let notify: () => void = () => undefined;
		const removalQueued = new Promise<void>(resolve => { notify = resolve; });
		const original = state.store.removeMissingTargetIds.bind(state.store);
		state.store.removeMissingTargetIds = (...args) => { const result = original(...args); notify(); return result; };
		const reconcile = state.service.reconcileTarget(concurrentTarget, state.store.listAll(), state.store);
		await removalQueued;
		paused.release(); await mutation;
		expect((await reconcile).removedIds).toEqual([]);
		expect(state.store.get(id)).toBeDefined();
		expect(state.disk()?.highlights[id]).toBeDefined();
		expect(state.store.comments(id)[0].content).toBe('must survive relocation');
		expect(state.store.listDeleted()).toEqual([]);
		if (change !== 'tags') expect(state.store.listPendingTargetWrites().map(item => item.id)).toEqual([id]);
		if (change === 'rename') expect(state.store.get(id)?.target?.path).toBe('notes/moved.canvas');
	});
});
