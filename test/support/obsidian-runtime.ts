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

export async function requestUrl(): Promise<never> {
	throw new Error('requestUrl is not implemented in the test runtime');
}
