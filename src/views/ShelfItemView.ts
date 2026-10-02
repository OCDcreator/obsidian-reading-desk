import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { LibraryIndex } from '../library/LibraryIndex';
import type { LibraryBook, ShelfViewState } from '../types/contracts';
import type { Awaitable, ShelfCandidateFile, ShelfAnnotationQuery, ShelfAnnotationHit } from '../ui/shelf/ShelfHost';
import { ShelfView } from './ShelfView';

export const SHELF_VIEW_TYPE = 'reading-desk-shelf';
export interface ShelfNavigation {
	open(path: string): Promise<void>;
	scan(): Promise<void>;
	resourceUrl(path: string): string | null;
	openSettings?(): Awaitable<void>;
	readShelfState?(): Awaitable<ShelfViewState | undefined>;
	saveShelfState?(state: ShelfViewState): Awaitable<void>;
	searchAnnotations?(query: ShelfAnnotationQuery): Awaitable<ShelfAnnotationHit[]>;
	openHighlight?(path: string, id: string): Awaitable<void>;
	listSourcePaths?(): Awaitable<string[]>;
	candidateFiles?(): Awaitable<ShelfCandidateFile[]>;
	/** Host migrates AnnotationStore paths and refreshes targets as well as LibraryIndex. */
	relinkBook?(id: string, path: string): Awaitable<void>;
}
export class ShelfItemView extends ItemView {
	private readonly shelf: ShelfView;
	constructor(leaf: WorkspaceLeaf, index: LibraryIndex, navigation: ShelfNavigation) {
		super(leaf);
		this.shelf = new ShelfView({
			getBooks: () => index.list(), getCategories: () => index.listCategories(),
			addCategory: name => index.addCategory(name), reorderCategories: ids => index.reorderCategories(ids),
			updateBook: (id, patch) => index.updateBook(id, patch),
			getLists: () => index.listLists(), createList: name => index.createList(name),
			renameList: (id, name) => index.renameList(id, name), deleteList: id => index.deleteList(id),
			readShelfState: navigation.readShelfState, saveShelfState: navigation.saveShelfState,
			batchUpdate: (ids, patch) => index.batchUpdate(ids, patch),
			clearMetadataOverride: (id, fields) => index.clearMetadataOverride(id, fields),
			openBook: (book: LibraryBook) => navigation.open(book.path), scan: () => navigation.scan(),
			resolveCoverUrl: path => navigation.resourceUrl(path), openSettings: navigation.openSettings,
			searchAnnotations: navigation.searchAnnotations, openHighlight: navigation.openHighlight,
			candidateFiles: navigation.candidateFiles, listSourcePaths: navigation.listSourcePaths, relinkBook: navigation.relinkBook
		});
	}
	getViewType(): string { return SHELF_VIEW_TYPE; }
	getDisplayText(): string { return 'Reading Desk 书架'; }
	async onOpen(): Promise<void> { await this.shelf.render(this.containerEl.children[1] as HTMLElement); }
	async onClose(): Promise<void> { await this.shelf.destroy(); }
}
