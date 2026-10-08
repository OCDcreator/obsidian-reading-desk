/**
 * Douban public book metadata client. Transport is injected so unit tests never
 * touch the network and the host can route through Obsidian requestUrl.
 * Endpoint knowledge only; no third-party code is copied (GPL boundary).
 */

export const DOUBAN_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface DoubanTransportResponse {
	status: number;
	text?: string;
	binary?: ArrayBuffer;
}

export interface DoubanTransport {
	get(url: string, headers: Record<string, string>, binary?: boolean): Promise<DoubanTransportResponse>;
}

export class DoubanBlockedError extends Error {
	readonly name = 'DoubanBlockedError';
	constructor(readonly status: number) { super(`豆瓣访问受限：HTTP ${status}`); }
}

export class DoubanRequestError extends Error {
	readonly name = 'DoubanRequestError';
	constructor(readonly status: number, url: string) { super(`豆瓣请求失败：HTTP ${status}（${url}）`); }
}

export interface DoubanSearchHit {
	id: string;
	title: string;
	author: string;
	year: string;
	coverUrl?: string;
	url?: string;
}

export interface DoubanBookDetail {
	id: string;
	title: string;
	authors: string[];
	translators: string[];
	publisher?: string;
	publishYear?: string;
	pageCount?: number;
	isbn?: string;
	series?: string;
	/** Douban community rating on the native 0-10 scale; undefined when unscored. */
	rating?: number;
	coverUrl?: string;
}

export class DoubanClient {
	constructor(private readonly transport: DoubanTransport) { }

	async searchBooks(query: string): Promise<DoubanSearchHit[]> {
		const url = `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`;
		const response = await this.get(url);
		let parsed: unknown;
		try { parsed = JSON.parse(response.text ?? '[]'); } catch { throw new Error('豆瓣搜索返回了无法解析的内容'); }
		if (!Array.isArray(parsed)) throw new Error('豆瓣搜索返回了无法解析的内容');
		return parsed.flatMap(item => {
			const hit = item as Record<string, unknown>;
			if (!hit || typeof hit.id !== 'string' || typeof hit.title !== 'string' || hit.type !== 'b') return [];
			return [{
				id: hit.id, title: hit.title,
				author: typeof hit.author_name === 'string' ? hit.author_name : '',
				year: typeof hit.year === 'string' ? hit.year : '',
				coverUrl: typeof hit.pic === 'string' ? hit.pic : undefined,
				url: typeof hit.url === 'string' ? hit.url : undefined
			}];
		});
	}

	async fetchBook(id: string): Promise<DoubanBookDetail> {
		if (!/^\d+$/.test(id)) throw new Error(`无效的豆瓣条目 ID：${id}`);
		const url = `https://book.douban.com/subject/${id}/`;
		const response = await this.get(url);
		return parseSubjectPage(response.text ?? '', id);
	}

	/** Douban image hosts reject cover downloads without the subject page Referer (HTTP 418). */
	async downloadCover(url: string, subjectId: string): Promise<ArrayBuffer> {
		const response = await this.transport.get(url, {
			'User-Agent': DOUBAN_USER_AGENT,
			'Referer': `https://book.douban.com/subject/${subjectId}/`
		}, true);
		if (response.status === 403) throw new DoubanBlockedError(response.status);
		if (response.status !== 200 || !response.binary || !response.binary.byteLength) throw new DoubanRequestError(response.status, url);
		return response.binary;
	}

	private async get(url: string): Promise<DoubanTransportResponse> {
		const response = await this.transport.get(url, { 'User-Agent': DOUBAN_USER_AGENT });
		if (response.status === 403) throw new DoubanBlockedError(response.status);
		if (response.status !== 200) throw new DoubanRequestError(response.status, url);
		return response;
	}
}

export function parseSubjectPage(html: string, id: string): DoubanBookDetail {
	const ld = parseJsonLd(html);
	const info = parseInfoBlock(html);
	const ratingMatch = html.match(/rating_num[^>]*>\s*([0-9.]*)\s*<\/strong>/);
	const rating = ratingMatch?.[1] ? Number.parseFloat(ratingMatch[1]) : undefined;
	const coverUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
	return {
		id,
		title: ld.title || info.values.get('书名')?.[0] || '',
		authors: ld.authors.length ? ld.authors : info.values.get('作者') ?? [],
		translators: info.values.get('译者') ?? [],
		publisher: info.values.get('出版社')?.[0],
		publishYear: info.values.get('出版年')?.[0],
		pageCount: positiveInt(info.values.get('页数')?.[0]),
		isbn: ld.isbn || info.values.get('ISBN')?.[0],
		series: info.values.get('丛书')?.[0],
		rating: rating !== undefined && Number.isFinite(rating) ? Math.max(0, Math.min(10, rating)) : undefined,
		coverUrl
	};
}

function parseJsonLd(html: string): { title: string; authors: string[]; isbn?: string } {
	const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
	if (!block) return { title: '', authors: [] };
	try {
		const data = JSON.parse(block.trim()) as Record<string, unknown>;
		const authors = Array.isArray(data.author) ? data.author : data.author ? [data.author] : [];
		return {
			title: typeof data.name === 'string' ? data.name.trim() : '',
			authors: authors.flatMap(author => {
				const name = (author as Record<string, unknown>)?.name;
				return typeof name === 'string' && name.trim() ? [name.trim()] : [];
			}),
			isbn: typeof data.isbn === 'string' ? data.isbn.trim() : undefined
		};
	} catch { return { title: '', authors: [] }; }
}

function parseInfoBlock(html: string): { values: Map<string, string[]> } {
	const values = new Map<string, string[]>();
	const block = html.match(/<div id="info"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
	for (const line of block.split(/<br\s*\/?>/i)) {
		const match = line.match(/<span class="pl"[^>]*>\s*([^<:：]+?)\s*[:：]\s*<\/span>([\s\S]*)$/);
		if (!match) continue;
		const label = match[1].trim();
		const links = [...match[2].matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map(item => cleanText(item[1])).filter(Boolean);
		const entries = links.length ? links : cleanText(match[2]).split(/\s*\/\s*/).filter(Boolean);
		if (entries.length) values.set(label, [...(values.get(label) ?? []), ...entries]);
	}
	return { values };
}

function cleanText(value: string): string {
	return decodeEntities(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
		const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
		const normalized = entity.toLowerCase();
		if (named[normalized] !== undefined) return named[normalized];
		const codePoint = normalized.startsWith('#x') ? Number.parseInt(normalized.slice(2), 16) : Number.parseInt(normalized.slice(1), 10);
		return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
	});
}

function positiveInt(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}
