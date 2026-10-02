import type { LibraryBook, LibraryCategory, LibraryList, SourceFingerprint } from '../types/contracts';
import { createId } from '../utils/ids';
import { applyAutomaticMetadata, applyBookPatch, clearOverrides, extractedAutomaticMetadata, uniqueValues, validateBookPatch } from './LibraryMetadata';
import { planImportedBooks } from './LibraryImport';
import type { ExtractedBookMetadata, LibraryBookPatch, LibraryFile, LibraryFileEvent, LibraryImportUpdate, LibraryRelinkCandidate, LibraryRelinkOptions, LibraryRelinkResult, MetadataField } from './LibraryTypes';
export type { LibraryBookPatch, LibraryFile, LibraryFileEvent, LibraryImportUpdate, LibraryRelinkCandidate, LibraryRelinkOptions, LibraryRelinkResult } from './LibraryTypes';

export interface LibraryPersistence {
	readBooks(): Record<string, LibraryBook>;
	readCategories(): LibraryCategory[];
	readLists?(): LibraryList[];
	commit(mutator: () => void): Promise<void>;
}

export interface BookMetadataExtractor {
	extract(file: LibraryFile): Promise<ExtractedBookMetadata>;
}

export class LibraryIndex {
	private writeQueue: Promise<void> = Promise.resolve();
	private paths = new Map<string, string>();
	private indexedBooks?: Record<string, LibraryBook>;

	constructor(private readonly persistence: LibraryPersistence, private readonly extractor: BookMetadataExtractor) { }

	list(): LibraryBook[] {
		return Object.values(this.persistence.readBooks()).sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
	}

	get(id: string): LibraryBook | undefined {
		return this.persistence.readBooks()[id];
	}

	listCategories(): LibraryCategory[] {
		return [...this.persistence.readCategories()].sort((left, right) => left.order - right.order);
	}

	listLists(): LibraryList[] {
		return (this.persistence.readLists?.() ?? []).map(list => ({ ...list }));
	}

	getByPath(path: string): LibraryBook | undefined {
		this.ensurePathIndex();
		const id = this.paths.get(path);
		const book = id ? this.get(id) : undefined;
		return book?.path === path ? book : undefined;
	}

	/** Call after host-side restore/reload that mutates the same books object. */
	rebuildPathMap(): void {
		const books = this.persistence.readBooks();
		this.paths = new Map(Object.values(books).filter(book => book.path).map(book => [book.path, book.id]));
		this.indexedBooks = books;
	}

	/** Complete reconciliation. Missing sources keep their identity and organization. */
	scan(files: LibraryFile[], folders: string[], retryRecoverable = false): Promise<LibraryBook[]> {
		return this.enqueue(() => this.scanBatch(files, folders, retryRecoverable, true));
	}

	/** Incremental scan: absence from this batch never means deletion/missing. */
	scanFiles(files: LibraryFile[], folders: string[] = [], retryCovers = false): Promise<LibraryBook[]> {
		return this.enqueue(() => this.scanBatch(files, folders, retryCovers, false));
	}

	/** Last event for a path wins; all extracted changes and missing flags share one commit. */
	applyFileEvents(events: LibraryFileEvent[], folders: string[] = []): Promise<LibraryBook[]> {
		return this.enqueue(async () => {
			const pending = new Map<string, LibraryFile | null>();
			for (const event of events) pending.set(event.type === 'delete' ? event.path : event.file.path, event.type === 'delete' ? null : event.file);
			const files = [...pending.values()].filter((file): file is LibraryFile => !!file);
			const deleted = [...pending.entries()].filter(([, file]) => !file).map(([path]) => path);
			return this.scanBatch(files, folders, false, false, deleted);
		});
	}

	markMissing(path: string): Promise<void> {
		return this.enqueue(async () => {
			const missing = this.booksAtOrBelow(path).filter(book => !book.missing);
			if (missing.length) await this.commitBooks(missing.map(book => ({ ...book, missing: true })));
		});
	}

	/** Online vault rename; includes folder descendants without re-extraction. */
	renamePaths(oldPath: string, newPath: string, mutateRelated?: (oldPath: string, newPath: string) => void): Promise<void> {
		return this.enqueue(async () => {
			const from = oldPath.replace(/\/$/, '');
			const to = newPath.replace(/\/$/, '');
			if (!from || !to) throw new Error('重命名路径不能为空');
			if (from === to) return;
			const originals = this.booksAtOrBelow(from);
			const ids = new Set(originals.map(book => book.id));
			const moved = originals.map(book => ({ ...book, path: to + book.path.slice(from.length) }));
			for (const book of moved) {
				const occupied = this.getByPath(book.path);
				if (occupied && !ids.has(occupied.id)) throw new Error(`重命名路径已属于另一书目：${book.path}`);
			}
			if (moved.length || mutateRelated) await this.commitBooks(moved, [], () => mutateRelated?.(from, to));
		});
	}

	updateBook(id: string, patch: LibraryBookPatch): Promise<void> {
		return this.batchUpdate([id], patch);
	}

	/** tags replace by default; append/remove are explicit. null clears category/rating. */
	batchUpdate(ids: string[], patch: LibraryBookPatch): Promise<void> {
		return this.enqueue(async () => {
			validateBookPatch(patch);
			const books = [...new Set(ids)].map(id => this.require(id));
			if (patch.categoryId && !this.persistence.readCategories().some(category => category.id === patch.categoryId)) throw new Error(`未找到分类：${patch.categoryId}`);
			if (patch.listIds) this.validateLists(patch.listIds);
			if (books.length) await this.commitBooks(books.map(book => applyBookPatch(book, patch)));
		});
	}

	clearMetadataOverride(id: string, fields: MetadataField[] = ['title', 'author']): Promise<void> {
		return this.enqueue(async () => {
			if (fields.some(field => field !== 'title' && field !== 'author')) throw new Error('无效的元数据字段');
			await this.commitBooks([clearOverrides(this.require(id), fields)]);
		});
	}

	updateProgress(id: string, progress: number): Promise<void> {
		return this.enqueue(async () => {
			const book = this.get(id);
			if (!book) return;
			if (!Number.isFinite(progress)) throw new Error('阅读进度必须是有限数值');
			await this.commitBooks([{ ...book, progress: Math.max(0, Math.min(1, progress)), lastReadAt: Date.now() }]);
		});
	}

	addCategory(name: string): Promise<LibraryCategory> {
		return this.enqueue(async () => {
			const category: LibraryCategory = { id: createId('category'), name: requireName(name), order: this.persistence.readCategories().length };
			await this.persistence.commit(() => this.persistence.readCategories().push(category));
			return category;
		});
	}

	reorderCategories(ids: string[]): Promise<void> {
		return this.enqueue(async () => {
			await this.persistence.commit(() => {
				const categories = this.persistence.readCategories();
				const order = [...new Set(ids)];
				const ordered = order.map(id => categories.find(category => category.id === id)).filter((category): category is LibraryCategory => !!category);
				const remaining = categories.filter(category => !order.includes(category.id));
				categories.splice(0, categories.length, ...[...ordered, ...remaining].map((category, position) => ({ ...category, order: position })));
			});
		});
	}

	createList(name: string): Promise<LibraryList> {
		return this.enqueue(async () => {
			const list: LibraryList = { id: createId('list'), name: requireName(name) };
			this.requireLists();
			await this.persistence.commit(() => this.requireLists().push(list));
			return { ...list };
		});
	}

	renameList(id: string, name: string): Promise<void> {
		return this.enqueue(async () => {
			const normalized = requireName(name);
			if (!this.requireLists().some(list => list.id === id)) throw new Error(`未找到列表：${id}`);
			await this.persistence.commit(() => { this.requireLists().find(list => list.id === id).name = normalized; });
		});
	}

	deleteList(id: string): Promise<void> {
		return this.enqueue(async () => {
			const position = this.requireLists().findIndex(list => list.id === id);
			if (position < 0) throw new Error(`未找到列表：${id}`);
			await this.persistence.commit(() => {
				this.requireLists().splice(position, 1);
				for (const book of Object.values(this.persistence.readBooks())) {
					if (book.listIds?.includes(id)) book.listIds = book.listIds.filter(listId => listId !== id);
				}
			});
		});
	}

	setListMembership(ids: string[], listId: string, included: boolean): Promise<void> {
		return this.enqueue(async () => {
			this.validateLists([listId]);
			const books = [...new Set(ids)].map(id => this.require(id));
			if (books.length) await this.commitBooks(books.map(book => ({ ...book, listIds: included ? uniqueValues([...(book.listIds ?? []), listId]) : (book.listIds ?? []).filter(id => id !== listId) })));
		});
	}

	findRelinkCandidates(id: string, files: LibraryFile[]): LibraryRelinkCandidate[] {
		const book = this.require(id);
		return files.filter(file => isSupported(file) && file.path !== book.path)
			.map(file => ({ file, sameName: basename(file.path).toLowerCase() === basename(book.path).toLowerCase(), sameFingerprint: sameFingerprint(book.fingerprint, toFingerprint(file)) }))
			.filter(candidate => candidate.sameName || candidate.sameFingerprint)
			.sort((left, right) => Number(right.sameName) - Number(left.sameName) || left.file.path.localeCompare(right.file.path));
	}

	/** Host coordinates annotation and target remapping using oldPath. */
	relink(id: string, file: LibraryFile, options: LibraryRelinkOptions): Promise<LibraryRelinkResult> {
		return this.enqueue(async () => {
			if (options?.confirmed !== true) throw new Error('重新关联源文件需要明确确认');
			if (!isSupported(file)) throw new Error('只能关联 PDF 或 EPUB 源文件');
			const previous = this.require(id);
			const occupied = this.getByPath(file.path);
			if (occupied && occupied.id !== id && options.replaceBookId !== occupied.id) throw new Error('候选路径已属于另一书目，请明确确认替换该候选书目');
			const extracted = options.skipExtraction ? undefined : await this.extract(file);
			const book = extracted ? this.scannedBook(file, extracted, this.require(id))
				: { ...this.require(id), path: file.path, format: file.extension.toLowerCase() === 'epub' ? 'epub' as const : 'pdf' as const, fileSize: file.stat.size, fingerprint: toFingerprint(file), missing: false };
			await this.commitBooks([book], occupied && occupied.id !== id ? [occupied.id] : [], () => options.mutateRelated?.(previous.path, file.path));
			return { bookId: id, oldPath: previous.path, newPath: file.path };
		});
	}

	/** Source identity/path/ID only. No automatic same-name or DOI merging. */
	applyImportedBooks(books: LibraryBook[]): Promise<LibraryBook[]> {
		return this.enqueue(async () => {
			const planned = planImportedBooks(this.persistence.readBooks(), books);
			if (planned.length) await this.commitBooks(planned);
			return planned;
		});
	}

	updateImport(update: LibraryImportUpdate): Promise<LibraryBook> {
		const book: LibraryBook = {
			id: update.bookId ?? createId('book'), path: update.path,
			format: update.path.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf',
			title: update.title, author: update.author, source: { ...update.source },
			tags: [...(update.tags ?? [])], progress: 0, fileSize: 0,
			fingerprint: { mtime: 0, size: 0 }
		};
		return this.applyImportedBooks([book]).then(books => books[0]);
	}

	private async scanBatch(files: LibraryFile[], folders: string[], retryRecoverable: boolean, reconcile: boolean, deleted: string[] = []): Promise<LibraryBook[]> {
		const inScope = new Map(files.filter(file => isSupported(file) && belongsToFolders(file.path, folders)).map(file => [file.path, file]));
		const changed = new Map<string, LibraryBook>();
		for (const file of inScope.values()) {
			const previous = this.getByPath(file.path);
			if (previous && sameFingerprint(previous.fingerprint, toFingerprint(file)) && !needsRecoverableRetry(previous, retryRecoverable)) {
				if (previous.missing) changed.set(previous.id, { ...previous, missing: false });
				continue;
			}
			const extracted = await this.extract(file);
			const book = this.scannedBook(file, extracted, this.getByPath(file.path));
			changed.set(book.id, book);
		}
		if (reconcile) {
			for (const book of Object.values(this.persistence.readBooks())) {
				if (book.path && belongsToFolders(book.path, folders) && !inScope.has(book.path) && !book.missing) changed.set(book.id, { ...book, missing: true });
			}
		}
		for (const path of deleted.filter(path => belongsToFolders(path, folders))) {
			for (const book of this.booksAtOrBelow(path)) {
				if (!inScope.has(book.path) && !book.missing) changed.set(book.id, { ...book, missing: true });
			}
		}
		if (changed.size) await this.commitBooks([...changed.values()]);
		return this.list();
	}

	private async extract(file: LibraryFile): Promise<ExtractedBookMetadata> {
		try { return await this.extractor.extract(file); }
		catch (error) {
			return { title: filenameTitle(file.path), author: '', metadataError: error instanceof Error ? error.message : '元数据提取失败' };
		}
	}

	private scannedBook(file: LibraryFile, extracted: ExtractedBookMetadata, previous?: LibraryBook): LibraryBook {
		const book: LibraryBook = {
			...previous,
			id: previous?.id ?? createId('book'), path: file.path,
			format: file.extension.toLowerCase() === 'epub' ? 'epub' : 'pdf',
			title: extracted.title || filenameTitle(file.path), author: extracted.author ?? '',
			pageCount: extracted.pageCount ?? (extracted.metadataError ? previous?.pageCount : undefined),
			coverPath: extracted.coverPath ?? (extracted.metadataError || extracted.coverRetryable ? previous?.coverPath : undefined),
			metadataError: extracted.metadataError, coverRetryable: extracted.coverRetryable, coverError: extracted.coverError,
			fileSize: file.stat.size, fingerprint: toFingerprint(file),
			tags: [...(previous?.tags ?? [])], progress: previous?.progress ?? 0, missing: false
		};
		return applyAutomaticMetadata(book, extractedAutomaticMetadata(previous, extracted, filenameTitle(file.path)));
	}

	private async commitBooks(books: LibraryBook[], removedIds: string[] = [], mutateRelated?: () => void): Promise<void> {
		const oldPaths = [...books.map(book => this.get(book.id)?.path), ...removedIds.map(id => this.get(id)?.path)];
		try {
			await this.persistence.commit(() => {
				mutateRelated?.();
				for (const id of removedIds) delete this.persistence.readBooks()[id];
				for (const book of books) this.persistence.readBooks()[book.id] = book;
			});
		} catch (error) {
			// Adapters may either roll back or retain pending in-memory writes.
			this.rebuildPathMap();
			throw error;
		}
		this.ensurePathIndex();
		for (const path of oldPaths) if (path) this.paths.delete(path);
		for (const book of books) if (book.path) this.paths.set(book.path, book.id);
	}

	private ensurePathIndex(): void {
		if (this.indexedBooks !== this.persistence.readBooks()) this.rebuildPathMap();
	}

	private booksAtOrBelow(path: string): LibraryBook[] {
		const exact = this.getByPath(path);
		return exact ? [exact] : Object.values(this.persistence.readBooks()).filter(book => book.path.startsWith(`${path.replace(/\/$/, '')}/`));
	}

	private require(id: string): LibraryBook {
		const book = this.get(id);
		if (!book) throw new Error(`未找到图书：${id}`);
		return book;
	}

	private requireLists(): LibraryList[] {
		if (!this.persistence.readLists) throw new Error('持久化适配器尚未支持阅读列表');
		return this.persistence.readLists();
	}

	private validateLists(ids: string[]): void {
		const lists = this.listLists();
		for (const id of uniqueValues(ids)) if (!lists.some(list => list.id === id)) throw new Error(`未找到列表：${id}`);
	}

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.writeQueue.then(operation);
		this.writeQueue = result.then(() => undefined, () => undefined);
		return result;
	}
}

function isSupported(file: LibraryFile): boolean {
	return !!file.path && ['pdf', 'epub'].includes(file.extension.toLowerCase());
}

function belongsToFolders(path: string, folders: string[]): boolean {
	return folders.length === 0 || folders.some(folder => path === folder.replace(/\/$/, '') || path.startsWith(`${folder.replace(/\/$/, '')}/`));
}

function basename(path: string): string { return path.split('/').pop() ?? path; }
function filenameTitle(path: string): string { return basename(path).replace(/\.[^.]+$/, '') || path; }
function toFingerprint(file: LibraryFile): SourceFingerprint { return { mtime: file.stat.mtime, size: file.stat.size }; }
function sameFingerprint(left: SourceFingerprint, right: SourceFingerprint): boolean { return left.mtime === right.mtime && left.size === right.size; }
function requireName(name: string): string {
	const normalized = name.trim();
	if (!normalized) throw new Error('名称不能为空');
	return normalized;
}
function needsRecoverableRetry(book: LibraryBook, retryRecoverable: boolean): boolean {
	return retryRecoverable && (!!book.metadataError || !!book.coverRetryable || (book.format === 'pdf' && !book.coverPath && book.coverRetryable === undefined));
}
