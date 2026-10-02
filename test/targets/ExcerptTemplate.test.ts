import { describe, expect, it } from 'vitest';
import { excerptTemplateValues, previewExcerptTemplate, renderExcerptTemplate } from '../../src/targets/ExcerptTemplate';
import { TargetService } from '../../src/targets/TargetService';
import type { PdfHighlight } from '../../src/types/contracts';

const highlight: PdfHighlight = { id: 'h', pdfPath: 'books/paper.pdf', page: 2, rotation: 0, rects: [], text: '{{page}} ${globalThis.templateExecuted = true}', color: 'moss', chapterPath: ['章', '节'], tags: ['标签'], createdAt: 1, updatedAt: 1 };

describe('fixed excerpt templates', () => {
	it('previews all supported values and never interprets inserted placeholders or JavaScript', () => {
		const values = excerptTemplateValues(highlight, '手写标题', 'obsidian://source');
		const preview = previewExcerptTemplate('{{title}} | {{text}} | {{page}} | {{pdfPath}} | {{sourceLink}} | {{color}} | {{chapterPath}} | {{tags}}', values);
		expect(preview.unknownPlaceholders).toEqual([]);
		expect(preview.text).toContain('手写标题 | {{page}} ${globalThis.templateExecuted = true} | 3');
		expect(preview.text).toContain('books/paper.pdf | obsidian://source | moss | 章 / 节 | 标签');
		expect((globalThis as { templateExecuted?: boolean }).templateExecuted).toBeUndefined();
	});

	it('reports unsupported expressions in preview and refuses writes', () => {
		const values = excerptTemplateValues(highlight, '标题', 'link');
		expect(previewExcerptTemplate('{{constructor}} {{text.toUpperCase()}}', values).unknownPlaceholders).toEqual(['constructor', 'text.toUpperCase()']);
		expect(() => renderExcerptTemplate('{{text.toUpperCase()}}', values)).toThrow('不支持的占位符');
	});

	it('resolves the template getter for each write and retains handwritten notes when templates change', async () => {
		let content = '';
		let template = '{{text}}\n颜色：{{color}}';
		const service = new TargetService({ read: async () => content, atomicTransform: async (_path, transform) => { content = transform(content); } }, { template: () => template });
		const target = { type: 'markdown' as const, path: 'note.md' };
		await service.writeExcerpt(target, highlight);
		content = content.replace('\n```reading-desk', '\n用户笔记\n```reading-desk');
		template = '{{text}}\n来源：{{pdfPath}}';
		await service.writeExcerpt(target, highlight);
		expect(content).toContain('> 来源：books/paper.pdf');
		expect(content).toContain('用户笔记');
		expect(content).not.toContain('> 颜色：moss');
	});
});
