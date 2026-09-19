import { describe, expect, it } from 'vitest';
import { AnnotationStore, type AnnotationPersistence } from '../../src/annotations/AnnotationStore';
import { UnsupportedExcalidrawFormatError } from '../../src/targets/ExcalidrawTargetAdapter';
import type { FileGateway } from '../../src/targets/FileGateway';
import { parseMarkdownBacklink } from '../../src/targets/MarkdownTargetAdapter';
import { TargetService } from '../../src/targets/TargetService';
import type { AnnotationTarget, PdfComment, PdfHighlight } from '../../src/types/contracts';

class MemoryFiles implements FileGateway {
	readonly writes: string[] = [];
	activeWrites = 0;
	maxActiveWrites = 0;

	constructor(readonly contents: Record<string, string>) { }

	async atomicTransform(path: string, transformer: (current: string) => string | Promise<string>): Promise<void> {
		this.activeWrites += 1;
		this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
		this.contents[path] = await transformer(this.contents[path]);
		this.writes.push(path);
		this.activeWrites -= 1;
	}
}

class LatestContentFiles extends MemoryFiles {
	private injected = false;

	async atomicTransform(path: string, transformer: (current: string) => string | Promise<string>): Promise<void> {
		if (!this.injected) {
			this.injected = true;
			this.contents[path] = `${this.contents[path]}\n用户刚刚添加的内容\n`;
		}
		return super.atomicTransform(path, transformer);
	}
}

function highlight(id = 'highlight-1', target?: AnnotationTarget): PdfHighlight {
	return {
		id,
		pdfPath: 'papers/original.pdf',
		page: 12,
		rotation: 0,
		rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
		text: 'A highlighted source sentence.',
		color: 'moss',
		chapterPath: ['第一章', '第一节'],
		tags: [],
		target,
		createdAt: 1,
		updatedAt: 1
	};
}

function persistence(highlights: Record<string, PdfHighlight>): AnnotationPersistence {
	const comments: Record<string, PdfComment[]> = {};
	return {
		readHighlights: () => highlights,
		readComments: () => comments,
		commit: async mutator => { mutator(); }
	};
}

describe('TargetService canvas adapter', () => {
	it('creates real Canvas chapter nodes and edges, then removes only its excerpt node', async () => {
		const path = 'notes/research.canvas';
		const files = new MemoryFiles({
			[path]: JSON.stringify({
				nodes: [{
					id: 'user-node', type: 'text', text: 'This is mine', x: 10, y: 10, width: 200, height: 100,
					// A user-owned node with lookalike data is not a versioned Reading Desk card.
					readingDesk: { kind: 'excerpt', highlightId: 'highlight-1' }
				}],
				edges: []
			})
		});
		const service = new TargetService(files);
		const result = await service.writeExcerpt({ type: 'canvas', path }, highlight(), { title: '关键结论', folded: true });
		const canvas = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };

		expect(result.target.objectId).toBe(result.objectId);
		expect(canvas.nodes).toHaveLength(4);
		expect(canvas.nodes.find(node => node.id === 'user-node')?.text).toBe('This is mine');
		expect(canvas.nodes.filter(node => (node.readingDesk as { kind?: string } | undefined)?.kind === 'chapter')).toHaveLength(2);
		const excerpt = canvas.nodes.find(node => node.id === result.objectId);
		expect((excerpt?.readingDesk as { highlightId?: string }).highlightId).toBe('highlight-1');
		expect(excerpt?.collapsed).toBeUndefined();
		expect(excerpt?.color).toBe('4');
		expect((excerpt?.readingDesk as { color?: string }).color).toBe('moss');
		expect(excerpt?.height).toEqual(expect.any(Number));
		expect(canvas.edges).toHaveLength(2);

		await service.deleteExcerpt(result.target, 'highlight-1');
		const afterDelete = JSON.parse(files.contents[path]) as { nodes: Array<{ id: string }> };
		expect(afterDelete.nodes.map(node => node.id)).toContain('user-node');
		expect(afterDelete.nodes.map(node => node.id)).not.toContain(result.objectId);
	});

	it('keeps chapters separate by PDF and synchronizes the Canvas native color on a recolor write', async () => {
		const path = 'notes/colors.canvas';
		const files = new MemoryFiles({ [path]: JSON.stringify({ nodes: [], edges: [] }) });
		const service = new TargetService(files);
		const first = highlight('color-id');
		const firstResult = await service.writeExcerpt({ type: 'canvas', path }, first);
		const recolored = { ...first, color: 'brick' as const, text: 'This is a longer recolored excerpt '.repeat(50) };
		await service.writeExcerpt(firstResult.target, recolored);
		const otherPdf = { ...highlight('other-pdf'), pdfPath: 'papers/other.pdf' };
		await service.writeExcerpt({ type: 'canvas', path }, otherPdf);
		const canvas = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>> };
		const excerpt = canvas.nodes.find(node => node.id === firstResult.objectId);
		const chapters = canvas.nodes.filter(node => (node.readingDesk as { kind?: string } | undefined)?.kind === 'chapter');

		expect(excerpt?.color).toBe('1');
		expect((excerpt?.readingDesk as { color?: string }).color).toBe('brick');
		expect(excerpt?.height).toBeGreaterThan(180);
		expect(chapters).toHaveLength(4);
	});

	it('maps Reading Desk excerpt fold state to compact native height and restores full height on unfold without changing text or user nodes', async () => {
		const path = 'notes/folded.canvas';
		const userText = '用户自己的 Canvas 文本';
		const files = new MemoryFiles({
			[path]: JSON.stringify({
				nodes: [{ id: 'user-node', type: 'text', text: userText, x: 0, y: 0, width: 200, height: 120 }],
				edges: []
			})
		});
		const service = new TargetService(files);
		const longHighlight = { ...highlight('fold-id'), text: '长摘录 '.repeat(180) };
		const created = await service.writeExcerpt({ type: 'canvas', path }, longHighlight, { folded: false, title: '可折叠摘录' });
		const unfoldedCanvas = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>> };
		const unfolded = unfoldedCanvas.nodes.find(node => node.id === created.objectId);
		const initialText = unfolded?.text;
		const fullHeight = unfolded?.height as number;

		await service.writeExcerpt(created.target, longHighlight, { folded: true, title: '可折叠摘录' });
		const foldedCanvas = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>> };
		const folded = foldedCanvas.nodes.find(node => node.id === created.objectId);
		expect(folded?.height).toBe(72);
		expect(folded?.height).toBeLessThan(fullHeight);
		expect(folded?.text).toBe(initialText);
		expect((folded?.readingDesk as { folded?: boolean }).folded).toBe(true);
		expect(folded?.collapsed).toBeUndefined();
		expect(foldedCanvas.nodes.find(node => node.id === 'user-node')).toMatchObject({ text: userText, height: 120 });

		await service.writeExcerpt(created.target, longHighlight, { folded: false, title: '可折叠摘录' });
		const restoredCanvas = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>> };
		const restored = restoredCanvas.nodes.find(node => node.id === created.objectId);
		expect(restored?.height).toBe(fullHeight);
		expect(restored?.text).toBe(initialText);
		expect((restored?.readingDesk as { folded?: boolean }).folded).toBe(false);
		expect(restoredCanvas.nodes.find(node => node.id === 'user-node')).toMatchObject({ text: userText, height: 120 });
	});

	it('serializes writes per target path so the second card observes the first write', async () => {
		const path = 'notes/serial.canvas';
		const files = new MemoryFiles({ [path]: JSON.stringify({ nodes: [], edges: [] }) });
		const service = new TargetService(files);
		await Promise.all([
			service.writeExcerpt({ type: 'canvas', path }, highlight('one')),
			service.writeExcerpt({ type: 'canvas', path }, highlight('two'))
		]);
		const canvas = JSON.parse(files.contents[path]) as { nodes: Array<{ readingDesk?: { highlightId?: string } }> };
		expect(canvas.nodes.map(node => node.readingDesk?.highlightId)).toEqual(expect.arrayContaining(['one', 'two']));
		expect(files.maxActiveWrites).toBe(1);
	});

	it('materializes every PDF outline branch idempotently without disturbing existing excerpts, user nodes, or a same-named second PDF', async () => {
		const path = 'notes/full-outline.canvas';
		const files = new MemoryFiles({
			[path]: JSON.stringify({
				nodes: [{ id: 'user-node', type: 'text', text: '我的普通节点', x: 1, y: 2, width: 300, height: 100 }],
				edges: []
			})
		});
		const service = new TargetService(files);
		const excerptHighlight = { ...highlight('existing-excerpt'), chapterPath: ['第一章', '已摘录小节'] };
		const excerpt = await service.writeExcerpt({ type: 'canvas', path }, excerptHighlight);
		const firstOutline = [
			{ title: '第一章', page: 0, path: ['第一章'] },
			{ title: '已摘录小节', page: 1, path: ['第一章', '已摘录小节'] },
			{ title: '未摘录小节', page: 8, path: ['第一章', '未摘录小节'] },
			{ title: '第二章', page: 15, path: ['第二章'] },
			{ title: '深层未摘录', page: 19, path: ['第二章', '深层未摘录', '第三层'] }
		];

		const first = await service.syncOutline(path, excerptHighlight.pdfPath, firstOutline);
		const afterFirst = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
		const firstChapterIds = [...first.chapterNodeIds];
		const chapters = afterFirst.nodes.filter(node => (node.readingDesk as { kind?: string } | undefined)?.kind === 'chapter');
		const unexcerpted = chapters.find(node => ((node.readingDesk as { chapterPath?: string[] }).chapterPath ?? []).join('/') === '第二章/深层未摘录/第三层');

		expect(unexcerpted).toBeDefined();
		expect(afterFirst.nodes.find(node => node.id === excerpt.objectId)?.readingDesk).toMatchObject({ kind: 'excerpt', highlightId: 'existing-excerpt' });
		expect(afterFirst.nodes.find(node => node.id === 'user-node')).toMatchObject({ text: '我的普通节点', height: 100 });
		expect(afterFirst.edges.some(edge => edge.toNode === excerpt.objectId)).toBe(true);

		const rerun = await service.syncOutline(path, excerptHighlight.pdfPath, firstOutline);
		const afterRerun = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
		expect(rerun.createdNodeIds).toEqual([]);
		expect(rerun.chapterNodeIds).toEqual(firstChapterIds);
		expect(afterRerun.nodes).toHaveLength(afterFirst.nodes.length);
		expect(afterRerun.edges).toHaveLength(afterFirst.edges.length);

		const second = await service.syncOutline(path, 'papers/another.pdf', [{ title: '第一章', page: 3, path: ['第一章'] }]);
		const afterSecondPdf = JSON.parse(files.contents[path]) as { nodes: Array<Record<string, unknown>> };
		const firstPdfChapter = afterSecondPdf.nodes.find(node => (node.readingDesk as { pdfPath?: string; chapterPath?: string[] } | undefined)?.pdfPath === excerptHighlight.pdfPath
			&& ((node.readingDesk as { chapterPath?: string[] }).chapterPath ?? []).join('/') === '第一章');
		const secondPdfChapter = afterSecondPdf.nodes.find(node => node.id === second.chapterNodeIds[0]);
		expect(secondPdfChapter?.id).not.toBe(firstPdfChapter?.id);
		expect((secondPdfChapter?.readingDesk as { pdfPath?: string }).pdfPath).toBe('papers/another.pdf');
	});
});

describe('TargetService markdown adapter', () => {
	it('appends parseable fenced metadata and returns its original-source link', async () => {
		const path = 'notes/reading.md';
		const files = new MemoryFiles({ [path]: '# Research\n' });
		const service = new TargetService(files);
		await service.writeExcerpt({ type: 'markdown', path }, highlight(), { title: '可回跳摘录', folded: true });

		expect(files.contents[path]).toContain('```reading-desk');
		expect(files.contents[path]).toContain('[原文第 13 页](obsidian://reading-desk-highlight?file=papers%2Foriginal.pdf&highlight=highlight-1)');
		expect(parseMarkdownBacklink(files.contents[path], 'highlight-1')).toEqual({
			highlightId: 'highlight-1',
			sourceLink: 'obsidian://reading-desk-highlight?file=papers%2Foriginal.pdf&highlight=highlight-1',
			page: 12
		});
	});

	it('transforms the latest target contents so a user edit is not lost between intent and write', async () => {
		const path = 'notes/latest.md';
		const files = new LatestContentFiles({ [path]: '# Research\n' });
		await new TargetService(files).writeExcerpt({ type: 'markdown', path }, highlight());

		expect(files.contents[path]).toContain('用户刚刚添加的内容');
		expect(files.contents[path]).toContain('<!-- reading-desk:excerpt-start id=highlight-1 -->');
	});
});

describe('TargetService Excalidraw adapter', () => {
	it('writes an isolated Excalidraw text-element mapping, not a Canvas node id', async () => {
		const path = 'notes/research.excalidraw.md';
		const files = new MemoryFiles({
			[path]: '---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n# Excalidraw Data\n\n## Text Elements\n%%\n## Drawing\n```json\n{"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":[],"appState":{},"files":{}}\n```\n%%\n'
		});
		const service = new TargetService(files);
		const result = await service.writeExcerpt({ type: 'excalidraw', path }, highlight(), { title: '图上摘录' });
		const scene = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(files.contents[path])?.[1] ?? '{}') as { elements: Array<Record<string, unknown>> };
		const element = scene.elements[0];

		expect(result.objectId).toMatch(/^rd-excalidraw-/);
		expect(element.type).toBe('text');
		expect(((element.customData as { readingDesk?: { highlightId?: string } }).readingDesk?.highlightId)).toBe('highlight-1');
		expect(element.link).toBe('obsidian://reading-desk-highlight?file=papers%2Foriginal.pdf&highlight=highlight-1');
		expect(files.contents[path]).toContain('# Excalidraw Data\n\n## Text Elements\n%%\n## Drawing');
		expect(files.contents[path]).toMatch(/```json[\s\S]*```\n%%\n$/);

		await service.deleteExcerpt(result.target, 'highlight-1');
		const deleted = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(files.contents[path])?.[1] ?? '{}') as { elements: Array<{ isDeleted: boolean }> };
		expect(deleted.elements[0].isDeleted).toBe(true);
	});

	it('updates an existing Excalidraw card visible text, originalText, and link', async () => {
		const path = 'notes/update.excalidraw.md';
		const files = new MemoryFiles({
			[path]: '---\nexcalidraw-plugin: parsed\n---\n```json\n{"type":"excalidraw","elements":[],"appState":{},"files":{}}\n```'
		});
		const service = new TargetService(files);
		const result = await service.writeExcerpt({ type: 'excalidraw', path }, highlight(), { title: '旧标题' });
		await service.writeExcerpt(result.target, { ...highlight(), text: '已更新的可见原文' }, { title: '新标题', sourceLink: 'obsidian://open?file=new&page=7' });
		const scene = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(files.contents[path])?.[1] ?? '{}') as { elements: Array<Record<string, unknown>> };

		expect(scene.elements[0].text).toContain('新标题');
		expect(scene.elements[0].text).toContain('已更新的可见原文');
		expect(scene.elements[0].originalText).toBe(scene.elements[0].text);
		expect(scene.elements[0].link).toBe('obsidian://open?file=new&page=7');
	});

	it('opens a real-world compressed-json fixture and rewrites a valid JSON scene without touching the fixture source', async () => {
		const path = 'notes/compressed.excalidraw.md';
		const compressed = 'N4IgLgngDgpiBcIYA8DGBDANgSwCYCd0B3EAGhADcZ8BnbAewDsEAmcm+gV31TkQAswYKDXgB6MQHNsYfpwBGAOlT0AtmIBeNCtlQbs6RmPry6uA4wC0KDDgLFLUTJ2lH8MTDHQ0YNMWHRJMRZFFgAGRQAWMiRPVRhGMBoEAG0AXXJ0KCgAZQCwPlBJfDwc7A0+Rk5MTHIdGCIAIXRUAGtirkZcAGF6THp8BBAAYgAzcYmQAF8poA===';
		const source = `---\nexcalidraw-plugin: parsed\n---\n## Drawing\n\`\`\`compressed-json\n${compressed}\n\`\`\`\n%%`;
		const files = new MemoryFiles({ [path]: source });

		await new TargetService(files).writeExcerpt({ type: 'excalidraw', path }, highlight(), { title: '压缩场景摘录' });
		expect(source).toContain('```compressed-json');
		expect(files.contents[path]).toContain('```json');
		const scene = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(files.contents[path])?.[1] ?? '{}') as { type: string; elements: unknown[] };
		expect(scene.type).toBe('excalidraw');
		expect(scene.elements).toHaveLength(1);
	});

	it('refuses an unknown Excalidraw representation without modifying it', async () => {
		const path = 'notes/unknown.excalidraw.md';
		const original = '---\nexcalidraw-plugin: parsed\n---\nnot a scene';
		const files = new MemoryFiles({ [path]: original });
		const service = new TargetService(files);

		await expect(service.writeExcerpt({ type: 'excalidraw', path }, highlight())).rejects.toBeInstanceOf(UnsupportedExcalidrawFormatError);
		expect(files.contents[path]).toBe(original);
		expect(files.writes).toHaveLength(0);
	});
});

describe('TargetService reverse target reconciliation', () => {
	it('deletes only source-store candidates whose target cards are absent', async () => {
		const target: AnnotationTarget = { type: 'markdown', path: 'notes/reconcile.md', objectId: 'rd-markdown-old' };
		const missing = highlight('missing', target);
		const stillPresent = highlight('present', target);
		const files = new MemoryFiles({
			[target.path]: '<!-- reading-desk:excerpt-start id=present -->\n```reading-desk\n{"schemaVersion":1,"kind":"excerpt","highlightId":"present","sourceLink":"obsidian://open?file=a&page=1","page":1}\n```\n<!-- reading-desk:excerpt-end id=present -->'
		});
		const records = { missing, present: stillPresent };
		const store = new AnnotationStore(persistence(records));

		const removed = await new TargetService(files).removeMissingTargetHighlights(target, [missing, stillPresent], store);
		expect(removed).toEqual(['missing']);
		expect(store.get('missing')).toBeUndefined();
		expect(store.get('present')).toBe(stillPresent);
	});
});
