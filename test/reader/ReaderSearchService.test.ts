import { describe, expect, it } from 'vitest';
import { findPageHits, ReaderSearchService } from '../../src/reader/ReaderSearchService';
import { indexPdfText } from '../../src/reader/PdfTextIndex';
import { deferred, flushReaderTasks } from './ReaderTestDom';

describe('findPageHits', () => {
	it('finds case-insensitive matches with snippets and page numbers', () => {
		const hits = findPageHits(4, '量子力学描述微观世界的物理规律基础说明，而 QUANTUM 叠加态承载量子比特信息。Quantum 纠缠。', 'quantum');
		expect(hits.map(hit => hit.page)).toEqual([4, 4]);
		expect(hits[0].snippet).toContain('quantum');
		expect(hits[0].snippet.startsWith('…')).toBe(true);
	});

	it('indexes all twenty matches regardless of displayed row limits', () => {
		const text = Array.from({ length: 20 }, () => '关键词').join(' ');
		const hits = findPageHits(1, text, '关键词');
		expect(hits).toHaveLength(20);
		expect(hits.map(hit => hit.start)).toEqual(Array.from({ length: 20 }, (_, index) => index * 4));
		expect(hits.every(hit => text.slice(hit.start, hit.end) === '关键词')).toBe(true);
	});

	it('returns nothing for blank queries or missing text', () => {
		expect(findPageHits(1, '任意文本', '')).toEqual([]);
		expect(findPageHits(1, '任意文本', '   ')).toEqual([]);
		expect(findPageHits(1, '', '词')).toEqual([]);
	});
});

describe('search offsets and request ownership', () => {
	it('maps a phrase across three spans and line breaks to original offsets', () => {
		const index = indexPdfText([{ str: 'preface quantum', hasEOL: true }, { str: '   en' }, { str: 'tanglement suffix' }]);
		const [hit] = findPageHits(9, index.text, 'QUANTUM entanglement', index.spans);
		expect(hit.start).toBe(8);
		expect(index.text.slice(hit.start, hit.end)).toBe('quantum\n   entanglement');
		expect(hit.spans).toEqual([{ index: 0, start: 8, end: 15 }, { index: 1, start: 0, end: 5 }, { index: 2, start: 0, end: 10 }]);
	});
	it('case-fold expansion and collapsed whitespace retain UTF-16 offsets', () => {
		const [hit] = findPageHits(1, '😀 İ\t\nABC!', 'i̇ abc');
		expect(hit.start).toBe(3); expect(hit.end).toBe(9);
	});
	it('new query invalidates an older scan while sharing pending page extraction', async () => {
		const extracted = deferred<string>(); let calls = 0;
		const pdf = { pageText: async () => { calls += 1; return extracted.promise; } };
		const service = new ReaderSearchService();
		const old = service.search(pdf, 4, 'old').catch(error => error.name);
		await flushReaderTasks();
		const newest = service.search(pdf, 1, 'new'); extracted.resolve('old new new');
		expect(await old).toBe('AbortError'); expect(await newest).toHaveLength(2); expect(calls).toBe(1);
	});
	it('reset rejects stale extraction and does not populate the next document cache', async () => {
		const extracted = deferred<string>(); const service = new ReaderSearchService();
		const old = service.search({ pageText: () => extracted.promise }, 3, 'old').catch(error => error.name);
		await flushReaderTasks(); service.reset(); extracted.resolve('old');
		expect(await old).toBe('AbortError'); expect(service.hasPage(1)).toBe(false);
		expect(await service.search({ pageText: async () => 'new' }, 1, 'new')).toHaveLength(1);
	});
	it('abort stops waiting immediately and a failed page extraction remains retryable', async () => {
		const service = new ReaderSearchService(); const controller = new AbortController(); const extracted = deferred<string>();
		const old = service.search({ pageText: () => extracted.promise }, 2, 'x', undefined, controller.signal).catch(error => error.name);
		controller.abort(); expect(await old).toBe('AbortError'); extracted.resolve('x');
		let failures = 1; const pdf = { pageText: async () => { if (failures--) throw new Error('broken text'); return 'recovered'; } };
		await expect(service.search(pdf, 1, 'recovered')).rejects.toThrow('broken text');
		expect(await service.search(pdf, 1, 'recovered')).toHaveLength(1);
	});
});
