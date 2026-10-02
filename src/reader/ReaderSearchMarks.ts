import { findPageHits, type SearchHit } from './ReaderSearchService';
import type { PdfTextSpan } from './PdfTextIndex';
/** Exact Range rectangles preserve text selection across spans and lines. */
export function markSearchHits(host: HTMLElement, query: string, current: SearchHit | null = null): void {
	clearSearchMarks(host);
	const textLayer = host.querySelector<HTMLElement>('.rd-pdf-text-layer');
	if (!textLayer || !query.trim()) return;
	const spans = Array.from(textLayer.querySelectorAll<HTMLElement>('[data-rd-text-start]'));
	const mapping: PdfTextSpan[] = spans.map((span, index) => ({ index, start: Number(span.dataset.rdTextStart), end: Number(span.dataset.rdTextEnd) }));
	const hits = findPageHits(Number(host.dataset.page ?? 1), textLayer.dataset.rdPageText ?? '', query, mapping);
	const overlay = host.ownerDocument.createElement('div');
	overlay.className = 'rd-search-hit-overlay';
	overlay.setAttribute('aria-hidden', 'true');
	const bounds = host.getBoundingClientRect();
	const width = host.offsetWidth || bounds.width;
	const height = host.offsetHeight || bounds.height;
	for (const hit of hits) {
		for (const part of hit.spans) {
			const span = spans[part.index];
			if (!span?.firstChild || part.end > (span.firstChild.textContent?.length ?? 0)) continue;
			const range = host.ownerDocument.createRange();
			range.setStart(span.firstChild, part.start);
			range.setEnd(span.firstChild, part.end);
			for (const rect of Array.from(range.getClientRects())) {
				if (rect.width <= 0 || rect.height <= 0 || bounds.width <= 0 || bounds.height <= 0) continue;
				const mark = host.ownerDocument.createElement('div');
				const active = current?.page === hit.page && current.start === hit.start && current.end === hit.end;
				mark.className = `rd-search-hit${active ? ' rd-search-hit--current' : ''}`;
				mark.dataset.searchHitStart = String(hit.start);
				Object.assign(mark.style, {
					left: `${(rect.left - bounds.left) * width / bounds.width}px`, top: `${(rect.top - bounds.top) * height / bounds.height}px`,
					width: `${rect.width * width / bounds.width}px`, height: `${rect.height * height / bounds.height}px`
				});
				overlay.append(mark);
			}
		}
	}
	host.append(overlay);
}
export function clearSearchMarks(host: HTMLElement): void {
	host.querySelector('.rd-search-hit-overlay')?.remove();
	for (const span of Array.from(host.querySelectorAll<HTMLElement>('.rd-pdf-text-layer .rd-search-hit'))) span.classList.remove('rd-search-hit');
}
export function scrollToSearchHit(host: HTMLElement, hit: SearchHit): boolean {
	const mark = host.querySelector<HTMLElement>(`[data-search-hit-start="${hit.start}"]`);
	if (!mark) return false;
	mark.scrollIntoView({ block: 'center', behavior: 'auto' });
	return true;
}
