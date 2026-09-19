export type BookFormat = 'pdf' | 'epub';
export type ReaderLayout = 'focus' | 'split' | 'shelf';
export type TargetType = 'canvas' | 'excalidraw' | 'markdown';
export type HighlightColor = 'moss' | 'amber' | 'brick' | 'indigo' | 'plum';

export interface SourceFingerprint {
	mtime: number;
	size: number;
}

export interface LibraryBook {
	id: string;
	path: string;
	format: BookFormat;
	title: string;
	author: string;
	pageCount?: number;
	fileSize: number;
	coverPath?: string;
	categoryId?: string;
	tags: string[];
	rating?: number;
	progress: number;
	lastReadAt?: number;
	fingerprint: SourceFingerprint;
	metadataError?: string;
	/** True only when a PDF cover render failed and an unchanged manual rescan may recover it. */
	coverRetryable?: boolean;
	/** Recoverable PDF cover-render failure retained for diagnostics without rejecting metadata. */
	coverError?: string;
}

export interface LibraryCategory {
	id: string;
	name: string;
	order: number;
}

export interface NormalizedPdfRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface AnnotationTarget {
	type: TargetType;
	path: string;
	objectId?: string;
}

export interface PdfHighlight {
	id: string;
	pdfPath: string;
	page: number;
	rotation: number;
	rects: NormalizedPdfRect[];
	text: string;
	color: HighlightColor;
	chapterPath: string[];
	tags: string[];
	target?: AnnotationTarget;
	createdAt: number;
	updatedAt: number;
}

export interface PdfComment {
	id: string;
	highlightId: string;
	content: string;
	createdAt: number;
	showTimestamp: boolean;
	source: 'pdf' | TargetType;
}

export interface CanvasNodeReference {
	highlightId: string;
	pdfPath: string;
	page: number;
	title?: string;
	kind: 'excerpt' | 'chapter' | 'crop';
}

export interface ObjectStorageSettings {
	enabled: boolean;
	imageHostEnabled: boolean;
	provider: 'oss' | 'cos';
	endpoint: string;
	region: string;
	bucket: string;
	prefix: string;
	accessKeyId: string;
	secretAccessKey: string;
}

export interface ReadingDeskSettings {
	libraryFolders: string[];
	readerLayout: ReaderLayout;
	storage: ObjectStorageSettings;
	importedBookshelf: boolean;
}

export interface ExcerptCardState {
	title?: string;
	folded?: boolean;
}

export interface ReadingDeskData {
	books: Record<string, LibraryBook>;
	categories: LibraryCategory[];
	highlights: Record<string, PdfHighlight>;
	comments: Record<string, PdfComment[]>;
	excerptCards: Record<string, ExcerptCardState>;
	settings: ReadingDeskSettings;
}
