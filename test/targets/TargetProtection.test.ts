import { describe, expect, it } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { TargetService } from '../../src/targets/TargetService';
import type { DeletedAnnotation, ExcerptCardState, PdfComment, PdfHighlight, TargetType } from '../../src/types/contracts';

function setup(type: TargetType = 'markdown') {
	const target = { type, path: `notes.${type}`, objectId: 'h' };
	const highlight: PdfHighlight = { id: 'h', pdfPath: 'book.pdf', page: 0, rotation: 0, rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }], text: '原文', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1, target };
	const highlights: Record<string, PdfHighlight> = { h: highlight };
	const comments: Record<string, PdfComment[]> = { h: [{ id: 'c', highlightId: 'h', content: '想法', createdAt: 1, showTimestamp: true, source: 'pdf' }] };
	const deleted: Record<string, DeletedAnnotation> = {};
	const pending: Record<string, PdfHighlight> = {};
	const cards: Record<string, ExcerptCardState> = {};
	const store = new AnnotationStore({ readHighlights: () => highlights, readComments: () => comments, readExcerptCards: () => cards, readDeletedAnnotations: () => deleted, readPendingTargetWrites: () => pending, commit: async mutation => mutation() });
	let content: string | undefined = type === 'canvas' ? '{"nodes":[],"edges":[]}' : type === 'excalidraw' ? '---\nexcalidraw-plugin: parsed\n---\n```json\n{"type":"excalidraw","elements":[]}\n```' : '# Notes\n';
	let writes = 0;
	const service = new TargetService({ read: async () => content, atomicTransform: async (_path, transform) => { content = transform(content ?? ''); writes += 1; } });
	return { target, highlight, store, comments, deleted, pending, cards, service, content: () => content, set: (text: string | undefined) => { content = text; }, writes: () => writes };
}

describe('protected target reconciliation', () => {
	it.each(['markdown', 'canvas', 'excalidraw'] as const)('does not delete or create a temporarily missing %s target', async type => {
		const state = setup(type);
		state.set(undefined);
		expect(await state.service.removeMissingTargetHighlights(state.target, [state.highlight], state.store)).toEqual([]);
		expect(state.writes()).toBe(0);
		expect(state.store.get('h')).toBeDefined();
		expect(state.comments.h).toHaveLength(1);
		expect(state.service.listPendingRepairs()[0].reason).toBe('unavailable');
	});

	it.each([
		['markdown', '<!-- reading-desk:excerpt-start id=h -->\n坏的内容'],
		['markdown', '  <!-- reading-desk:excerpt-start id=h -->\n  ```reading-desk\n  {}\n  ```\n  <!-- reading-desk:excerpt-end id=h -->'],
		['markdown', '<!-- reading-desk:excerpt-start id=h -->\n```reading-desk\n{broken}\n```\n<!-- reading-desk:excerpt-end id=h -->'],
		['markdown', '<!-- reading-desk:excerpt-start id=h -->\n```reading-desk\n{}\n```\n<!-- reading-desk:excerpt-end id=other -->'],
		['markdown', '```reading-desk\n{"schemaVersion":1}\n```'],
		['canvas', '{"nodes":'],
		['canvas', '{"nodes":[null],"edges":[]}'],
		['excalidraw', '---\nexcalidraw-plugin: parsed\n---\n```json\n{broken}\n```'],
		['excalidraw', '---\nexcalidraw-plugin: parsed\n---\n```json\n{"type":"excalidraw","elements":[null]}\n```']
	] as const)('protects annotations/comments on damaged %s data', async (type, content) => {
		const state = setup(type);
		state.set(content);
		const result = await state.service.reconcileTarget(state.target, [state.highlight], state.store);
		expect(result.removedIds).toEqual([]);
		expect(result.diagnostics).toHaveLength(1);
		expect(state.store.get('h')).toBeDefined();
		expect(state.comments.h).toHaveLength(1);
		expect(state.content()).toBe(content);
	});

	it.each(['canvas', 'excalidraw'] as const)('protects %s objects when their metadata disappears', async type => {
		const state = setup(type);
		const result = await state.service.writeExcerpt(state.target, { ...state.highlight, target: undefined });
		state.highlight.target = result.target;
		if (type === 'canvas') {
			const document = JSON.parse(state.content() ?? '{}');
			delete document.nodes[0].readingDesk;
			state.set(JSON.stringify(document));
		} else state.set(state.content()?.replace(/"readingDesk": \{[\s\S]*?\n\s*\}/, '"other": {}'));
		const reconciliation = await state.service.reconcileTarget(result.target, [state.highlight], state.store);
		expect(reconciliation.removedIds).toEqual([]);
		expect(reconciliation.diagnostics[0].reason).toBe('metadata-missing');
		await expect(state.service.writeExcerpt(result.target, state.highlight)).rejects.toThrow('元数据');
	});

	it('protects stripped Markdown identity when the generated backlink remains', async () => {
		const state = setup();
		await state.service.writeExcerpt(state.target, state.highlight);
		state.set(state.content()?.replace(/<!--[^\n]*-->\n?/g, '').replace(/```reading-desk\n[\s\S]*?\n```/, ''));
		const result = await state.service.reconcileTarget(state.target, [state.highlight], state.store);
		expect(result.removedIds).toEqual([]);
		expect(result.diagnostics[0].reason).toBe('metadata-missing');
		await expect(state.service.writeExcerpt(state.target, state.highlight)).rejects.toThrow('标记缺失');
	});

	it.each(['markdown', 'canvas', 'excalidraw'] as const)('archives legal %s card deletion and restores its target through replay', async type => {
		const state = setup(type);
		const written = await state.service.writeExcerpt(state.target, { ...state.highlight, target: undefined });
		state.highlight.target = written.target;
		await state.service.deleteExcerpt(written.target, 'h');
		expect(await state.service.removeMissingTargetHighlights(written.target, [state.highlight], state.store)).toEqual(['h']);
		expect(state.deleted.h).toMatchObject({ reason: 'target-deleted', comments: [{ content: '想法' }] });
		await state.store.restoreDeleted('h');
		expect(await state.service.retryPendingTargetWrites(state.store)).toEqual([{ highlightId: 'h', status: 'recovered' }]);
		expect(state.store.listPendingTargetWrites()).toEqual([]);
		expect(await state.service.removeMissingTargetHighlights(written.target, state.store.listAll(), state.store)).toEqual([]);
	});

	it('does not recreate a missing target during a durable write or retry', async () => {
		const state = setup();
		state.set(undefined);
		await expect(state.service.writeAndSaveExcerpt(state.target, state.highlight, state.store)).rejects.toThrow('目标文件暂缺');
		expect(state.writes()).toBe(0);
		expect(state.store.listPendingTargetWrites()).toHaveLength(1);
		expect(await state.service.retryPendingTargetWrites(state.store)).toMatchObject([{ highlightId: 'h', status: 'pending' }]);
		expect(state.content()).toBeUndefined();
		expect(state.service.listPendingRepairs()[0].reason).toBe('unavailable');
	});

	it('uses current store target references rather than stale event candidates', async () => {
		const state = setup();
		const stale = { ...state.highlight };
		await state.store.save({ ...state.highlight, target: { type: 'markdown', path: 'moved.md' } });
		expect(await state.service.removeMissingTargetHighlights(state.target, [stale], state.store)).toEqual([]);
		expect(state.store.get('h')?.target?.path).toBe('moved.md');
	});

	it.each(['stage', 'move'] as const)('refreshes source state when %s happens during an asynchronous file read', async change => {
		const state = setup();
		let started: () => void = () => undefined;
		let release: (content: string) => void = () => undefined;
		const reading = new Promise<void>(resolve => { started = resolve; });
		const content = new Promise<string>(resolve => { release = resolve; });
		const service = new TargetService({ read: async () => { started(); return content; }, atomicTransform: async () => { throw new Error('must be read only'); } });
		const reconciliation = service.reconcileTarget(state.target, [state.highlight], state.store);
		await reading;
		if (change === 'stage') await state.store.stageTargetWrite(state.highlight);
		else await state.store.save({ ...state.highlight, target: { type: 'markdown', path: 'moved.md' } });
		release('# Empty target');
		expect((await reconciliation).removedIds).toEqual([]);
		expect(state.store.get('h')).toBeDefined();
	});

	it('skips pending target writes, filters candidates by target type and clears resolved diagnostics', async () => {
		const state = setup();
		await state.store.stageTargetWrite(state.highlight);
		state.service.reportMissingTarget(state.target.path, [state.highlight]);
		const other = { ...state.highlight, id: 'other', target: { type: 'canvas' as const, path: state.target.path } };
		await state.store.save(other);
		expect(await state.service.removeMissingTargetHighlights(state.target, [state.highlight, other], state.store)).toEqual([]);
		expect(state.service.listPendingRepairs()).toEqual([]);
		expect(state.store.get('other')).toBeDefined();
	});
});

describe('target updates retain user content', () => {
	it('retains Markdown title, native fold state, interleaved notes and edited quote through recolor/rename/repeated writes', async () => {
		const state = setup();
		await state.service.writeExcerpt(state.target, state.highlight);
		state.set(state.content()?.replace('> [!quote]+ 原文', '> [!quote]- 我的标题').replace('> 原文\n', '> 手写改过的引文\n> 手写分析\n'));
		const updated = { ...state.highlight, color: 'brick' as const, pdfPath: 'renamed.pdf' };
		await state.service.writeExcerpt(state.target, updated);
		await state.service.writeExcerpt(state.target, updated);
		expect(state.content()).toContain('> [!quote]- 我的标题');
		expect(state.content()).toContain('> 手写改过的引文\n> 手写分析');
		expect(state.content()?.match(/excerpt-start/g)).toHaveLength(1);
		expect(state.content()?.match(/手写分析/g)).toHaveLength(1);
	});

	it('archives the actual preserved native heading/fold state after an update and restores that card', async () => {
		const state = setup();
		await state.service.writeAndSaveExcerpt(state.target, state.highlight, state.store, { title: '初始标题', folded: false });
		state.set(state.content()?.replace('> [!quote]+ 初始标题', '> [!quote]- 手写标题'));
		const saved = state.store.get('h');
		if (!saved) throw new Error('Expected persisted highlight');
		await state.service.writeAndSaveExcerpt(state.target, { ...saved, color: 'brick' }, state.store);
		expect(state.cards.h).toEqual({ title: '手写标题', folded: true });
		await state.service.deleteExcerpt(state.target, 'h');
		await state.service.removeMissingTargetHighlights(state.target, state.store.listAll(), state.store);
		expect(state.deleted.h.excerptCard).toEqual({ title: '手写标题', folded: true });
		await state.store.restoreDeleted('h');
		await state.service.retryPendingTargetWrites(state.store);
		expect(state.content()).toContain('> [!quote]- 手写标题');
	});

	it('updates CRLF managed blocks without duplicating source text or losing notes', async () => {
		const state = setup();
		await state.service.writeExcerpt(state.target, state.highlight);
		state.set(state.content()?.replace('\n```reading-desk', '\n人工笔记\n```reading-desk').replace(/\n/g, '\r\n'));
		await state.service.writeExcerpt(state.target, { ...state.highlight, pdfPath: 'renamed.pdf' });
		expect(state.content()?.match(/^> 原文\r?$/gm)).toHaveLength(1);
		expect(state.content()).toContain('人工笔记');
		expect(state.content()).toContain('file=renamed.pdf');
	});

	it('migrates a legacy block without swallowing quoted/unquoted handwritten notes', async () => {
		const state = setup();
		state.set('<!-- reading-desk:excerpt-start id=h -->\n> [!quote]- 手写标题\n> 原文\n> 手写插入\n> [原文第 1 页](old-link)\n\n用户笔记\n```reading-desk\n{"schemaVersion":1,"kind":"excerpt","highlightId":"h","page":0,"sourceLink":"old-link","title":"旧","folded":false}\n```\n<!-- reading-desk:excerpt-end id=h -->');
		await state.service.writeExcerpt(state.target, state.highlight);
		expect(state.content()).toContain('> [!quote]- 手写标题');
		expect(state.content()).toContain('> 手写插入');
		expect(state.content()).toContain('用户笔记');
	});

	it.each(['canvas', 'excalidraw'] as const)('retains %s hand title/notes and native document envelope', async type => {
		const state = setup(type);
		const written = await state.service.writeExcerpt(state.target, { ...state.highlight, target: undefined }, { title: '生成标题', folded: true });
		state.highlight.target = written.target;
		if (type === 'canvas') {
			const document = JSON.parse(state.content() ?? '{}');
			document.nodes[0].text = document.nodes[0].text.replace('生成标题', '手写标题') + '\n人工分析';
			state.set(JSON.stringify(document));
		} else {
			const json = /```json\n([\s\S]*?)\n```/.exec(state.content() ?? '')?.[1] ?? '{}';
			const scene = JSON.parse(json);
			scene.elements[0].text = scene.elements[0].text.replace('生成标题', '手写标题') + '\n人工分析';
			state.set(`---\nexcalidraw-plugin: parsed\ncustom: keep\n---\n我的场景旁笔记\n\`\`\`json\n${JSON.stringify(scene)}\n\`\`\`\n尾注`);
		}
		await state.service.writeExcerpt(written.target, { ...state.highlight, color: 'amber', pdfPath: 'renamed.pdf' });
		expect(state.content()).toContain('手写标题');
		expect(state.content()).toContain('人工分析');
		expect(state.content()).toContain('"folded": true');
		if (type === 'excalidraw') {
			expect(state.content()).toContain('custom: keep');
			expect(state.content()).toContain('我的场景旁笔记');
			expect(state.content()).toContain('尾注');
		}
	});
});
