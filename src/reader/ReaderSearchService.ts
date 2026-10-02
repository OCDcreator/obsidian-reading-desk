import { abortableReaderTask, readerAbortError, throwIfReaderAborted } from './ReaderCancellation';
import type { PdfPageTextIndex, PdfTextSpan } from './PdfTextIndex';
export { clearSearchMarks, markSearchHits, scrollToSearchHit } from './ReaderSearchMarks';

export interface PageTextSource {
	pageText(page: number): Promise<string>;
	pageTextIndex?(page: number): Promise<PdfPageTextIndex>;
}
export interface SearchHit {
	page: number;
	snippet: string;
	/** Half-open UTF-16 offsets in the original page text. */
	start: number;
	end: number;
	/** Local offsets in every text span touched by the match. */
	spans: PdfTextSpan[];
}
/** Collapse whitespace and map case-folded characters back to original offsets. */
export function normalizeSearchText(value: string): { text: string; starts: number[]; ends: number[] } {
	let text = '';
	const starts: number[] = [];
	const ends: number[] = [];
	let offset = 0;
	for (const character of value) {
		const end = offset + character.length;
		if (/\s/.test(character)) {
			if (text.endsWith(' ')) ends[ends.length - 1] = end;
			else { text += ' '; starts.push(offset); ends.push(end); }
		} else {
			const folded = character.toLowerCase();
			text += folded;
			for (let index = 0; index < folded.length; index += 1) { starts.push(offset); ends.push(end); }
		}
		offset = end;
	}
	return { text, starts, ends };
}
/** Complete index; only the displayed rows may be limited. */
export function findPageHits(page: number, text: string, query: string, spans: PdfTextSpan[] = []): SearchHit[] {
	const needle = normalizeSearchText(query.trim()).text;
	if (!needle) return [];
	const normalized = normalizeSearchText(text);
	const hits: SearchHit[] = [];
	let index = normalized.text.indexOf(needle);
	while (index !== -1) {
		const start = normalized.starts[index];
		const end = normalized.ends[index + needle.length - 1];
		const left = Math.max(0, index - 18);
		const right = Math.min(normalized.text.length, index + needle.length + 18);
		hits.push({ page, start, end,
			snippet: `${left ? '…' : ''}${normalized.text.slice(left, right)}${right < normalized.text.length ? '…' : ''}`,
			spans: spans.filter(span => span.start < end && span.end > start).map(span => ({
				index: span.index, start: Math.max(start, span.start) - span.start, end: Math.min(end, span.end) - span.start
			}))
		});
		index = normalized.text.indexOf(needle, index + needle.length);
	}
	return hits;
}

export class ReaderSearchService {
	private readonly cache = new Map<number, PdfPageTextIndex>();
	private readonly loading = new Map<number, Promise<PdfPageTextIndex>>();
	private documentEpoch = 0;
	private requestEpoch = 0;
	private source: PageTextSource | null = null;
	cancel(): void { this.requestEpoch += 1; }
	reset(): void {
		this.documentEpoch += 1;
		this.cancel();
		this.source = null;
		this.cache.clear();
		this.loading.clear();
	}
	hasPage(page: number): boolean { return this.cache.has(page); }
	async loadPage(pdf: PageTextSource, page: number): Promise<string> { return (await this.loadIndex(pdf, page)).text; }
	private loadIndex(pdf: PageTextSource, page: number): Promise<PdfPageTextIndex> {
		if (this.source && this.source !== pdf) this.reset();
		this.source = pdf;
		const cached = this.cache.get(page);
		if (cached) return Promise.resolve(cached);
		const pending = this.loading.get(page);
		if (pending) return pending;
		const epoch = this.documentEpoch;
		const task = Promise.resolve().then(() => pdf.pageTextIndex ? pdf.pageTextIndex(page) : pdf.pageText(page).then(text => ({ text, spans: [] })))
			.then(index => {
				if (epoch !== this.documentEpoch) throw readerAbortError();
				this.cache.set(page, index);
				return index;
			}).finally(() => { if (this.loading.get(page) === task) this.loading.delete(page); });
		this.loading.set(page, task);
		return task;
	}
	async search(pdf: PageTextSource, pageCount: number, query: string, onPageLoaded?: (done: number, total: number) => void, signal?: AbortSignal): Promise<SearchHit[]> {
		if (this.source && this.source !== pdf) this.reset();
		const documentEpoch = this.documentEpoch;
		const request = ++this.requestEpoch;
		const check = (): void => {
			throwIfReaderAborted(signal);
			if (request !== this.requestEpoch || documentEpoch !== this.documentEpoch) throw readerAbortError();
		};
		check();
		if (!query.trim()) return [];
		const hits: SearchHit[] = [];
		for (let page = 1; page <= pageCount; page += 1) {
			check();
			const index = await abortableReaderTask(this.loadIndex(pdf, page), signal);
			check();
			hits.push(...findPageHits(page, index.text, query, index.spans));
			onPageLoaded?.(page, pageCount);
		}
		return hits;
	}
}
