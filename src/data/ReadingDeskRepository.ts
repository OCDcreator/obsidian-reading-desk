import type { AnnotationPersistence } from '../annotations/AnnotationStore';
import type { LibraryPersistence } from '../library/LibraryIndex';
import type { ExcerptCardState, LibraryBook, LibraryCategory, PdfComment, PdfHighlight, ReadingDeskData, ReadingDeskSettings } from '../types/contracts';
import { createEmptyData } from './defaults';

export interface DataSink {
	load(): Promise<unknown>;
	save(value: ReadingDeskData): Promise<void>;
}

export class ReadingDeskRepository implements AnnotationPersistence, LibraryPersistence {
	private data: ReadingDeskData = createEmptyData();
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly sink: DataSink) { }

	async initialize(): Promise<void> {
		const loaded = await this.sink.load();
		if (isData(loaded)) this.data = mergeData(loaded);
	}

	readBooks(): Record<string, LibraryBook> { return this.data.books; }
	readCategories(): LibraryCategory[] { return this.data.categories; }
	readHighlights(): Record<string, PdfHighlight> { return this.data.highlights; }
	readComments(): Record<string, PdfComment[]> { return this.data.comments; }
	readExcerptCards(): Record<string, ExcerptCardState> { return this.data.excerptCards; }
	readSettings(): ReadingDeskSettings { return this.data.settings; }

	async commit(mutator: () => void): Promise<void> {
		// A failed persistence attempt must be reported to its caller, but it
		// cannot leave the serial queue permanently rejected.
		const pending = this.writeQueue.catch(() => undefined).then(async () => {
			mutator();
			await this.sink.save(this.snapshot());
		});
		this.writeQueue = pending;
		return pending;
	}

	async updateSettings(patch: Partial<ReadingDeskSettings>): Promise<void> {
		await this.commit(() => {
			this.data.settings = { ...this.data.settings, ...patch };
		});
	}

	snapshot(): ReadingDeskData {
		return structuredClone(this.data);
	}
}

function isData(value: unknown): value is Partial<ReadingDeskData> {
	return typeof value === 'object' && value !== null;
}

function mergeData(loaded: Partial<ReadingDeskData>): ReadingDeskData {
	const defaults = createEmptyData();
	return {
		...defaults,
		...loaded,
		books: loaded.books ?? defaults.books,
		categories: loaded.categories ?? defaults.categories,
		highlights: loaded.highlights ?? defaults.highlights,
		comments: loaded.comments ?? defaults.comments,
		excerptCards: loaded.excerptCards ?? defaults.excerptCards,
		settings: {
			...defaults.settings,
			...loaded.settings,
			storage: { ...defaults.settings.storage, ...loaded.settings?.storage },
			viewer: { ...defaults.settings.viewer, ...loaded.settings?.viewer }
		}
	};
}
