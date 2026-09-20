import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressFlusher } from '../../src/library/ProgressFlusher';

describe('ProgressFlusher', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it('collapses rapid writes into one trailing flush', async () => {
		const writes: Array<{ path: string; progress: number }> = [];
		const flusher = new ProgressFlusher({ write: async record => { writes.push(record); } }, 1000);
		flusher.record('a.pdf', 0.1);
		flusher.record('a.pdf', 0.2);
		flusher.record('a.pdf', 0.3);
		await vi.advanceTimersByTimeAsync(900);
		expect(writes).toEqual([]);
		await vi.advanceTimersByTimeAsync(200);
		expect(writes).toEqual([{ path: 'a.pdf', progress: 0.3 }]);
	});

	it('flushNow persists the pending record immediately and clears the timer', async () => {
		const writes: Array<{ path: string; progress: number }> = [];
		const flusher = new ProgressFlusher({ write: async record => { writes.push(record); } }, 5000);
		flusher.record('b.pdf', 0.7);
		await flusher.flush();
		await vi.advanceTimersByTimeAsync(6000);
		expect(writes).toEqual([{ path: 'b.pdf', progress: 0.7 }]);
	});

	it('dispose drops the pending record without writing', async () => {
		const writes: Array<{ path: string; progress: number }> = [];
		const flusher = new ProgressFlusher({ write: async record => { writes.push(record); } }, 5000);
		flusher.record('c.pdf', 0.9);
		flusher.dispose();
		await vi.advanceTimersByTimeAsync(6000);
		expect(writes).toEqual([]);
	});
});
