import type { LibraryBook, LibraryCategory, SourceFingerprint } from '../types/contracts';
import { createId } from '../utils/ids';

export interface LibraryFile {
	path: string;
	extension: string;
	stat: { mtime: number; size: number };
}

export interface LibraryPersistence {
	readBooks(): Record<string, LibraryBook>;
	readCategories(): LibraryCategory[];
	commit(mutator: () => void): Promise<void>;
}

export interface BookMetadataExtractor {
	extract(file: LibraryFile): Promise<Omit<LibraryBook, 'id' | 'path' | 'format' | 'fileSize' | 'fingerprint' | 'tags' | 'progress'>>;
}

export class LibraryIndex {
	private scanQueue: Promise<LibraryBook[]> = Promise.resolve([]);

	constructor(private readonly persistence: LibraryPersistence, private readonly extractor: BookMetadataExtractor) { }

	list(): LibraryBook[] {
		return Object.values(this.persistence.readBooks()).sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
	}

	listCategories(): LibraryCategory[] {
		return [...this.persistence.readCategories()].sort((left, right) => left.order - right.order);
	}

	getByPath(path: string): LibraryBook | undefined {
		return Object.values(this.persistence.readBooks()).find(book => book.path === path);
	}

	async scan(files: LibraryFile[], folders: string[], retryRecoverable = false): Promise<LibraryBook[]> {
		this.scanQueue = this.scanQueue.catch(() => []).then(() => this.scanSerial(files, folders, retryRecoverable));
		return this.scanQueue;
	}

	private async scanSerial(files: LibraryFile[], folders: string[], retryRecoverable: boolean): Promise<LibraryBook[]> {
		const inScope = files.filter(file => this.isSupported(file) && this.belongsToFolders(file.path, folders));
		const found = new Set(inScope.map(file => file.path));
		for (const file of inScope) await this.upsertScanned(file, retryRecoverable);
		await this.persistence.commit(() => {
			for (const [id, book] of Object.entries(this.persistence.readBooks())) {
				if (this.belongsToFolders(book.path, folders) && !found.has(book.path)) delete this.persistence.readBooks()[id];
			}
		});
		return this.list();
	}

	async updateBook(id: string, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'tags' | 'rating' | 'categoryId'>>): Promise<void> {
		await this.persistence.commit(() => {
			const book = this.persistence.readBooks()[id];
			if (!book) throw new Error(`未找到图书：${id}`);
			Object.assign(book, patch);
			if (patch.tags) book.tags = [...new Set(patch.tags.map(tag => tag.trim()).filter(Boolean))];
		});
	}

	async updateProgress(id: string, progress: number): Promise<void> {
		await this.persistence.commit(() => {
			const book = this.persistence.readBooks()[id];
			if (!book) return;
			book.progress = Math.max(0, Math.min(1, progress));
			book.lastReadAt = Date.now();
		});
	}

	async addCategory(name: string): Promise<LibraryCategory> {
		const category: LibraryCategory = { id: createId('category'), name: name.trim(), order: this.persistence.readCategories().length };
		await this.persistence.commit(() => this.persistence.readCategories().push(category));
		return category;
	}

	async reorderCategories(ids: string[]): Promise<void> {
		await this.persistence.commit(() => {
			const categories = this.persistence.readCategories();
			const ordered = ids.map(id => categories.find(category => category.id === id)).filter((category): category is LibraryCategory => !!category);
			const remaining = categories.filter(category => !ids.includes(category.id));
			categories.splice(0, categories.length, ...[...ordered, ...remaining].map((category, order) => ({ ...category, order })));
		});
	}

	private async upsertScanned(file: LibraryFile, retryRecoverable: boolean): Promise<void> {
		const current = this.getByPath(file.path);
		const fingerprint = toFingerprint(file);
		if (current && sameFingerprint(current.fingerprint, fingerprint) && !needsRecoverableRetry(current, retryRecoverable)) return;
		let extracted: Awaited<ReturnType<BookMetadataExtractor['extract']>>;
		try {
			extracted = await this.extractor.extract(file);
		} catch (error) {
			extracted = {
				title: file.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? file.path,
				author: '',
				metadataError: error instanceof Error ? error.message : '元数据提取失败'
			};
		}
		await this.persistence.commit(() => {
			const previous = this.getByPath(file.path);
			const book: LibraryBook = {
				id: previous?.id ?? createId('book'),
				path: file.path,
				format: file.extension.toLowerCase() === 'epub' ? 'epub' : 'pdf',
				title: extracted.title || file.path.split('/').pop() || file.path,
				author: extracted.author ?? '',
				pageCount: extracted.pageCount,
				coverPath: extracted.coverPath,
				metadataError: extracted.metadataError,
				coverRetryable: extracted.coverRetryable,
				coverError: extracted.coverError,
				fileSize: file.stat.size,
				fingerprint,
				tags: previous?.tags ?? [],
				progress: previous?.progress ?? 0,
				categoryId: previous?.categoryId,
				rating: previous?.rating,
				lastReadAt: previous?.lastReadAt
			};
			this.persistence.readBooks()[book.id] = book;
		});
	}

	private isSupported(file: LibraryFile): boolean {
		return file.extension.toLowerCase() === 'pdf' || file.extension.toLowerCase() === 'epub';
	}

	private belongsToFolders(path: string, folders: string[]): boolean {
		return folders.length === 0 || folders.some(folder => path === folder || path.startsWith(`${folder.replace(/\/$/, '')}/`));
	}
}

function needsRecoverableRetry(book: LibraryBook, retryRecoverable: boolean): boolean {
	if (!retryRecoverable) return false;
	return !!book.metadataError || !!book.coverRetryable || (book.format === 'pdf' && !book.coverPath && book.coverRetryable === undefined);
}

function toFingerprint(file: LibraryFile): SourceFingerprint {
	return { mtime: file.stat.mtime, size: file.stat.size };
}

function sameFingerprint(left: SourceFingerprint, right: SourceFingerprint): boolean {
	return left.mtime === right.mtime && left.size === right.size;
}
