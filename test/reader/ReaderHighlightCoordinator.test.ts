import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderHighlightCoordinator } from '../../src/reader/ReaderHighlightCoordinator';

class Classes {
	private readonly values = new Set<string>();
	add(value: string): void { this.values.add(value); }
	remove(value: string): void { this.values.delete(value); }
	contains(value: string): boolean { return this.values.has(value); }
}

class ElementDouble {
	readonly dataset: Record<string, string> = {};
	readonly classList = new Classes();
	readonly children: ElementDouble[] = [];
	private readonly listeners = new Map<string, EventListener[]>();
	parentElement: ElementDouble | null = null;
	tabIndex = -1;
	append(...nodes: ElementDouble[]): void { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
	closest<T>(selector: string): T | null {
		if (selector === '[data-highlight-id]' && this.dataset.highlightId) return this as unknown as T;
		if (selector === '.rd-highlight-row' && this.classList.contains('rd-highlight-row')) return this as unknown as T;
		return this.parentElement?.closest<T>(selector) ?? null;
	}
	querySelectorAll<T>(): T[] { return this.children.flatMap(child => [...(child.dataset.highlightId ? [child as unknown as T] : []), ...child.querySelectorAll<T>()]); }
	addEventListener(type: string, listener: EventListener): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
	removeEventListener(type: string, listener: EventListener): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener)); }
	emit(type: string, target: ElementDouble, relatedTarget: ElementDouble | null = null): void {
		const event = new Event(type); Object.defineProperty(event, 'target', { value: target }); Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}
}

function item(id: string, row = false): ElementDouble {
	const node = new ElementDouble(); node.dataset.highlightId = id; if (row) node.classList.add('rd-highlight-row'); return node;
}

describe('ReaderHighlightCoordinator integration', () => {
	const original = globalThis.HTMLElement;
	beforeEach(() => { Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: ElementDouble }); });
	afterEach(() => { Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: original }); });

	it('keeps scope independent across two Reader leaf coordinators', () => {
		const left = new ReaderHighlightCoordinator(vi.fn());
		const right = new ReaderHighlightCoordinator(vi.fn());
		left.setScope('page');
		expect(left.getScope()).toBe('page');
		expect(right.getScope()).toBe('book');
	});

	it('links multiple PDF rects to one row, clears on focusout, rebind transition, and close', () => {
		const coordinator = new ReaderHighlightCoordinator(vi.fn());
		const firstPage = new ElementDouble(); const rectA = item('h-1'); const rectB = item('h-1'); firstPage.append(rectA, rectB);
		const drawer = new ElementDouble(); const row = item('h-1', true); drawer.append(row);
		coordinator.bind(firstPage as unknown as HTMLElement, drawer as unknown as HTMLElement);
		drawer.emit('focusin', row);
		expect([rectA, rectB, row].every(node => node.classList.contains('is-previewed'))).toBe(true);
		drawer.emit('focusout', row);
		expect([rectA, rectB, row].every(node => !node.classList.contains('is-previewed'))).toBe(true);
		firstPage.emit('mouseover', rectA);
		const nextPage = new ElementDouble(); nextPage.append(item('h-2'));
		coordinator.bind(nextPage as unknown as HTMLElement, drawer as unknown as HTMLElement);
		expect(rectA.classList.contains('is-previewed')).toBe(false);
		firstPage.emit('mouseover', rectA);
		expect(row.classList.contains('is-previewed')).toBe(false);
		drawer.emit('mouseover', row);
		coordinator.close();
		expect(row.classList.contains('is-previewed')).toBe(false);
		drawer.emit('mouseover', row);
		expect(row.classList.contains('is-previewed')).toBe(false);
	});
});
