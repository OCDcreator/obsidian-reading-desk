import { describe, expect, it } from 'vitest';
import { readerKeyAction, readerKeyTargetIsEditable } from '../../src/reader/ReaderKeyboard';

describe('readerKeyAction', () => {
	it('maps paging keys without modifiers', () => {
		expect(readerKeyAction({ key: 'ArrowRight' })).toEqual({ type: 'page', delta: 1 });
		expect(readerKeyAction({ key: 'PageDown' })).toEqual({ type: 'page', delta: 1 });
		expect(readerKeyAction({ key: ' ' })).toEqual({ type: 'page', delta: 1 });
		expect(readerKeyAction({ key: 'ArrowLeft' })).toEqual({ type: 'page', delta: -1 });
		expect(readerKeyAction({ key: 'PageUp' })).toEqual({ type: 'page', delta: -1 });
	});
	it('maps zoom, fit, rotate and search keys', () => {
		expect(readerKeyAction({ key: '+' })).toEqual({ type: 'zoom', delta: 1 });
		expect(readerKeyAction({ key: '=' })).toEqual({ type: 'zoom', delta: 1 });
		expect(readerKeyAction({ key: '-' })).toEqual({ type: 'zoom', delta: -1 });
		expect(readerKeyAction({ key: 'w' })).toEqual({ type: 'fit', mode: 'width' });
		expect(readerKeyAction({ key: 'h' })).toEqual({ type: 'fit', mode: 'height' });
		expect(readerKeyAction({ key: 'p' })).toEqual({ type: 'fit', mode: 'page' });
		expect(readerKeyAction({ key: 'r' })).toEqual({ type: 'rotate', delta: 90 });
		expect(readerKeyAction({ key: 'R' })).toEqual({ type: 'rotate', delta: -90 });
		expect(readerKeyAction({ key: '/' })).toEqual({ type: 'search' });
		expect(readerKeyAction({ key: 'f' })).toEqual({ type: 'search' });
	});
	it('reserves Alt+Arrow for history navigation', () => {
		expect(readerKeyAction({ key: 'ArrowLeft', altKey: true })).toEqual({ type: 'back' });
		expect(readerKeyAction({ key: 'ArrowRight', altKey: true })).toEqual({ type: 'forward' });
	});
	it('ignores modifier combos and unbound keys', () => {
		expect(readerKeyAction({ key: 'r', ctrlKey: true })).toBeNull();
		expect(readerKeyAction({ key: 'r', metaKey: true })).toBeNull();
		expect(readerKeyAction({ key: 'ArrowLeft', altKey: true, ctrlKey: true })).toBeNull();
		expect(readerKeyAction({ key: 'x' })).toBeNull();
	});
});

class FakeTarget {
	isContentEditable = false;
	constructor(private readonly matches: boolean) { }
	closest(_selector: string): unknown { return this.matches ? {} : null; }
}

describe('readerKeyTargetIsEditable', () => {
	it('rejects plain elements and accepts text-entry surfaces', () => {
		expect(readerKeyTargetIsEditable(new FakeTarget(false))).toBe(false);
		expect(readerKeyTargetIsEditable(new FakeTarget(true))).toBe(true);
		const rich = new FakeTarget(false);
		rich.isContentEditable = true;
		expect(readerKeyTargetIsEditable(rich)).toBe(true);
		expect(readerKeyTargetIsEditable(null)).toBe(false);
		expect(readerKeyTargetIsEditable({} as EventTarget)).toBe(false);
	});
});
