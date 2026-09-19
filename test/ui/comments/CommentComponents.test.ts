import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommentPopover } from '../../../src/ui/comments/CommentPopover';
import { HighlightList } from '../../../src/ui/comments/HighlightList';
import { contrastRatio, swatchForeground, type CommentPopoverHost, type HighlightListHost } from '../../../src/ui/comments/CommentUiTypes';
import type { PdfComment, PdfHighlight } from '../../../src/types/contracts';

type Listener = (event: FakeEvent) => void;

class FakeEvent {
	defaultPrevented = false;
	key?: string;
	metaKey = false;
	ctrlKey = false;

	preventDefault(): void { this.defaultPrevented = true; }
}

class FakeElement {
	children: FakeElement[] = [];
	className = '';
	dataset: Record<string, string> = {};
	disabled = false;
	htmlFor = '';
	id = '';
	placeholder = '';
	tabIndex = 0;
	type = '';
	value = '';
	private ownText = '';
	private readonly attributes = new Map<string, string>();
	private readonly listeners = new Map<string, Listener[]>();

	get textContent(): string { return `${this.ownText}${this.children.map(child => child.textContent).join('')}`; }
	set textContent(value: string) { this.ownText = value; this.children = []; }

	append(...children: FakeElement[]): void { this.children.push(...children); }
	replaceChildren(...children: FakeElement[]): void { this.ownText = ''; this.children = [...children]; }
	setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
	getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
	addEventListener(name: string, listener: Listener): void {
		const listeners = this.listeners.get(name) ?? [];
		listeners.push(listener);
		this.listeners.set(name, listeners);
	}
	click(): void { this.emit('click'); }
	emit(name: string, event = new FakeEvent()): FakeEvent {
		for (const listener of this.listeners.get(name) ?? []) listener(event);
		return event;
	}
}

class FakeDocument {
	createElement(_tagName: string): FakeElement { return new FakeElement(); }
}

const highlight: PdfHighlight = {
	id: 'high light',
	pdfPath: '书籍/示例.pdf',
	page: 1,
	rotation: 0,
	rects: [{ x: 0, y: 0, width: 0.2, height: 0.1 }],
	text: '一段中文原文',
	color: 'moss',
	chapterPath: [],
	tags: ['旧标签'],
	target: { type: 'canvas', path: '研究.canvas', objectId: 'node-1' },
	createdAt: 1,
	updatedAt: 1
};

function findByLabel(root: FakeElement, label: string): FakeElement {
	const found = walk(root).find(element => element.getAttribute('aria-label') === label);
	if (!found) throw new Error(`Could not find control: ${label}`);
	return found;
}

function walk(root: FakeElement): FakeElement[] {
	return [root, ...root.children.flatMap(child => walk(child))];
}

async function flushActions(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('CommentPopover', () => {
	const originalDocument = globalThis.document;

	beforeEach(() => {
		Object.defineProperty(globalThis, 'document', { configurable: true, value: new FakeDocument() });
	});

	afterEach(() => {
		Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
	});

	it('renders Chinese accessible comment, tag, color, and keyboard controls through its host', async () => {
		const calls: string[] = [];
		const comments: PdfComment[] = [{ id: 'comment-1', highlightId: highlight.id, content: '保留这个结论', createdAt: 0, showTimestamp: true, source: 'pdf' }];
		const host: CommentPopoverHost = {
			comments: () => comments,
			allTags: () => ['旧标签', '研究'],
			addComment: (_id, content) => { calls.push(`comment:${content}`); },
			deleteComment: (_id, commentId) => { calls.push(`delete-comment:${commentId}`); },
			setTags: (_id, tags) => { calls.push(`tags:${tags.join(',')}`); },
			recolorHighlight: (_id, color) => { calls.push(`color:${color}`); },
			deleteHighlight: id => { calls.push(`delete:${id}`); },
			jumpToHighlight: item => { calls.push(`jump:${item.id}`); }
		};
		const root = new FakeElement();
		let closed = 0;
		const popover = new CommentPopover(host);
		popover.open(root as unknown as HTMLElement, { highlight, onClose: () => { closed += 1; } });

		expect(root.textContent).toContain('评论与标注');
		expect(root.textContent).toContain('一段中文原文');
		expect(root.textContent).toContain('Canvas 摘录');
		expect(root.textContent).toContain('保留这个结论');
		expect(findByLabel(root, '选择苔绿高亮色').getAttribute('aria-pressed')).toBe('true');
		findByLabel(root, '跳转到此高亮').click();
		findByLabel(root, '选择琥珀高亮色').click();
		findByLabel(root, '删除评论：保留这个结论').click();
		const tagInput = findByLabel(root, '添加标签');
		tagInput.value = '研究';
		findByLabel(root, '添加标签').emit('keydown', Object.assign(new FakeEvent(), { key: 'Enter' }));
		await flushActions();

		expect(calls).toEqual(expect.arrayContaining(['jump:high light', 'color:amber', 'delete-comment:comment-1', 'tags:旧标签,研究']));
		const dialog = walk(root).find(element => element.getAttribute('role') === 'dialog');
		dialog?.emit('keydown', Object.assign(new FakeEvent(), { key: 'Escape' }));
		expect(root.children).toHaveLength(0);
		expect(closed).toBe(1);
	});

	it('shows an error state when a host operation fails', async () => {
		const root = new FakeElement();
		const popover = new CommentPopover({
			comments: () => [], allTags: () => [], addComment: () => undefined, deleteComment: () => undefined,
			setTags: () => undefined, recolorHighlight: () => { throw new Error('存储不可用'); },
			deleteHighlight: () => undefined, jumpToHighlight: () => undefined
		});
		popover.open(root as unknown as HTMLElement, { highlight });
		findByLabel(root, '选择琥珀高亮色').click();
		await flushActions();
		expect(root.textContent).toContain('操作失败：存储不可用');
	});
});

describe('swatch contrast', () => {
	it('chooses a WCAG AA foreground for the Canvas colours seen in both themes', () => {
		for (const background of [
			[68, 207, 110], [224, 222, 113], [251, 70, 76], [168, 130, 255], [83, 223, 221],
			[8, 185, 78], [224, 172, 0], [233, 49, 71], [120, 82, 238], [0, 191, 188]
		]) {
			const foreground = swatchForeground(background) === 'rgb(12, 14, 18)' ? [12, 14, 18] : [248, 247, 244];
			expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('recomputes the foreground when a theme changes the resolved indigo', () => {
		// Moonstone light's darker indigo requires tinted light text; after a
		// theme toggle its resolved brighter indigo requires the tinted dark text.
		expect(swatchForeground([120, 82, 238])).toBe('rgb(248, 247, 244)');
		expect(swatchForeground([168, 130, 255])).toBe('rgb(12, 14, 18)');
	});
});

describe('HighlightList', () => {
	const originalDocument = globalThis.document;

	beforeEach(() => {
		Object.defineProperty(globalThis, 'document', { configurable: true, value: new FakeDocument() });
	});

	afterEach(() => {
		Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
	});

	it('renders loading, empty, error, and populated list states with host-driven actions', async () => {
		const calls: string[] = [];
		const host: HighlightListHost = {
			recolorHighlight: (id, color) => { calls.push(`color:${id}:${color}`); },
			deleteHighlight: id => { calls.push(`delete:${id}`); },
			jumpToHighlight: item => { calls.push(`jump:${item.id}`); }
		};
		const root = new FakeElement();
		const list = new HighlightList(host);
		list.render(root as unknown as HTMLElement, { highlights: [], loading: true });
		expect(root.textContent).toContain('正在加载高亮…');
		list.render(root as unknown as HTMLElement, { highlights: [] });
		expect(root.textContent).toContain('本书还没有高亮。');
		list.render(root as unknown as HTMLElement, { highlights: [], error: '索引不可用' });
		expect(root.textContent).toContain('高亮加载失败：索引不可用');
		list.render(root as unknown as HTMLElement, { highlights: [highlight] });
		expect(root.textContent).toContain('旧标签');
		expect(findByLabel(root, '颜色：苔绿').getAttribute('role')).toBe('img');
		findByLabel(root, '跳转到高亮：一段中文原文').click();
		findByLabel(root, '选择梅紫高亮色').click();
		findByLabel(root, '删除此高亮').click();
		await flushActions();
		expect(calls).toEqual(expect.arrayContaining(['jump:high light', 'color:high light:plum', 'delete:high light']));
	});
});
