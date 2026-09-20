import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighlightPreviewController } from '../../src/reader/HighlightPreviewController';

class FakeClassList {
	private readonly values = new Set<string>();
	add(value: string): void { this.values.add(value); }
	remove(value: string): void { this.values.delete(value); }
	contains(value: string): boolean { return this.values.has(value); }
}

class FakeElement {
	readonly children: FakeElement[] = [];
	readonly classList = new FakeClassList();
	readonly dataset: Record<string, string> = {};
	tabIndex = -1;
	parentElement: FakeElement | null = null;
	private readonly listeners = new Map<string, EventListener[]>();

	append(...children: FakeElement[]): void {
		for (const child of children) { child.parentElement = this; this.children.push(child); }
	}

	closest<T>(selector: string): T | null {
		for (const node of [this, ...this.ancestors()]) {
			if (selector === '[data-highlight-id]' && node.dataset.highlightId) return node as unknown as T;
			if (selector === '.rd-highlight-row' && node.classList.contains('rd-highlight-row')) return node as unknown as T;
			if (selector.startsWith('button') && node.classList.contains('is-button')) return node as unknown as T;
		}
		return null;
	}

	private ancestors(): FakeElement[] {
		return this.parentElement ? [this.parentElement, ...this.parentElement.ancestors()] : [];
	}

	querySelectorAll<T>(_selector: string): T[] {
		return this.children.flatMap(child => [
			...(child.dataset.highlightId ? [child as unknown as T] : []),
			...child.querySelectorAll<T>(_selector)
		]);
	}

	addEventListener(type: string, listener: EventListener): void {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	removeEventListener(type: string, listener: EventListener): void {
		this.listeners.set(type, (this.listeners.get(type) ?? []).filter(candidate => candidate !== listener));
	}

	emit(type: string, target: FakeElement, relatedTarget: FakeElement | null = null, key = ''): void {
		const event = new PreviewEvent(type, relatedTarget);
		event.key = key;
		Object.defineProperty(event, 'target', { value: target });
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}
}

class PreviewEvent extends Event {
	key = '';
	constructor(type: string, readonly relatedTarget: EventTarget | null = null) { super(type, { bubbles: true }); }
}

describe('HighlightPreviewController', () => {
	const originalHTMLElement = globalThis.HTMLElement;

	beforeEach(() => {
		Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FakeElement });
	});

	afterEach(() => {
		Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: originalHTMLElement });
	});

	it('links every rect to its drawer row and clears on leave, rebind, and destroy', () => {
		const page = new FakeElement();
		const rectOne = item('h-1');
		const rectTwo = item('h-1');
		page.append(rectOne, rectTwo);
		const drawer = new FakeElement();
		const row = item('h-1');
		drawer.append(row);
		const controller = new HighlightPreviewController(vi.fn());
		controller.bind(page as unknown as HTMLElement, drawer as unknown as HTMLElement);

		page.emit('mouseover', rectOne);
		expect([rectOne, rectTwo, row].every(node => node.classList.contains('is-previewed'))).toBe(true);
		page.emit('mouseout', rectOne, rectTwo);
		expect([rectOne, rectTwo, row].every(node => node.classList.contains('is-previewed'))).toBe(true);
		page.emit('mouseout', rectTwo);
		expect([rectOne, rectTwo, row].every(node => !node.classList.contains('is-previewed'))).toBe(true);

		drawer.emit('focusin', row);
		expect(rectTwo.classList.contains('is-previewed')).toBe(true);
		controller.bind(page as unknown as HTMLElement, drawer as unknown as HTMLElement);
		expect(rectTwo.classList.contains('is-previewed')).toBe(false);
		controller.destroy();
	});

	it('makes PDF marks keyboard reachable and preserves the jump action', () => {
		const jump = vi.fn();
		const page = new FakeElement();
		const mark = item('h-2');
		page.append(mark);
		const controller = new HighlightPreviewController(jump);
		controller.bind(page as unknown as HTMLElement);
		expect(mark.tabIndex).toBe(0);
		page.emit('keydown', mark, null, 'Enter');
		expect(jump).toHaveBeenCalledWith('h-2');
		const comment = item('h-2');
		comment.classList.add('is-button');
		page.append(comment);
		controller.bind(page as unknown as HTMLElement);
		page.emit('keydown', comment, null, 'Enter');
		expect(jump).toHaveBeenCalledTimes(1);
	});
});

function item(id: string): FakeElement {
	const element = new FakeElement();
	element.dataset.highlightId = id;
	return element;
}
