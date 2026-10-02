import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import { TargetService } from '../../src/targets/TargetService';
import type { PdfHighlight, ReadingDeskData } from '../../src/types/contracts';

export const concurrentHighlight: PdfHighlight = {
	id: 'concurrent', pdfPath: 'books/book.pdf', page: 0, rotation: 90,
	rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }], text: '并发测试摘录', color: 'moss',
	chapterPath: ['章'], tags: [], createdAt: 1, updatedAt: 1
};
export const concurrentTarget = { type: 'canvas' as const, path: 'notes/book.canvas' };

function barrier() {
	let enter: () => void = () => undefined;
	let release: () => void = () => undefined;
	const entered = new Promise<void>(resolve => { enter = resolve; });
	const released = new Promise<void>(resolve => { release = resolve; });
	return { entered, release, block: async () => { enter(); await released; } };
}

/** Real Repository queue and persisted snapshots, with bounded explicit I/O barriers. */
export async function concurrentState() {
	let disk: ReadingDeskData | undefined;
	let targetBarrier: ReturnType<typeof barrier> | undefined;
	let repositoryBarrier: ReturnType<typeof barrier> | undefined;
	const contents: Record<string, string> = { [concurrentTarget.path]: '{"nodes":[],"edges":[]}' };
	const repository = new ReadingDeskRepository({
		load: async () => {
			const paused = repositoryBarrier;
			repositoryBarrier = undefined;
			if (paused) await paused.block();
			return structuredClone(disk);
		},
		save: async value => { disk = structuredClone(value); }
	});
	await repository.initialize();
	const store = new AnnotationStore(repository);
	const service = new TargetService({
		read: async path => contents[path],
		atomicTransform: async (path, transform) => {
			const paused = targetBarrier;
			targetBarrier = undefined;
			if (paused) await paused.block();
			if (contents[path] === undefined) throw new Error(`Missing test target: ${path}`);
			contents[path] = transform(contents[path]);
		}
	});
	return {
		repository, store, service, contents, disk: () => structuredClone(disk),
		pauseTarget: () => { targetBarrier = barrier(); return targetBarrier; },
		pauseRepository: () => { repositoryBarrier = barrier(); return repositoryBarrier; }
	};
}
