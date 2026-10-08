import { describe, expect, it } from 'vitest';
import { DoubanClient, type DoubanTransport } from '../../../src/library/metadata/DoubanClient';
import { MetadataEnricher, type MetadataEnricherOptions } from '../../../src/library/metadata/MetadataEnricher';
import type { MetadataEnrichmentSettings } from '../../../src/types/contracts';
import { libraryBook, libraryHarness } from '../LibraryTestHelpers';

const PAGE_1203426 = `<html><head>
<meta property="og:image" content="https://img2.doubanio.com/view/subject/l/public/s1146614.jpg" />
<script type="application/ld+json">{ "@type":"Book", "name" : "平凡的世界（全三部）", "author": [ { "@type": "Person", "name": "路遥" } ], "isbn" : "9787020123456" }</script>
</head><body>
<div id="info">
 <span> <span class="pl"> 作者</span>: <a href="/search/a">路遥</a> </span><br/>
 <span class="pl">出版社:</span> 人民文学出版社<br/>
 <span class="pl">页数:</span> 1256<br/>
 <span class="pl">ISBN:</span> 9787020123456<br/>
</div>
<strong class="ll rating_num " > 9.2 </strong>
</body></html>`;

interface Script {
	suggest?: object[];
	page?: string;
	status?: number;
	coverBytes?: number;
}

function scriptedDouban(script: Script) {
	const calls: string[] = [];
	const transport: DoubanTransport = {
		get: async (url, _headers, binary) => {
			calls.push(url);
			if (script.status && script.status !== 200) return { status: script.status };
			if (/subject_suggest/.test(url)) return { status: 200, text: JSON.stringify(script.suggest ?? []) };
			if (/doubanio/.test(url)) return { status: 200, binary: binary ? new Uint8Array(script.coverBytes ?? 4).buffer : undefined };
			if (/subject\//.test(url)) return { status: 200, text: script.page ?? PAGE_1203426 };
			return { status: 404 };
		}
	};
	return { client: new DoubanClient(transport), calls };
}

function enricherHarness(
	books: Parameters<typeof libraryHarness>[0],
	script: Script,
	options: Partial<MetadataEnricherOptions> & { settings?: Partial<MetadataEnrichmentSettings> } = {}
) {
	const { settings: settingsPatch, ...rest } = options;
	const harness = libraryHarness(books);
	const douban = scriptedDouban(script);
	const settings: MetadataEnrichmentSettings = { enabled: true, autoNewBooks: true, reviewAll: false, ...settingsPatch };
	const notices: string[] = [];
	const covers: string[] = [];
	const sleeps: number[] = [];
	const saved: number[] = [];
	let now = rest.now?.() ?? 1_000_000;
	const enricher = new MetadataEnricher({
		library: harness.index,
		client: douban.client,
		settings: () => settings,
		saveBlockedUntil: until => { settings.blockedUntil = until; saved.push(until); },
		writeCover: async (id, data) => { covers.push(id); return `covers/douban-${id}.jpg (${data.byteLength}b)`; },
		notice: message => notices.push(message),
		onChanged: () => undefined,
		sleep: async ms => { sleeps.push(ms); },
		jitter: () => 0,
		now: () => now,
		...rest
	});
	return { ...harness, enricher, douban, settings, notices, covers, sleeps, saved, setNow: (value: number) => { now = value; } };
}

describe('MetadataEnricher', () => {
	it('enriches by ISBN with high confidence and keeps an existing bibliographic source untouched', async () => {
		const book = libraryBook('one', '书/one.pdf', {
			source: { provider: 'csl', id: 'csl-1', isbn: '9787020123456' },
			autoMetadata: { title: '平凡的世界', author: '' },
			title: '平凡的世界', author: ''
		});
		const { enricher, index, douban } = enricherHarness([book], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界（全三部）' }] });
		const summary = await enricher.enrichBook('one');
		expect(summary.matched).toBe(1);
		expect(douban.calls[0]).toContain('q=9787020123456');
		const enriched = index.get('one');
		expect(enriched).toMatchObject({ author: '路遥', pageCount: 1256, rating: 9.2 });
		expect(enriched?.source).toEqual({ provider: 'csl', id: 'csl-1', isbn: '9787020123456' });
		expect(enriched?.needsReview).toBeUndefined();
		expect(enriched?.enrichment).toMatchObject({ status: 'matched', confidence: 'high' });
	});

	it('matches by title, fills only blanks, sets the douban source and downloads a cover', async () => {
		const book = libraryBook('one', '书/平凡的世界.pdf', { title: '平凡的世界', author: '', autoMetadata: { title: '平凡的世界', author: '' } });
		const { enricher, index, covers, douban } = enricherHarness([book], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界（全三部）' }] });
		const summary = await enricher.enrichBook('one');
		expect(summary.matched).toBe(1);
		expect(decodeURIComponent(douban.calls[0])).toContain('q=平凡的世界');
		const enriched = index.get('one');
		expect(enriched).toMatchObject({ title: '平凡的世界（全三部）', author: '路遥', rating: 9.2, pageCount: 1256 });
		expect(enriched?.source).toEqual({ provider: 'douban', id: '1203426', isbn: '9787020123456' });
		expect(enriched?.coverPath).toBe('covers/douban-1203426.jpg (4b)');
		expect(covers).toEqual(['1203426']);
		expect(enriched?.needsReview).toBeUndefined();
	});

	it('never overwrites manual overrides, known author, rating or cover', async () => {
		const book = libraryBook('one', '书/平凡的世界.pdf', {
			title: '人工标题', author: '已有作者', rating: 5, coverPath: 'covers/manual.png',
			metadataOverrides: { title: '人工标题' }, autoMetadata: { title: '平凡的世界', author: '已有作者' }
		});
		const { enricher, index } = enricherHarness([book], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界' }] });
		await enricher.enrichBook('one');
		const enriched = index.get('one');
		expect(enriched).toMatchObject({ title: '人工标题', author: '已有作者', rating: 5, coverPath: 'covers/manual.png' });
		expect(enriched?.enrichment?.status).toBe('matched');
	});

	it('marks low-confidence matches as needsReview and review-all marks every match', async () => {
		const mismatch = libraryBook('one', '书/平凡的世界.pdf', {
			title: '平凡的世界', author: '张三', autoMetadata: { title: '平凡的世界', author: '张三' }
		});
		const { enricher, index } = enricherHarness([mismatch], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界' }] });
		await enricher.enrichBook('one');
		expect(index.get('one')).toMatchObject({ needsReview: true, author: '张三', enrichment: { status: 'matched', confidence: 'low' } });

		const clean = libraryBook('two', '书/平凡的世界.pdf', { title: '平凡的世界', author: '', autoMetadata: { title: '平凡的世界', author: '' } });
		const reviewAll = enricherHarness([clean], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界' }] }, { settings: { reviewAll: true } });
		await reviewAll.enricher.enrichBook('two');
		expect(reviewAll.index.get('two')?.needsReview).toBe(true);
	});

	it('clears needsReview on the next manual edit', async () => {
		const book = libraryBook('one', '书/平凡的世界.pdf', { title: '平凡的世界', author: '', autoMetadata: { title: '平凡的世界', author: '' } });
		const { enricher, index } = enricherHarness([book], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界' }] }, { settings: { reviewAll: true } });
		await enricher.enrichBook('one');
		expect(index.get('one')?.needsReview).toBe(true);
		await index.updateBook('one', { tags: ['读过'] });
		expect(index.get('one')?.needsReview).toBeUndefined();
	});

	it('records a miss without touching fields when no title hit exists', async () => {
		const book = libraryBook('one', '书/冷门.pdf', { title: '冷门', author: '', autoMetadata: { title: '冷门', author: '' } });
		const { enricher, index } = enricherHarness([book], { suggest: [] });
		const summary = await enricher.enrichBook('one');
		expect(summary.missed).toBe(1);
		const enriched = index.get('one');
		expect(enriched?.enrichment?.status).toBe('missed');
		expect(enriched?.author).toBe('');
		expect(enriched?.source).toBeUndefined();
	});

	it('trips the daily circuit breaker on HTTP 403 and short-circuits later runs', async () => {
		const book = libraryBook('one', '书/平凡的世界.pdf', { title: '平凡的世界', author: '', autoMetadata: { title: '平凡的世界', author: '' } });
		const { enricher, index, settings, saved, douban } = enricherHarness([book], { status: 403 });
		const summary = await enricher.enrichBook('one');
		expect(summary.blocked).toBe(true);
		expect(saved).toHaveLength(1);
		expect(saved[0]).toBeGreaterThan(1_000_000);
		expect(settings.blockedUntil).toBe(saved[0]);
		const callsBefore = douban.calls.length;
		const again = await enricher.enrichBook('one');
		expect(again.blocked).toBe(true);
		expect(again.skipped).toBe(1);
		expect(douban.calls.length).toBe(callsBefore);
		expect(index.get('one')?.enrichment).toBeUndefined();
	});

	it('paces requests serially with a 4-8s randomized interval', async () => {
		const book = libraryBook('one', '书/平凡的世界.pdf', { title: '平凡的世界', author: '', autoMetadata: { title: '平凡的世界', author: '' } });
		const { enricher, douban, sleeps } = enricherHarness([book], { suggest: [{ type: 'b', id: '1203426', title: '平凡的世界' }] });
		await enricher.enrichBook('one');
		expect(douban.calls.length).toBe(3); // suggest + subject page + cover
		expect(sleeps).toHaveLength(2);
		for (const ms of sleeps) expect(ms).toBeGreaterThanOrEqual(4000);
	});

	it('auto enrichment skips sourced, good-metadata and cooldown books', async () => {
		const poor = libraryBook('poor', '书/poor.pdf', { title: 'poor', author: '', autoMetadata: { title: 'poor', author: '' } });
		const sourced = libraryBook('sourced', '书/s.pdf', { source: { provider: 'zotero', id: 'Z1' }, autoMetadata: { title: 's', author: '' } });
		const good = libraryBook('good', '书/g.pdf', { title: '好书', author: '作者', autoMetadata: { title: '好书', author: '作者' } });
		const recent = libraryBook('recent', '书/r.pdf', { title: 'r', author: '', autoMetadata: { title: 'r', author: '' }, enrichment: { at: 1_000_000, status: 'missed' } });
		const { enricher, douban } = enricherHarness([poor, sourced, good, recent], { suggest: [] });
		const summary = await enricher.autoEnrichNewBooks(['poor', 'sourced', 'good', 'recent']);
		expect(summary.missed).toBe(1);
		expect(douban.calls).toHaveLength(1);
		expect(decodeURIComponent(douban.calls[0])).toContain('q=poor');
	});

	it('auto enrichment is inert while disabled', async () => {
		const poor = libraryBook('poor', '书/poor.pdf', { title: 'poor', author: '', autoMetadata: { title: 'poor', author: '' } });
		const { enricher, douban } = enricherHarness([poor], { suggest: [] }, { settings: { enabled: false } });
		const summary = await enricher.autoEnrichNewBooks(['poor']);
		expect(summary).toMatchObject({ matched: 0, missed: 0 });
		expect(douban.calls).toHaveLength(0);
	});

	it('rejects enrichment for unknown books and commits a batch in one write', async () => {
		const blank = libraryBook('one', '书/one.pdf', { author: '', autoMetadata: { title: 'one', author: '' } });
		const { index, commit } = enricherHarness([blank], {});
		await expect(index.enrichBooks([{ id: 'ghost', enrichment: { needsReview: false, record: { at: 1, status: 'matched' } } }])).rejects.toThrow('未找到图书');
		commit.mockClear();
		await index.enrichBooks([{ id: 'one', enrichment: { author: '补全作者', needsReview: false, record: { at: 1, status: 'matched' } } }]);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(index.get('one')?.author).toBe('补全作者');
	});
});
