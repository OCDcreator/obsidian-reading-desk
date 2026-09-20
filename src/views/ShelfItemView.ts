import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { AnnotationStore } from '../annotations/AnnotationStore';
import type { LibraryIndex } from '../library/LibraryIndex';
import { ShelfView } from './ShelfView';

export const SHELF_VIEW_TYPE = 'reading-desk-shelf';

export interface ShelfNavigation {
	open(path: string): Promise<void>;
	scan(): Promise<void>;
	resourceUrl(path: string): string | null;
	openSettings?(tab?: string): Promise<void>;
}

export class ShelfItemView extends ItemView {
	private readonly shelf: ShelfView;

	constructor(leaf: WorkspaceLeaf, index: LibraryIndex, annotations: AnnotationStore, navigation: ShelfNavigation) {
		super(leaf);
		this.shelf = new ShelfView({
			getBooks: () => index.list(),
			getCategories: () => index.listCategories(),
			addCategory: name => index.addCategory(name),
			renameCategory: (id, name) => index.renameCategory(id, name),
			removeCategory: id => index.removeCategory(id),
			reorderCategories: ids => index.reorderCategories(ids),
			updateBook: (id, patch) => index.updateBook(id, patch),
			openBook: book => navigation.open(book.path),
			scan: () => navigation.scan(),
			countHighlights: () => annotations.listAll().length,
			resolveCoverUrl: path => navigation.resourceUrl(path),
			openSettings: tab => navigation.openSettings?.(tab)
		});
	}

	getViewType(): string { return SHELF_VIEW_TYPE; }
	getDisplayText(): string { return 'Reading Desk 书架'; }
	async onOpen(): Promise<void> { await this.shelf.render(this.containerEl.children[1] as HTMLElement); }
	async onClose(): Promise<void> { this.shelf.destroy(); }
}
