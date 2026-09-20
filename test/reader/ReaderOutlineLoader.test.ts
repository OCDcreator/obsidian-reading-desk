import { describe, expect, it } from 'vitest';
import { ReaderOutlineLoader } from '../../src/reader/ReaderOutlineLoader';
import type { PdfOutlineEntry } from '../../src/reader/PdfRenderer';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
	let resolve = (_value: T): void => undefined;
	const promise = new Promise<T>(next => { resolve = next; });
	return { promise, resolve };
}

describe('ReaderOutlineLoader', () => {
	it('keeps PDF B when its outline resolves before the older PDF A', async () => {
		const loader = new ReaderOutlineLoader();
		const sourceA = deferred<PdfOutlineEntry[]>();
		const sourceB = deferred<PdfOutlineEntry[]>();
		const resultA = loader.load(sourceA.promise);
		const resultB = loader.load(sourceB.promise);
		const outlineB = [{ title: 'B 章节', page: 4, path: ['B 章节'] }];
		sourceB.resolve(outlineB);
		await expect(resultB).resolves.toEqual({ entries: outlineB });
		sourceA.resolve([{ title: 'A 章节', page: 1, path: ['A 章节'] }]);
		await expect(resultA).resolves.toBeNull();
	});

	it('invalidates a pending outline when the Reader closes or its source is deleted', async () => {
		const loader = new ReaderOutlineLoader();
		const source = deferred<PdfOutlineEntry[]>();
		const result = loader.load(source.promise);
		loader.invalidate();
		source.resolve([{ title: '已删除来源', page: 0, path: ['已删除来源'] }]);
		await expect(result).resolves.toBeNull();
	});
});
