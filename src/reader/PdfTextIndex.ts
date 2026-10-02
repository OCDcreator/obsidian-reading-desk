export interface PdfTextSpan { index: number; start: number; end: number; }
export interface PdfPageTextIndex { text: string; spans: PdfTextSpan[]; }
/** Same item order as PDF.js TextLayer.textDivs, including EOLs. */
export function indexPdfText(items: Array<{ str?: string; hasEOL?: boolean }>): PdfPageTextIndex {
	let text = '';
	const spans: PdfTextSpan[] = [];
	for (const item of items) {
		if (typeof item.str !== 'string') continue;
		const start = text.length;
		text += item.str;
		spans.push({ index: spans.length, start, end: text.length });
		if (item.hasEOL) text += '\n';
	}
	return { text, spans };
}
