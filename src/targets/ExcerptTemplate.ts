import type { PdfHighlight } from '../types/contracts';

export const EXCERPT_TEMPLATE_PLACEHOLDERS = ['title', 'text', 'page', 'pageLabel', 'pdfPath', 'sourceLink', 'color', 'chapterPath', 'tags'] as const;
export const DEFAULT_EXCERPT_TEMPLATE = '{{text}}\n\n[原文第 {{pageLabel}} 页]({{sourceLink}})';
export type ExcerptTemplateValues = Record<Exclude<typeof EXCERPT_TEMPLATE_PLACEHOLDERS[number], 'pageLabel'>, string> & { pageLabel?: string };

export interface ExcerptTemplatePreview {
	text: string;
	unknownPlaceholders: string[];
}

export function excerptTemplateValues(highlight: PdfHighlight, title: string, sourceLink: string): ExcerptTemplateValues {
	return {
		title, text: highlight.text, sourceLink, page: String(highlight.page + 1), pageLabel: highlight.pageLabel || String(highlight.page + 1), pdfPath: highlight.pdfPath,
		color: highlight.color, chapterPath: highlight.chapterPath.join(' / '), tags: highlight.tags.join(', ')
	};
}

/** One-pass substitution: inserted values and JS-looking text are never evaluated. */
export function previewExcerptTemplate(template: string | undefined, values: ExcerptTemplateValues): ExcerptTemplatePreview {
	const unknown = new Set<string>();
	const text = (template?.trim() ? template : DEFAULT_EXCERPT_TEMPLATE).replace(/\{\{([^{}]+)\}\}/g, (match: string, raw: string) => {
		const key = raw.trim();
		if (!EXCERPT_TEMPLATE_PLACEHOLDERS.some(allowed => allowed === key)) {
			unknown.add(key);
			return match;
		}
		return key === 'pageLabel' ? values.pageLabel || values.page : values[key as keyof ExcerptTemplateValues] ?? '';
	});
	return { text, unknownPlaceholders: [...unknown] };
}

export function renderExcerptTemplate(template: string | undefined, values: ExcerptTemplateValues): string {
	const preview = previewExcerptTemplate(template, values);
	if (preview.unknownPlaceholders.length) throw new Error(`摘录模板包含不支持的占位符：${preview.unknownPlaceholders.join(', ')}`);
	return preview.text;
}
