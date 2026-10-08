import type { LibraryBook, MetadataEnrichmentSettings } from '../../types/contracts';
import type { BookEnrichment } from '../LibraryTypes';
import { DoubanBlockedError, DoubanClient, type DoubanBookDetail, type DoubanSearchHit } from './DoubanClient';

export interface EnrichmentLibrary {
	get(id: string): LibraryBook | undefined;
	enrichBooks(entries: Array<{ id: string; enrichment: BookEnrichment }>): Promise<LibraryBook[]>;
}

export interface MetadataEnricherOptions {
	library: EnrichmentLibrary;
	client: DoubanClient;
	settings: () => MetadataEnrichmentSettings;
	/** Persists the daily circuit breaker so a restart does not hammer a throttled endpoint. */
	saveBlockedUntil: (blockedUntil: number) => Promise<void> | void;
	/** Writes a downloaded cover and returns the vault path stored on the book. */
	writeCover: (subjectId: string, data: ArrayBuffer) => Promise<string>;
	notice: (message: string) => void;
	onChanged: () => void;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	jitter?: () => number;
	/** Auto scrape skips books attempted within this window; manual enrich ignores it. */
	autoCooldownMs?: number;
}

export interface EnrichmentSummary {
	matched: number;
	missed: number;
	failed: number;
	skipped: number;
	blocked: boolean;
}

const DEFAULT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 8000;

/**
 * Serial, paced Douban enrichment. Fill-blank rules are applied inside
 * LibraryIndex.enrichBooks; this service owns matching confidence, pacing and
 * the daily 403 circuit breaker. It never merges book records (ADR 0017).
 */
export class MetadataEnricher {
	private queue: Promise<void> = Promise.resolve();
	private requested = false;
	private readonly now: () => number;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly jitter: () => number;
	private readonly autoCooldownMs: number;

	constructor(private readonly options: MetadataEnricherOptions) {
		this.now = options.now ?? (() => Date.now());
		this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
		this.jitter = options.jitter ?? (() => Math.random());
		this.autoCooldownMs = options.autoCooldownMs ?? DEFAULT_COOLDOWN_MS;
	}

	isBlocked(): boolean {
		const blockedUntil = this.options.settings().blockedUntil;
		return blockedUntil !== undefined && this.now() < blockedUntil;
	}

	/** Automatic path for newly scanned source-less books; quiet unless blocked. Callers may fire-and-forget. */
	autoEnrichNewBooks(ids: string[]): Promise<EnrichmentSummary> {
		const settings = this.options.settings();
		const summary: EnrichmentSummary = { matched: 0, missed: 0, failed: 0, skipped: 0, blocked: false };
		if (!settings.enabled || !settings.autoNewBooks) return Promise.resolve(summary);
		const candidates = ids.filter(id => {
			const book = this.options.library.get(id);
			return book && this.needsMetadata(book) && !this.inCooldown(book);
		});
		return candidates.length ? this.run(candidates) : Promise.resolve(summary);
	}

	/** Manual single-book rescrape from shelf UI; bypasses the auto cooldown. */
	enrichBook(id: string): Promise<EnrichmentSummary> {
		return this.run([id]);
	}

	/** Manual batch for existing books still missing author/cover or stuck with a filename title. */
	enrichMissing(ids: string[]): Promise<EnrichmentSummary> {
		const candidates = ids.filter(id => {
			const book = this.options.library.get(id);
			return !!book && !book.missing && (this.needsMetadata(book) || !book.coverPath);
		});
		return this.run(candidates);
	}

	private run(ids: string[]): Promise<EnrichmentSummary> {
		const summary: EnrichmentSummary = { matched: 0, missed: 0, failed: 0, skipped: 0, blocked: false };
		const job = this.queue.then(() => this.process(ids, summary));
		this.queue = job.then(() => undefined, () => undefined);
		return job;
	}

	private async process(ids: string[], summary: EnrichmentSummary): Promise<EnrichmentSummary> {
		if (!this.options.settings().enabled) { summary.skipped = ids.length; return summary; }
		if (this.isBlocked()) {
			summary.blocked = true;
			summary.skipped = ids.length;
			this.options.notice('豆瓣访问仍处在当日限流中，刮削已暂停；明天自动恢复。');
			return summary;
		}
		for (const id of [...new Set(ids)]) {
			if (this.isBlocked()) { summary.blocked = true; summary.skipped += 1; continue; }
			try {
				summary[await this.enrichOne(id)] += 1;
			} catch (error) {
				if (error instanceof DoubanBlockedError) {
					await this.tripBreaker();
					summary.blocked = true;
					summary.skipped += 1;
				} else {
					summary.failed += 1;
					await this.recordOnly(id, 'failed');
				}
			}
		}
		if (summary.matched) this.options.onChanged();
		if (summary.matched || summary.missed || summary.failed) {
			this.options.notice(`豆瓣刮削完成：命中 ${summary.matched}，未找到 ${summary.missed}，失败 ${summary.failed}${summary.skipped ? `，跳过 ${summary.skipped}` : ''}。`);
		}
		return summary;
	}

	private async enrichOne(id: string): Promise<'matched' | 'missed' | 'skipped'> {
		const book = this.options.library.get(id);
		if (!book || book.missing) return 'skipped';
		const isbn = book.source?.isbn?.trim();
		let confidence: 'high' | 'low' = 'low';
		let detail: DoubanBookDetail | undefined;
		if (isbn) {
			const hit = await this.paced(() => this.options.client.searchBooks(isbn)).then(hits => hits[0]);
			if (hit) {
				const candidate = await this.paced(() => this.options.client.fetchBook(hit.id));
				if (sameIsbn(candidate.isbn, isbn)) { detail = candidate; confidence = 'high'; }
			}
		}
		if (!detail) {
			const query = (book.autoMetadata?.title ?? book.title).trim();
			if (!query) return 'skipped';
			const hits = await this.paced(() => this.options.client.searchBooks(query));
			const hit = pickTitleHit(hits, query);
			if (!hit) {
				await this.recordOnly(id, 'missed');
				return 'missed';
			}
			detail = await this.paced(() => this.options.client.fetchBook(hit.id));
			confidence = authorConfirms(book, detail) ? 'high' : 'low';
		}
		const coverPath = await this.downloadCover(book, detail);
		const settings = this.options.settings();
		const author = [...detail.authors, ...detail.translators.map(name => `${name}（译）`)].join(', ');
		await this.options.library.enrichBooks([{
			id,
			enrichment: {
				title: detail.title || undefined,
				author: author || undefined,
				pageCount: detail.pageCount,
				rating: detail.rating,
				coverPath,
				source: book.source ? undefined : { provider: 'douban', id: detail.id, isbn: detail.isbn },
				needsReview: settings.reviewAll || confidence === 'low',
				record: { at: this.now(), status: 'matched', confidence }
			}
		}]);
		return 'matched';
	}

	private async downloadCover(book: LibraryBook, detail: DoubanBookDetail): Promise<string | undefined> {
		if (book.coverPath || !detail.coverUrl) return undefined;
		try {
			const data = await this.paced(() => this.options.client.downloadCover(detail.coverUrl as string, detail.id));
			return await this.options.writeCover(detail.id, data);
		} catch (error) {
			if (error instanceof DoubanBlockedError) throw error;
			return undefined; // A cover failure never forfeits the metadata match.
		}
	}

	private async recordOnly(id: string, status: 'missed' | 'failed'): Promise<void> {
		const book = this.options.library.get(id);
		if (!book) return;
		try {
			await this.options.library.enrichBooks([{
				id,
				enrichment: { needsReview: book.needsReview === true, record: { at: this.now(), status } }
			}]);
		} catch { /* A missing record must not break the queue. */ }
	}

	private async tripBreaker(): Promise<void> {
		const until = nextLocalMidnight(this.now());
		await this.options.saveBlockedUntil(until);
		this.options.notice('豆瓣返回 403 限流，今日刮削已暂停；已补的字段保留，明天自动恢复。');
	}

	private async paced<T>(request: () => Promise<T>): Promise<T> {
		if (this.requested) await this.sleep(MIN_DELAY_MS + this.jitter() * (MAX_DELAY_MS - MIN_DELAY_MS));
		this.requested = true;
		return request();
	}

	private needsMetadata(book: LibraryBook): boolean {
		if (book.missing || book.source) return false;
		const auto = book.autoMetadata ?? { title: book.title, author: book.author };
		const filename = (book.path.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
		return !auto.title.trim() || auto.title === filename || !auto.author.trim();
	}

	private inCooldown(book: LibraryBook): boolean {
		const attempted = book.enrichment?.at;
		return attempted !== undefined && this.now() - attempted < this.autoCooldownMs;
	}
}

export function pickTitleHit(hits: DoubanSearchHit[], query: string): DoubanSearchHit | undefined {
	const wanted = normalizeTitle(query);
	return hits.find(hit => normalizeTitle(hit.title) === wanted)
		?? hits.find(hit => normalizeTitle(hit.title).startsWith(wanted) || wanted.startsWith(normalizeTitle(hit.title)));
}

function authorConfirms(book: LibraryBook, detail: DoubanBookDetail): boolean {
	const known = (book.autoMetadata?.author ?? book.author).trim();
	if (!known) return true; // Nothing to contradict; exact title hit is enough.
	const expected = normalize(known);
	return detail.authors.some(author => expected.includes(normalize(author)) || normalize(author).includes(expected));
}

function sameIsbn(left: string | undefined, right: string): boolean {
	return !!left && left.replace(/[^0-9Xx]/g, '').toLowerCase() === right.replace(/[^0-9Xx]/g, '').toLowerCase();
}

function normalizeTitle(value: string): string {
	return normalize(value.replace(/[（(][^）)]*[)）]/g, ''));
}

function normalize(value: string): string {
	return value.toLowerCase().replace(/\s+/g, '');
}

function nextLocalMidnight(now: number): number {
	const date = new Date(now);
	date.setHours(24, 0, 0, 0);
	return date.getTime();
}
