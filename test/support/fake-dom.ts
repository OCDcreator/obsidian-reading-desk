/**
 * Minimal DOM double with real event-propagation semantics: every element knows
 * its parent, `dispatchEvent` walks the ancestor chain honouring
 * `stopPropagation`, and events carry `target`/`currentTarget`. That lets the
 * outline tests exercise the same bubbling path a browser uses instead of
 * invoking a stored listener directly.
 */

export type FakeListener = (event: FakeEvent) => void;

export class FakeEvent {
	readonly type: string;
	target: FakeElement | null = null;
	currentTarget: FakeElement | null = null;
	defaultPrevented = false;
	propagationStopped = false;
	bubbles = true;
	key = '';
	ctrlKey = false;
	metaKey = false;
	altKey = false;

	constructor(type: string, init: { key?: string } = {}) {
		this.type = type;
		this.key = init.key ?? '';
	}

	preventDefault(): void { this.defaultPrevented = true; }
	stopPropagation(): void { this.propagationStopped = true; }
}

export class FakeDocument {
	activeElement: FakeElement | null = null;
	readonly defaultView: unknown = null;
	createElement(tag: string): FakeElement { return new FakeElement(tag, this); }
}

const SIMPLE_SELECTOR = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)(.*)$/;
const ATTRIBUTE_SELECTOR = /^\[([^\]=]+)(?:=("?)([^\]"]*)\2)?\]/;

function matchesSimple(element: FakeElement, simple: string): boolean {
	const parsed = simple.match(SIMPLE_SELECTOR);
	if (!parsed) return false;
	const [, tag, classes, rest] = parsed;
	if (tag && element.tagName !== tag.toUpperCase()) return false;
	for (const className of (classes ?? '').split('.').filter(Boolean)) {
		if (!element.className.split(/\s+/).includes(className)) return false;
	}
	let tail = rest ?? '';
	while (tail.length > 0) {
		const attribute = tail.match(ATTRIBUTE_SELECTOR);
		if (!attribute) return false;
		const [, name, , value] = attribute;
		const actual = element.getAttribute(name);
		if (actual === null) return false;
		if (value !== undefined && value !== '' && actual !== value) return false;
		tail = tail.slice(attribute[0].length);
	}
	return true;
}

function descendants(root: FakeElement): FakeElement[] {
	return root.children.flatMap(child => [child, ...descendants(child)]);
}

export class FakeElement {
	tagName: string;
	className = '';
	hidden = false;
	text = '';
	type = '';
	scrollCount = 0;
	parent: FakeElement | null = null;
	readonly children: FakeElement[] = [];
	readonly ownerDocument: FakeDocument;
	private readonly attributes = new Map<string, string>();
	private readonly listeners = new Map<string, FakeListener[]>();

	constructor(tagName = 'div', ownerDocument: FakeDocument = new FakeDocument()) {
		this.tagName = tagName.toUpperCase();
		this.ownerDocument = ownerDocument;
	}

	get focused(): boolean { return this.ownerDocument.activeElement === this; }

	createEl(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}): FakeElement {
		const child = new FakeElement(tag, this.ownerDocument);
		child.parent = this;
		if (options.cls) child.className = options.cls;
		if (options.text !== undefined) child.text = options.text;
		for (const [name, value] of Object.entries(options.attr ?? {})) child.setAttribute(name, value);
		this.children.push(child);
		return child;
	}

	createDiv(options: { cls?: string; attr?: Record<string, string> } = {}): FakeElement { return this.createEl('div', options); }
	createSpan(options: { cls?: string; text?: string; attr?: Record<string, string> } = {}): FakeElement { return this.createEl('span', options); }

	append(...nodes: FakeElement[]): void {
		for (const node of nodes) { node.parent = this; this.children.push(node); }
	}

	replaceChildren(...nodes: FakeElement[]): void {
		for (const child of this.children) child.parent = null;
		this.children.length = 0;
		this.text = '';
		this.append(...nodes);
	}

	setAttribute(name: string, value: string): void { this.attributes.set(name, String(value)); }
	getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
	removeAttribute(name: string): void { this.attributes.delete(name); }

	get dataset(): Record<string, string> {
		const data: Record<string, string> = {};
		for (const [name, value] of this.attributes) {
			if (!name.startsWith('data-')) continue;
			const camel = name.slice(5).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
			data[camel] = value;
		}
		return data;
	}

	addEventListener(type: string, listener: FakeListener): void {
		const list = this.listeners.get(type) ?? [];
		list.push(listener);
		this.listeners.set(type, list);
	}

	listenerCount(type: string): number { return this.listeners.get(type)?.length ?? 0; }

	/** Dispatches with real bubbling semantics: target fixes on the receiver and
	 * the event walks ancestors until a listener stops propagation. */
	dispatchEvent(event: FakeEvent): boolean {
		if (!event.target) event.target = this;
		this.runListeners(event);
		let node = event.bubbles ? this.parent : null;
		while (node && !event.propagationStopped) {
			node.runListeners(event);
			node = node.parent;
		}
		event.currentTarget = null;
		return !event.defaultPrevented;
	}

	private runListeners(event: FakeEvent): void {
		event.currentTarget = this;
		for (const listener of [...(this.listeners.get(event.type) ?? [])]) {
			listener(event);
			if (event.propagationStopped) return;
		}
	}

	click(): boolean { return this.dispatchEvent(new FakeEvent('click')); }
	keydown(key: string): boolean { return this.dispatchEvent(new FakeEvent('keydown', { key })); }

	focus(): void {
		this.ownerDocument.activeElement = this;
		const event = new FakeEvent('focus');
		event.bubbles = false;
		this.dispatchEvent(event);
	}
	blur(): void { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
	scrollIntoView(): void { this.scrollCount += 1; }

	contains(other: FakeElement | null): boolean {
		let node: FakeElement | null = other;
		while (node) {
			if (node === this) return true;
			node = node.parent;
		}
		return false;
	}

	closest(selector: string): FakeElement | null {
		if (matchesSimple(this, selector)) return this;
		let node = this.parent;
		while (node) {
			if (matchesSimple(node, selector)) return node;
			node = node.parent;
		}
		return null;
	}

	matches(selector: string): boolean { return matchesSimple(this, selector); }

	querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null; }

	querySelectorAll(selector: string): FakeElement[] {
		const steps = selector.trim().split(/\s+/);
		return descendants(this).filter(candidate => {
			if (!matchesSimple(candidate, steps[steps.length - 1])) return false;
			let node = candidate.parent;
			for (let index = steps.length - 2; index >= 0; index -= 1) {
				while (node && !matchesSimple(node, steps[index])) node = node.parent;
				if (!node) return false;
				node = node.parent;
			}
			return true;
		});
	}
}
