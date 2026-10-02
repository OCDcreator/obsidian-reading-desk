import { FakeEvent } from '../../support/fake-dom';
/** Focus + bubbling DOM used for shelf/toolbar contracts without patching shared doubles. */
export class UiDocument {
	activeElement: UiNode | null = null;
	readonly body = new UiNode('body', this);
	createElement(tag: string): UiNode {
		if (tag === 'input') return new UiInput(tag, this);
		if (tag === 'select') return new UiSelect(tag, this);
		if (tag === 'button') return new UiButton(tag, this);
		return new UiNode(tag, this);
	}
}
export class UiNode {
	readonly tagName: string;
	parentElement: UiNode | null = null;
	children: UiNode[] = [];
	textContent = '';
	className = '';
	type = '';
	value = '';
	disabled = false;
	hidden = false;
	checked = false;
	tabIndex = -1;
	title = '';
	placeholder = '';
	selectionStart: number | null = 0;
	selectionEnd: number | null = 0;
	style: Record<string, string> = {};
	dataset: Record<string, string> = {};
	private attributes = new Map<string, string>();
	private listeners = new Map<string, Array<(event: FakeEvent) => void>>();
	constructor(tag: string, readonly ownerDocument: UiDocument) { this.tagName = tag.toUpperCase(); }
	get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
	get classList(): { add: (...names: string[]) => void; toggle: (name: string, on?: boolean) => void; contains: (name: string) => boolean } {
		return {
			add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
			toggle: (name, on) => { const has = this.classList.contains(name); const enabled = on ?? !has; this.className = this.className.split(' ').filter(item => item !== name).concat(enabled ? [name] : []).join(' '); },
			contains: name => this.className.split(' ').includes(name)
		};
	}
	addClass(name: string): void { this.classList.add(name); }
	get text(): string { return this.textContent; }
	get options(): UiNode[] { return this.children; }
	get selectedOptions(): UiNode[] { return this.children.filter(node => node.value === this.value); }
	append(...values: Array<UiNode | string>): void {
		for (const value of values) { const node = typeof value === 'string' ? new UiNode('text', this.ownerDocument) : value; if (typeof value === 'string') node.textContent = value; node.parentElement = this; this.children.push(node); }
	}
	replaceChildren(...values: UiNode[]): void { for (const node of this.children) node.parentElement = null; this.children = []; this.textContent = ''; this.append(...values); }
	remove(): void { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
	setAttribute(name: string, value: string): void { this.attributes.set(name, String(value)); if (name === 'disabled') this.disabled = true; }
	getAttribute(name: string): string | null {
		if (name === 'disabled') return this.disabled ? '' : null;
		if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] ?? null;
		return this.attributes.get(name) ?? null;
	}
	hasAttribute(name: string): boolean { return this.getAttribute(name) !== null; }
	removeAttribute(name: string): void { this.attributes.delete(name); }
	contains(node: UiNode | null): boolean { return !!node && (node === this || this.children.some(child => child.contains(node))); }
	matches(selector: string): boolean {
		return selector.split(',').some(part => {
			const simple = part.trim(); const attrs = [...simple.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
			if (attrs.some(([, name, value]) => !this.hasAttribute(name) || (value !== undefined && this.getAttribute(name) !== value))) return false;
			const base = simple.replace(/\[[^\]]*\]/g, ''); const [tag, ...classes] = base.split('.');
			if (tag && tag.toUpperCase() !== this.tagName) return false;
			return classes.every(name => this.classList.contains(name));
		});
	}
	closest(selector: string): UiNode | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
	querySelectorAll(selector: string): UiNode[] {
		const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
		if (selector === '*') return descendants;
		return descendants.filter(node => selector.split(',').some(part => {
			const steps = part.trim().match(/(?:[^\s"]|"[^"]*")+/g) ?? []; if (!node.matches(steps.pop() ?? '')) return false;
			let ancestor = node.parentElement;
			while (steps.length) { const step = steps.pop() ?? ''; while (ancestor && !ancestor.matches(step)) ancestor = ancestor.parentElement; if (!ancestor) return false; ancestor = ancestor.parentElement; } return true;
		}));
	}
	querySelector(selector: string): UiNode | null { return this.querySelectorAll(selector)[0] ?? null; }
	addEventListener(type: string, listener: (event: FakeEvent) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
	dispatchEvent(event: FakeEvent): boolean {
		if (!event.target) event.target = this as never;
		let node: UiNode | null = event.target as unknown as UiNode;
		while (node) { event.currentTarget = node as never; for (const listener of node.listeners.get(event.type) ?? []) listener(event); if (event.propagationStopped || !event.bubbles) break; node = node.parentElement; }
		event.currentTarget = null; return !event.defaultPrevented;
	}
	click(): void { if (!this.disabled) this.dispatchEvent(new FakeEvent('click')); }
	keydown(key: string): FakeEvent { const event = new FakeEvent('keydown', { key }); this.dispatchEvent(event); return event; }
	change(value?: string): void { if (value !== undefined) this.value = value; this.dispatchEvent(new FakeEvent('change')); }
	focus(): void { this.ownerDocument.activeElement = this; }
	blur(): void { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; this.dispatchEvent(new FakeEvent('blur')); }
	setSelectionRange(start: number, end: number): void { this.selectionStart = start; this.selectionEnd = end; }
	getBoundingClientRect(): { left: number; bottom: number } { return { left: 0, bottom: 20 }; }
	createEl(tag: string, options: { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; value?: string } = {}): UiNode {
		const child = this.ownerDocument.createElement(tag); child.className = Array.isArray(options.cls) ? options.cls.join(' ') : options.cls ?? ''; child.textContent = options.text ?? ''; child.type = options.type ?? ''; child.value = options.value ?? ''; for (const [key, value] of Object.entries(options.attr ?? {})) child.setAttribute(key, value); this.append(child); return child;
	}
	createDiv(options?: { cls?: string; attr?: Record<string, string> }): UiNode { return this.createEl('div', options); }
	createSpan(options?: { cls?: string; text?: string; attr?: Record<string, string> }): UiNode { return this.createEl('span', options); }
	createTHead(): UiNode { return this.createEl('thead'); }
	createTBody(): UiNode { return this.createEl('tbody'); }
	insertRow(): UiNode { return this.createEl('tr'); }
	insertCell(): UiNode { return this.createEl('td'); }
}
export class UiInput extends UiNode {}
export class UiSelect extends UiNode {}
export class UiButton extends UiNode {}
export function installDom(stub: (name: string, value: unknown) => void): UiDocument {
	const document = new UiDocument();
	stub('document', document); stub('HTMLElement', UiNode); stub('HTMLInputElement', UiInput); stub('HTMLSelectElement', UiSelect); stub('HTMLButtonElement', UiButton);
	stub('getComputedStyle', (node: UiNode) => ({ display: node.style.display ?? 'block' })); return document;
}
export async function flush(): Promise<void> { for (let i = 0; i < 15; i++) await Promise.resolve(); }
