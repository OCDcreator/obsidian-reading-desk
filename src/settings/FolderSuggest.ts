import { AbstractInputSuggest, App, prepareFuzzySearch, TFolder } from 'obsidian';
import { lastSegment, replaceLastSegment } from './FolderSelection';

/** 库内文件夹的模糊建议:只匹配逗号分隔列表里正在输入的最后一段。 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private readonly vaultFolders: () => TFolder[];

	constructor(app: App, inputEl: HTMLInputElement, vaultFolders: () => TFolder[]) {
		super(app, inputEl);
		this.vaultFolders = vaultFolders;
	}

	getSuggestions(query: string): TFolder[] {
		const segment = lastSegment(query).trim();
		const folders = this.vaultFolders();
		if (segment === '') return folders.slice(0, 30);
		const search = prepareFuzzySearch(segment);
		return folders
			.map(folder => ({ folder, match: search(folder.path) ?? search(folder.name) }))
			.filter(item => item.match !== null)
			.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
			.slice(0, 30)
			.map(item => item.folder);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.addClass('rd-folder-suggest');
		el.createSpan({ cls: 'rd-folder-suggest__name', text: folder.name });
		if (folder.path !== folder.name) {
			el.createSpan({ cls: 'rd-folder-suggest__path', text: folder.path });
		}
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(replaceLastSegment(this.getValue(), folder.path));
		this.close();
	}
}
