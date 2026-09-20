export interface PageTextSource {
	pageText(page: number): Promise<string>;
}

export interface SearchHit {
	page: number;
	/** Surrounding text of one match with the query kept in place. */
	snippet: string;
}

const SNIPPET_RADIUS = 18;
const HITS_PER_PAGE_LIMIT = 3;
const SNIPPET_PER_PAGE_LIMIT = 40;

function normalizeForSearch(value: string): string {
	return value.replace(/\s+/g, ' ').toLowerCase();
}

/** Case-insensitive single-page hit extraction with compact snippets. */
export function findPageHits(page: number, text: string, query: string): SearchHit[] {
	if (!query.trim()) return [];
	const haystack = normalizeForSearch(text);
	const needle = normalizeForSearch(query.trim());
	const hits: SearchHit[] = [];
	let index = haystack.indexOf(needle);
	let guard = 0;
	while (index !== -1 && hits.length < HITS_PER_PAGE_LIMIT && guard < SNIPPET_PER_PAGE_LIMIT) {
		guard += 1;
		const start = Math.max(0, index - SNIPPET_RADIUS);
		const end = Math.min(haystack.length, index + needle.length + SNIPPET_RADIUS);
		const prefix = start > 0 ? '…' : '';
		const suffix = end < haystack.length ? '…' : '';
		hits.push({ page, snippet: `${prefix}${haystack.slice(start, end)}${suffix}` });
		index = haystack.indexOf(needle, index + Math.max(1, needle.length));
	}
	return hits;
}

/** Lazily extracts and caches per-page text so repeated searches skip re-parsing. */
export class ReaderSearchService {
	private readonly cache = new Map<number, string>();
	private token = 0;

	/** Invalidates the cache when the open document changes. */
	reset(): void {
		this.token += 1;
		this.cache.clear();
	}

	hasPage(page: number): boolean { return this.cache.has(page); }

	async loadPage(pdf: PageTextSource, page: number): Promise<string> {
		const cached = this.cache.get(page);
		if (cached !== undefined) return cached;
		const token = this.token;
		const text = await pdf.pageText(page);
		if (token !== this.token) return '';
		this.cache.set(page, text);
		return text;
	}

	async search(pdf: PageTextSource, pageCount: number, query: string, onPageLoaded?: (done: number, total: number) => void): Promise<SearchHit[]> {
		if (!query.trim()) return [];
		const hits: SearchHit[] = [];
		for (let page = 1; page <= pageCount; page += 1) {
			const text = await this.loadPage(pdf, page);
			hits.push(...findPageHits(page, text, query));
			onPageLoaded?.(page, pageCount);
		}
		return hits;
	}
}

/** Outlines text-layer spans that contain the query on a rendered page host. */
export function markSearchHits(host: HTMLElement, query: string): void {
	for (const span of Array.from(host.querySelectorAll<HTMLElement>('.rd-pdf-text-layer span'))) {
		const contains = !!query.trim() && normalizeForSearch(span.textContent ?? '').includes(normalizeForSearch(query.trim()));
		span.classList.toggle('rd-search-hit', contains);
	}
}

export function clearSearchMarks(host: HTMLElement): void {
	for (const span of Array.from(host.querySelectorAll<HTMLElement>('.rd-search-hit'))) span.classList.remove('rd-search-hit');
}
