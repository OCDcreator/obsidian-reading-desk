import { FakeEvent } from '../support/fake-dom';
/** Reader-local DOM double: geometry, moved children, Range and backing stores. */
export class ReaderTestDocument {
	activeElement: ReaderTestElement | null = null;
	readonly body = new ReaderTestElement('body', this);
	readonly defaultView = { devicePixelRatio: 3, requestAnimationFrame: (action: () => void) => setTimeout(action, 0), cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) };
	createElement(tag: string): ReaderTestElement { return new ReaderTestElement(tag, this); }
	createElementNS(_namespace: string, tag: string): ReaderTestElement { return this.createElement(tag); }
	createRange(): TestRange { return new TestRange(); }
}
export class ReaderTestElement {
	readonly nodeType = 1;
	readonly tagName: string;
	parentElement: ReaderTestElement | null = null;
	children: ReaderTestElement[] = [];
	textContent = ''; className = ''; type = ''; value = ''; disabled = false; hidden = false; tabIndex = -1;
	width = 0; height = 0; scrollTop = 0; scrollLeft = 0; scrollCount = 0;
	dataset: Record<string, string> = {};
	style: Record<string, string | ((key: string, value: string) => void)> = { setProperty: (key: string, value: string) => { this.style[key] = value; } };
	bounds = { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 };
	private attributes = new Map<string, string>();
	private listeners = new Map<string, Array<(event: FakeEvent) => void>>();
	readonly drawCalls: unknown[][] = [];
	constructor(tag: string, readonly ownerDocument: ReaderTestDocument) { this.tagName = tag.toUpperCase(); }
	get childNodes(): ReaderTestElement[] { return this.children; }
	get firstChild(): ReaderTestElement | null { return this.children[0] ?? null; }
	get offsetWidth(): number { return Number.parseFloat(String(this.style.width)) || this.bounds.width; }
	get offsetHeight(): number { return Number.parseFloat(String(this.style.height)) || this.bounds.height; }
	get clientWidth(): number { return this.bounds.width; }
	get clientHeight(): number { return this.bounds.height; }
	get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
	get classList() {
		return { add: (...names: string[]) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
			remove: (...names: string[]) => { this.className = this.className.split(' ').filter(item => !names.includes(item)).join(' '); },
			contains: (name: string) => this.className.split(' ').includes(name),
			toggle: (name: string, enabled?: boolean) => { const on = enabled ?? !this.classList.contains(name); on ? this.classList.add(name) : this.classList.remove(name); } };
	}
	append(...nodes: ReaderTestElement[]): void { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
	replaceChildren(...nodes: ReaderTestElement[]): void { for (const node of this.children) node.parentElement = null; this.children = []; this.textContent = ''; this.append(...nodes); }
	remove(): void { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
	setAttribute(name: string, value: string): void { this.attributes.set(name, String(value)); }
	getAttribute(name: string): string | null { return name.startsWith('data-') ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] ?? null : this.attributes.get(name) ?? null; }
	removeAttribute(name: string): void { this.attributes.delete(name); }
	contains(node: ReaderTestElement | null): boolean { return !!node && (node === this || this.children.some(child => child.contains(node))); }
	matches(selector: string): boolean {
		return selector.split(',').some(part => {
			const simple = part.trim(); const attrs = [...simple.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
			if (attrs.some(([, name, value]) => this.getAttribute(name) === null || (value !== undefined && this.getAttribute(name) !== value))) return false;
			const base = simple.replace(/\[[^\]]*\]/g, ''); const [tag, ...classes] = base.split('.');
			if (tag && tag !== '*' && tag.toUpperCase() !== this.tagName) return false;
			return classes.every(name => this.classList.contains(name));
		});
	}
	closest(selector: string): ReaderTestElement | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
	querySelectorAll(selector: string): ReaderTestElement[] {
		const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
		return descendants.filter(node => selector.split(',').some(part => {
			const steps = part.trim().split(/\s+/); if (!node.matches(steps.pop() ?? '')) return false;
			let ancestor = node.parentElement;
			while (steps.length) { const step = steps.pop() ?? ''; while (ancestor && !ancestor.matches(step)) ancestor = ancestor.parentElement; if (!ancestor) return false; ancestor = ancestor.parentElement; } return true;
		}));
	}
	querySelector(selector: string): ReaderTestElement | null { return this.querySelectorAll(selector)[0] ?? null; }
	addEventListener(type: string, listener: (event: FakeEvent) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
	dispatchEvent(event: FakeEvent): boolean {
		if (!event.target) event.target = this as never;
		event.currentTarget = this as never;
		let node: ReaderTestElement | null = event.currentTarget as unknown as ReaderTestElement;
		while (node) { event.currentTarget = node as never; for (const listener of node.listeners.get(event.type) ?? []) listener(event); if (event.propagationStopped || !event.bubbles) break; node = node.parentElement; }
		return !event.defaultPrevented;
	}
	click(): void { this.dispatchEvent(new FakeEvent('click')); }
	focus(): void { this.ownerDocument.activeElement = this; }
	scrollIntoView(): void { this.scrollCount += 1; }
	scrollTo(options: { top: number }): void { this.scrollTop = options.top; }
	getBoundingClientRect(): typeof this.bounds { return { ...this.bounds }; }
	createEl(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string>; type?: string } = {}): ReaderTestElement {
		const child = this.ownerDocument.createElement(tag); child.className = options.cls ?? ''; child.textContent = options.text ?? ''; child.type = options.type ?? '';
		for (const [key, value] of Object.entries(options.attr ?? {})) child.setAttribute(key, value); this.append(child); return child;
	}
	createDiv(options?: { cls?: string; attr?: Record<string, string> }): ReaderTestElement { return this.createEl('div', options); }
	createSpan(options?: { cls?: string; text?: string; attr?: Record<string, string> }): ReaderTestElement { return this.createEl('span', options); }
	getContext(): { drawImage: (...args: unknown[]) => void } { return { drawImage: (...args) => this.drawCalls.push(args) }; }
	toBlob(callback: (blob: Blob) => void): void { callback(new Blob(['png'], { type: 'image/png' })); }
}
export class TestRange {
	collapsed = false;
	startContainer: unknown;
	endContainer: unknown;
	start = 0; end = 0;
	text = 'actual selected text';
	rects: Array<{ left: number; top: number; right: number; bottom: number; width: number; height: number }> = [];
	setStart(node: unknown, offset: number): void { this.startContainer = node; this.start = offset; }
	setEnd(node: unknown, offset: number): void { this.endContainer = node; this.end = offset; }
	getClientRects(): typeof this.rects { return this.rects.length ? this.rects : [{ left: this.start * 5, right: this.end * 5, top: 10, bottom: 20, width: (this.end - this.start) * 5, height: 10 }]; }
	toString(): string { return this.text; }
}
export function deferred<T>() {
	let resolve: (value: T) => void = () => undefined; let reject: (error: unknown) => void = () => undefined;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
export async function flushReaderTasks(): Promise<void> { for (let index = 0; index < 20; index += 1) await Promise.resolve(); }
