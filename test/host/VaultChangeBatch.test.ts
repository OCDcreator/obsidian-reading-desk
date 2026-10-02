import { afterEach, describe, expect, it, vi } from 'vitest';
import { VaultChangeBatch } from '../../src/host/VaultChangeBatch';

describe('VaultChangeBatch', () => {
	afterEach(() => vi.useRealTimers());
	it('coalesces repeated paths and serializes new work behind an active batch', async () => {
		vi.useFakeTimers();
		let finish: (() => void) | undefined;
		const calls: string[][] = [];
		const batch = new VaultChangeBatch(async paths => {
			calls.push(paths);
			if (calls.length === 1) await new Promise<void>(resolve => { finish = resolve; });
		}, () => undefined);
		batch.add('Books/a.pdf'); batch.add('Books/a.pdf'); batch.add('Books/b.pdf');
		await vi.advanceTimersByTimeAsync(120);
		expect(calls).toEqual([['Books/a.pdf', 'Books/b.pdf']]);
		batch.add('Books/c.pdf');
		await vi.advanceTimersByTimeAsync(120);
		expect(calls).toHaveLength(1);
		finish?.(); await batch.flush();
		expect(calls[1]).toEqual(['Books/c.pdf']);
		batch.dispose();
	});
	it('reports failures and permits following batches, but drops work after disposal', async () => {
		const errors: unknown[] = [];
		let count = 0;
		const batch = new VaultChangeBatch(async () => { if (++count === 1) throw new Error('failure'); }, error => { errors.push(error); });
		batch.add('a.pdf'); await batch.flush();
		batch.add('b.pdf'); await batch.flush();
		expect(errors).toHaveLength(1); expect(count).toBe(2);
		batch.add('c.pdf'); batch.dispose(); await batch.flush();
		expect(count).toBe(2);
	});
});
