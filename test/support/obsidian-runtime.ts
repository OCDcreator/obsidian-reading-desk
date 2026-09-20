export function normalizePath(value: string): string {
	return value
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/')
		.replace(/\/$/, '');
}

export class TAbstractFile {
	path: string;
	name: string;

	constructor(path: string) {
		this.path = normalizePath(path);
		this.name = this.path.split('/').pop() ?? '';
	}
}

export class TFile extends TAbstractFile {
	stat: { size: number };

	constructor(path: string, size = 0) {
		super(path);
		this.stat = { size };
	}
}

export class Vault {}

export class EventRef {}

export class ItemView {
	containerEl = { children: [] };
	constructor(leaf?: unknown) { void leaf; }
}

export class Notice { constructor(message: string) { void message; } }
export function setIcon(element: unknown, icon: string): void { void element; void icon; }

export class Menu {
	setUseNativeMenu(_value: boolean): this { return this; }
	addItem(_builder: (item: { setTitle(title: string): unknown; onClick(action: () => void): unknown }) => void): this { return this; }
	showAtMouseEvent(event: unknown): void { void event; }
	showAtPosition(position: { x: number; y: number }, document?: unknown): void { void position; void document; }
}

export async function requestUrl(): Promise<never> {
	throw new Error('requestUrl is not implemented in the test runtime');
}
