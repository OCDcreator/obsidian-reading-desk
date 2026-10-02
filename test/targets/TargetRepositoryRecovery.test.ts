import { describe, expect, it } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import { TargetService } from '../../src/targets/TargetService';
import type { PdfHighlight, ReadingDeskData } from '../../src/types/contracts';

const highlight: PdfHighlight = { id: 'h', pdfPath: 'book.pdf', page: 0, rotation: 0, rects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.1 }], text: '摘录', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1 };
const target = { type: 'canvas' as const, path: 'note.canvas' };

function setup(failedSave: number) {
	let disk: ReadingDeskData | undefined;
	let saves = 0;
	let content = '{"nodes":[],"edges":[]}';
	const sink = {
		load: async () => structuredClone(disk),
		save: async (data: ReadingDeskData) => {
			saves += 1;
			if (saves === failedSave) throw new Error('disk unavailable');
			disk = structuredClone(data);
		}
	};
	const repository = new ReadingDeskRepository(sink);
	const service = new TargetService({ read: async () => content, atomicTransform: async (_path, transform) => { content = transform(content); } });
	return { repository, sink, service, disk: () => disk, content: () => content };
}

describe('Repository and target recovery integration', () => {
	it('recovers a failed atomic completion through the real Repository after restart', async () => {
		const failedSave = 2;
		const state = setup(failedSave);
		await state.repository.initialize();
		const store = new AnnotationStore(state.repository);
		await expect(state.service.writeAndSaveExcerpt(target, highlight, store)).rejects.toThrow('disk unavailable');
		expect(state.repository.status().pending).toBe(true);
		expect(state.disk()?.pendingTargetWrites?.h).toBeDefined();
		const repository = new ReadingDeskRepository(state.sink);
		await repository.initialize();
		const restarted = new AnnotationStore(repository);
		expect(await state.service.retryPendingTargetWrites(restarted)).toEqual([{ highlightId: 'h', status: 'recovered' }]);
		expect(JSON.parse(state.content()).nodes).toHaveLength(1);
		expect(state.disk()?.pendingTargetWrites).toEqual({});
		expect(repository.status().pending).toBe(false);
	});

	it('restages a failed atomic completion in the same process after Repository snapshot retry', async () => {
		const state = setup(2);
		await state.repository.initialize();
		const store = new AnnotationStore(state.repository);
		await expect(state.service.writeAndSaveExcerpt(target, highlight, store)).rejects.toThrow('disk unavailable');
		expect(store.listPendingTargetWrites()).toHaveLength(1);
		await state.repository.retry();
		expect(state.repository.status().pending).toBe(false);
		expect(await state.service.retryPendingTargetWrites(store)).toEqual([{ highlightId: 'h', status: 'recovered' }]);
		expect(state.disk()?.pendingTargetWrites).toEqual({});
		expect(store.listPendingTargetWrites()).toEqual([]);
		expect(JSON.parse(state.content()).nodes).toHaveLength(1);
	});

	it('lets Repository retry a failed restore snapshot without retaining an active/deleted duplicate', async () => {
		const state = setup(3);
		await state.repository.initialize();
		const store = new AnnotationStore(state.repository);
		await store.save({ ...highlight, target });
		await store.remove('h');
		await expect(store.restoreDeleted('h')).rejects.toThrow('disk unavailable');
		expect(state.disk()?.deletedAnnotations?.h).toBeDefined();
		expect(state.repository.status().pending).toBe(true);
		await state.repository.retry();
		expect(store.listDeleted()).toEqual([]);
		expect(state.disk()?.deletedAnnotations).toEqual({});
		expect(state.disk()?.pendingTargetWrites?.h).toBeDefined();
		expect(await state.service.retryPendingTargetWrites(store)).toEqual([{ highlightId: 'h', status: 'recovered' }]);
	});
});
