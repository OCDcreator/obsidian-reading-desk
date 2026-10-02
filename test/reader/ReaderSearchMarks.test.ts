import { describe, expect, it } from 'vitest';
import { clearSearchMarks, markSearchHits, scrollToSearchHit } from '../../src/reader/ReaderSearchMarks';
import { findPageHits } from '../../src/reader/ReaderSearchService';
import { indexPdfText } from '../../src/reader/PdfTextIndex';
import { ReaderTestDocument } from './ReaderTestDom';
describe('exact search current hit rendering', () => {
	it('marks phrases across spans and scrolls to the selected occurrence on the same page', () => {
		const doc = new ReaderTestDocument(); const host = doc.body.createDiv(); host.dataset.page = '2';
		const layer = host.createDiv({ cls: 'rd-pdf-text-layer' }); const items = [{ str: 'hello ' }, { str: 'world hello world' }]; const index = indexPdfText(items); layer.dataset.rdPageText = index.text;
		items.forEach((item, position) => { const span = layer.createEl('span'); span.createEl('text', { text: item.str }); span.dataset.rdTextStart = String(index.spans[position].start); span.dataset.rdTextEnd = String(index.spans[position].end); });
		const hits = findPageHits(2, index.text, 'hello world', index.spans);
		markSearchHits(host as unknown as HTMLElement, 'hello world', hits[1]);
		expect(host.querySelectorAll('.rd-search-hit')).toHaveLength(3); expect(host.querySelectorAll('.rd-search-hit--current')).toHaveLength(1);
		expect(scrollToSearchHit(host as unknown as HTMLElement, hits[1])).toBe(true);
		expect(host.querySelector('.rd-search-hit--current')?.scrollCount).toBe(1);
		expect(host.querySelector('.rd-search-hit--current')?.style.left).toBe('30px');
		clearSearchMarks(host as unknown as HTMLElement); expect(host.querySelectorAll('.rd-search-hit')).toHaveLength(0); expect(layer.children).toHaveLength(2);
	});
});
