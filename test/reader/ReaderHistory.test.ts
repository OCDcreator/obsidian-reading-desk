import { describe, expect, it } from 'vitest';
import { ReaderHistory } from '../../src/reader/ReaderHistory';

describe('ReaderHistory', () => {
	it('pushes jumps and truncates the forward branch', () => {
		const history = new ReaderHistory();
		history.push({ page: 3 });
		history.push({ page: 8 });
		expect(history.back()).toEqual({ page: 3 });
		history.push({ page: 5 });
		expect(history.canForward()).toBe(false);
		expect(history.back()).toEqual({ page: 3 });
		expect(history.back()).toBeNull();
	});

	it('forward restores the branch created by back', () => {
		const history = new ReaderHistory();
		history.push({ page: 2 });
		history.push({ page: 9 });
		expect(history.back()).toEqual({ page: 2 });
		expect(history.forward()).toEqual({ page: 9 });
		expect(history.forward()).toBeNull();
		expect(history.canBack()).toBe(true);
	});

	it('replace tracks page turns without pushing; back returns the jump origin', () => {
		const history = new ReaderHistory();
		history.push({ page: 1 });
		history.push({ page: 4 });
		history.replace({ page: 6 });
		expect(history.back()).toEqual({ page: 1 });
		expect(history.canBack()).toBe(false);
	});

	it('ignores duplicate pushes to the same page', () => {
		const history = new ReaderHistory();
		history.push({ page: 5 });
		history.push({ page: 5 });
		expect(history.canBack()).toBe(false);
	});
});
