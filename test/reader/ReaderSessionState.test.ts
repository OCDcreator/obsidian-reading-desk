import { describe, expect, it } from 'vitest';
import { ReaderSessionState } from '../../src/reader/ReaderSessionState';

describe('ReaderSessionState', () => {
	it('renames the active source without resetting its page or serialised view state', () => {
		const state = new ReaderSessionState();
		state.open('Books/old.pdf', 4);
		expect(state.rename('Books/old.pdf', 'Books/new.pdf')).toBe(true);
		expect(state.serialize()).toEqual({ pdfPath: 'Books/new.pdf', page: 4 });
	});

	it('clears a deleted active source so later excerpts cannot use a stale path', () => {
		const state = new ReaderSessionState();
		state.open('Books/deleted.pdf', 2);
		expect(state.delete('Books/deleted.pdf')).toBe(true);
		expect(state.path()).toBe('');
		expect(state.serialize()).toEqual({});
	});

	it('restores an existing persisted reader path and page', () => {
		const state = new ReaderSessionState();
		state.restore({ pdfPath: 'Books/restore.pdf', page: 3 });
		expect(state.serialize()).toEqual({ pdfPath: 'Books/restore.pdf', page: 3 });
	});
});
