import { TFile, type App } from 'obsidian';
import { isAlreadyExistingFolderError } from './HostUtilities';

/** Vault file IO extracted from main.ts so the composition boundary stays under the owner-guard line budget. */
export class VaultFiles {
	constructor(private readonly app: App) { }

	async atomicTransform(path: string, transform: (current: string) => string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.process(existing, current => transform(current));
			return;
		}
		await this.ensureFile(path, await transform(''));
	}

	async ensureFile(path: string, content: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return;
		await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
		await this.app.vault.create(path, content);
	}

	async ensureFolder(path: string): Promise<void> {
		const parts = path.split('/').filter(Boolean);
		for (let index = 1; index <= parts.length; index += 1) {
			const partial = parts.slice(0, index).join('/');
			if (this.app.vault.getAbstractFileByPath(partial)) continue;
			try {
				await this.app.vault.createFolder(partial);
			} catch (error) {
				if (!isAlreadyExistingFolderError(error)) throw error;
			}
		}
	}

	async writeBinary(path: string, value: ArrayBuffer): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, value);
		else {
			await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
			await this.app.vault.createBinary(path, value);
		}
	}
}
