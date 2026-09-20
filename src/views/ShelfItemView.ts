import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { LibraryIndex } from '../library/LibraryIndex';
import { ShelfView } from './ShelfView';

export const SHELF_VIEW_TYPE = 'reading-desk-shelf';

export interface ShelfNavigation {
	open(path: string): Promise<void>;
	scan(): Promise<void>;
	resourceUrl(path: string): string | null;
	openSettings?(): Promise<void>;
}

export class ShelfItemView extends ItemView {
	private readonly shelf: ShelfView;

	constructor(leaf: WorkspaceLeaf, index: LibraryIndex, navigation: ShelfNavigation) {
		super(leaf);
		this.shelf = new ShelfView({
			getBooks: () => index.list(),
			getCategories: () => index.listCategories(),
			addCategory: name => index.addCategory(name),
			reorderCategories: ids => index.reorderCategories(ids),
			updateBook: (id, patch) => index.updateBook(id, patch),
			openBook: book => navigation.open(book.path),
			scan: () => navigation.scan(),
			resolveCoverUrl: path => navigation.resourceUrl(path)
		});
	}

	getViewType(): string { return SHELF_VIEW_TYPE; }
	getDisplayText(): string { return 'Reading Desk 书架'; }
	async onOpen(): Promise<void> { await this.shelf.render(this.containerEl.children[1] as HTMLElement); }
	async onClose(): Promise<void> { this.shelf.destroy(); }
}
