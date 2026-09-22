import { describe, expect, it, vi } from 'vitest';
import { ReaderNavigation } from '../../src/reader/ReaderNavigation';
import type { OutlineStyle } from '../../src/reader/ReaderOutlineModel';
import type { PdfOutlineEntry } from '../../src/reader/PdfRenderer';
import { FakeDocument, FakeElement, FakeEvent } from '../support/fake-dom';

const flatNumbered: PdfOutlineEntry[] = [
	{ title: '1 Parent', page: 0, path: ['1 Parent'] },
	{ title: '1.1 Child', page: 2, path: ['1.1 Child'] },
	{ title: '2 Sibling', page: 4, path: ['2 Sibling'] }
];

const deepNumbered: PdfOutlineEntry[] = [
	{ title: '1 Root', page: 0, path: ['1 Root'] },
	{ title: '1.1 Branch', page: 2, path: ['1.1 Branch'] },
	{ title: '1.1.1 Leaf', page: 5, path: ['1.1.1 Leaf'] },
	{ title: '2 Other', page: 9, path: ['2 Other'] }
];

function walk(root: FakeElement): FakeElement[] {
	return [root, ...root.children.flatMap(child => walk(child))];
}

function items(root: FakeElement): FakeElement[] {
	return walk(root).filter(element => element.getAttribute('role') === 'treeitem');
}

function itemByTitle(root: FakeElement, title: string): FakeElement {
	const found = items(root).find(element => (element.getAttribute('title') ?? '').startsWith(title));
	if (!found) throw new Error(`No outline row titled ${title}`);
	return found;
}

function rowOf(item: FakeElement): FakeElement {
	const row = item.children.find(child => child.className === 'rd-outline-row');
	if (!row) throw new Error('Row missing');
	return row;
}

function gutterOf(item: FakeElement): FakeElement {
	const gutter = rowOf(item).children.find(child => child.className === 'rd-outline-gutter');
	if (!gutter) throw new Error('Gutter missing');
	return gutter;
}

function titleOf(item: FakeElement): FakeElement {
	const title = rowOf(item).children.find(child => child.className === 'rd-outline-title');
	if (!title) throw new Error('Title span missing');
	return title;
}

function pageOf(item: FakeElement): FakeElement {
	const page = rowOf(item).children.find(child => child.className === 'rd-reader-outline__page');
	if (!page) throw new Error('Page span missing');
	return page;
}

function isVisible(element: FakeElement): boolean {
	for (let node: FakeElement | null = element.parent; node; node = node.parent) if (node.hidden) return false;
	return true;
}

function visibleItems(root: FakeElement): FakeElement[] {
	return items(root).filter(isVisible);
}

function tabStops(root: FakeElement): string[] {
	return items(root).filter(element => element.getAttribute('tabindex') === '0').map(element => element.getAttribute('title') ?? '');
}

function outlineOf(root: FakeElement): FakeElement {
	const tree = walk(root).find(element => element.className.includes('rd-reader-outline'));
	if (!tree) throw new Error('outline tree missing');
	return tree;
}

/** Key events travel the real bubble path: dispatched on the focused item. */
function press(tree: FakeElement, key: string): FakeEvent {
	const target = visibleItems(tree).find(element => element.getAttribute('tabindex') === '0') ?? tree;
	const event = new FakeEvent('keydown', { key });
	target.dispatchEvent(event);
	return event;
}

function renderNavigation(options: { outline?: PdfOutlineEntry[]; page?: number; style?: OutlineStyle } = {}) {
	const jumps: number[] = [];
	const goTo = vi.fn(async (page: number) => { jumps.push(page); });
	const doc = new FakeDocument();
	const navigation = new ReaderNavigation({ renderThumbnail: vi.fn(async () => undefined) } as never, 10, () => options.page ?? 1, goTo, 'outline', undefined, options.style ?? 'tree');
	navigation.setOutline(options.outline ?? flatNumbered, 'ready');
	const container = new FakeElement('div', doc);
	navigation.render(container as unknown as HTMLElement);
	return { navigation, container, doc, goTo, jumps, tree: outlineOf(container) };
}

describe('ReaderNavigation outline rendering', () => {
	it('preserves the selected sidebar tab across Reader page renders', () => {
		const navigation = new ReaderNavigation({} as never, 3, () => 1, async () => undefined, 'thumbnails');
		expect(navigation.getMode()).toBe('thumbnails');
	});

	it('renders a WAI-ARIA tree with expansion only on parents and full Chinese names', () => {
		const { tree } = renderNavigation();
		expect(tree.getAttribute('role')).toBe('tree');
		expect(tree.getAttribute('aria-label')).toBe('PDF 目录');
		const nodes = items(tree);
		expect(nodes.map(node => node.getAttribute('aria-label'))).toEqual(['1 Parent，第 1 页', '1.1 Child，第 3 页', '2 Sibling，第 5 页']);
		expect(nodes.map(node => node.getAttribute('title'))).toEqual(['1 Parent，第 1 页', '1.1 Child，第 3 页', '2 Sibling，第 5 页']);
		expect(nodes[0].getAttribute('aria-expanded')).toBe('true');
		expect(nodes[1].getAttribute('aria-expanded')).toBeNull();
		expect(nodes[2].getAttribute('aria-expanded')).toBeNull();
		expect(nodes.map(node => node.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
		expect(nodes.map(node => node.getAttribute('data-nav-page'))).toEqual(['0', '2', '4']);
		expect(nodes[1].getAttribute('data-outline-key')).toContain('1.1 Child');
	});

	it('nests inferred children inside a role=group under their parent', () => {
		const { tree } = renderNavigation();
		const parent = itemByTitle(tree, '1 Parent');
		const group = parent.children.find(child => child.getAttribute('role') === 'group');
		expect(group).toBeTruthy();
		expect(items(group as FakeElement).map(node => node.getAttribute('aria-label'))).toEqual(['1.1 Child，第 3 页']);
	});

	it('keeps page numbers at the row tail beside an ellipsizing title', () => {
		const { tree } = renderNavigation();
		const row = rowOf(itemByTitle(tree, '1 Parent'));
		expect(row.className).toBe('rd-outline-row');
		expect(row.children.map(child => child.className)).toEqual(['rd-outline-gutter', 'rd-outline-title', 'rd-reader-outline__page']);
		expect(row.children[2].text).toBe('p.1');
		expect(row.children[1].text).toBe('1 Parent');
	});

	it('renders the bullet style without fold controls and keeps parents expanded', () => {
		const { tree } = renderNavigation({ style: 'bullet' });
		expect(tree.className).toContain('rd-reader-outline--bullet');
		const parent = itemByTitle(tree, '1 Parent');
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		expect(gutterOf(parent).listenerCount('click')).toBe(0);
	});
});

describe('ReaderNavigation folding and current section', () => {
	it('folds with the chevron without swallowing the page jump', () => {
		const { tree, goTo, jumps } = renderNavigation();
		const parent = itemByTitle(tree, '1 Parent');
		gutterOf(parent).click();
		expect(goTo).not.toHaveBeenCalled();
		expect(jumps).toEqual([]);
		expect(parent.getAttribute('aria-expanded')).toBe('false');
		expect(parent.children.find(child => child.getAttribute('role') === 'group')?.hidden).toBe(true);
		rowOf(parent).click();
		expect(goTo).toHaveBeenCalledWith(1);
		expect(jumps).toEqual([1]);
	});

	it('re-expands the current section ancestors and keeps the marker visible', () => {
		const { navigation, tree } = renderNavigation({ page: 3 });
		const parent = itemByTitle(tree, '1 Parent');
		const child = itemByTitle(tree, '1.1 Child');
		gutterOf(parent).click();
		expect(parent.getAttribute('aria-expanded')).toBe('false');
		navigation.revealPage(3);
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		expect(parent.children.find(child => child.getAttribute('role') === 'group')?.hidden).toBe(false);
		expect(child.getAttribute('aria-current')).toBe('location');
		expect(child.scrollCount).toBeGreaterThan(0);
	});

	it('switches outline style in place and keeps fold state across the re-render', () => {
		const { navigation, container, tree } = renderNavigation();
		gutterOf(itemByTitle(tree, '1 Parent')).click();
		navigation.setOutlineStyle('bullet');
		expect(outlineOf(container).className).toContain('rd-reader-outline--bullet');
		navigation.setOutlineStyle('tree');
		const back = outlineOf(container);
		expect(itemByTitle(back, '1 Parent').getAttribute('aria-expanded')).toBe('false');
		expect(items(back).map(node => node.getAttribute('aria-label'))).toEqual(['1 Parent，第 1 页', '1.1 Child，第 3 页', '2 Sibling，第 5 页']);
	});
});

describe('ReaderNavigation keyboard contract', () => {
	it('moves the roving tab stop with arrows, Home and End', () => {
		const { tree } = renderNavigation();
		press(tree, 'ArrowDown');
		expect(items(tree).map(node => node.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
		expect(itemByTitle(tree, '1.1 Child').focused).toBe(true);
		press(tree, 'ArrowUp');
		expect(items(tree).map(node => node.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
		press(tree, 'End');
		expect(itemByTitle(tree, '2 Sibling').getAttribute('tabindex')).toBe('0');
		press(tree, 'Home');
		expect(itemByTitle(tree, '1 Parent').getAttribute('tabindex')).toBe('0');
	});

	it('expands and folds with Right, Left and Space, and skips folded rows', () => {
		const { tree } = renderNavigation();
		const parent = itemByTitle(tree, '1 Parent');
		press(tree, ' ');
		expect(parent.getAttribute('aria-expanded')).toBe('false');
		expect(press(tree, 'ArrowDown').defaultPrevented).toBe(true);
		expect(itemByTitle(tree, '2 Sibling').getAttribute('tabindex')).toBe('0');
		press(tree, 'Home');
		press(tree, 'ArrowRight');
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		press(tree, 'ArrowRight');
		expect(itemByTitle(tree, '1.1 Child').getAttribute('tabindex')).toBe('0');
		press(tree, 'ArrowLeft');
		expect(itemByTitle(tree, '1 Parent').getAttribute('tabindex')).toBe('0');
		press(tree, 'ArrowLeft');
		expect(parent.getAttribute('aria-expanded')).toBe('false');
	});

	it('jumps to the focused chapter on Enter and never folds in bullet style', () => {
		const { tree, goTo } = renderNavigation({ style: 'bullet' });
		press(tree, 'ArrowDown');
		press(tree, 'Enter');
		expect(goTo).toHaveBeenCalledWith(3);
		const event = press(tree, ' ');
		expect(event.defaultPrevented).toBe(false);
		expect(itemByTitle(tree, '1 Parent').getAttribute('aria-expanded')).toBe('true');
		press(tree, 'Home');
		press(tree, 'ArrowLeft');
		expect(itemByTitle(tree, '1 Parent').getAttribute('tabindex')).toBe('0');
	});

	it('supports typeahead without stealing modifier shortcuts', () => {
		const { tree } = renderNavigation();
		press(tree, '2');
		expect(itemByTitle(tree, '2 Sibling').getAttribute('tabindex')).toBe('0');
		const modified = new FakeEvent('keydown', { key: 'p' });
		modified.ctrlKey = true;
		itemByTitle(tree, '2 Sibling').dispatchEvent(modified);
		expect(modified.defaultPrevented).toBe(false);
	});
});

describe('P1 regression: row clicks must not bubble into ancestor jumps', () => {
	it('clicking a second-level row navigates exactly once', () => {
		const { tree, jumps } = renderNavigation({ outline: deepNumbered });
		const branch = itemByTitle(tree, '1.1 Branch');
		titleOf(branch).click();
		expect(jumps).toEqual([3]);
		jumps.length = 0;
		pageOf(branch).click();
		expect(jumps).toEqual([3]);
		jumps.length = 0;
		rowOf(branch).click();
		expect(jumps).toEqual([3]);
	});

	it('a child click lands on the child page, not the parent page', () => {
		const { tree, jumps } = renderNavigation({ outline: deepNumbered });
		titleOf(itemByTitle(tree, '1.1 Branch')).click();
		expect(jumps).toHaveLength(1);
		expect(jumps[0]).toBe(3);
		expect(jumps).not.toContain(1);
	});

	it('a three-level click never triggers an ancestor jump', () => {
		const { tree, jumps } = renderNavigation({ outline: deepNumbered });
		titleOf(itemByTitle(tree, '1.1.1 Leaf')).click();
		expect(jumps).toEqual([6]);
		expect(jumps).not.toContain(1);
		expect(jumps).not.toContain(3);
	});

	it('clicking the parent row itself still navigates', () => {
		const { tree, jumps } = renderNavigation({ outline: deepNumbered });
		rowOf(itemByTitle(tree, '1 Root')).click();
		expect(jumps).toEqual([1]);
	});

	it('the chevron only toggles expansion and never navigates', () => {
		const { tree, jumps } = renderNavigation({ outline: deepNumbered });
		const root = itemByTitle(tree, '1 Root');
		gutterOf(root).click();
		expect(jumps).toEqual([]);
		expect(root.getAttribute('aria-expanded')).toBe('false');
		expect(root.children.find(child => child.getAttribute('role') === 'group')?.hidden).toBe(true);
	});

	it('clicking a child row moves the roving tab stop to that child', () => {
		const { tree } = renderNavigation({ outline: deepNumbered });
		const branch = itemByTitle(tree, '1.1 Branch');
		titleOf(branch).click();
		expect(tabStops(tree)).toEqual(['1.1 Branch，第 3 页']);
		expect(itemByTitle(tree, '1 Root').getAttribute('tabindex')).toBe('-1');
	});

	it('clicking the bullet marker column still jumps to the row page', () => {
		const { tree, jumps } = renderNavigation({ style: 'bullet' });
		gutterOf(itemByTitle(tree, '1 Parent')).click();
		expect(jumps).toEqual([1]);
	});

	it('clicking a leaf gutter in tree style still jumps to the leaf page', () => {
		const { tree, jumps } = renderNavigation();
		gutterOf(itemByTitle(tree, '1.1 Child')).click();
		expect(jumps).toEqual([3]);
	});
});

describe('P1 regression: folding must lift focus out of the hidden subtree', () => {
	it('folding an ancestor moves the tab stop to the folded parent and keeps keys alive', () => {
		const { tree } = renderNavigation();
		const parent = itemByTitle(tree, '1 Parent');
		const child = itemByTitle(tree, '1.1 Child');
		press(tree, 'ArrowRight');
		expect(tabStops(tree)).toEqual(['1.1 Child，第 3 页']);
		gutterOf(parent).click();
		expect(parent.getAttribute('aria-expanded')).toBe('false');
		expect(tabStops(tree)).toEqual(['1 Parent，第 1 页']);
		expect(child.getAttribute('tabindex')).toBe('-1');
		expect(parent.children.find(node => node.getAttribute('role') === 'group')?.hidden).toBe(true);
		expect(press(tree, 'ArrowDown').defaultPrevented).toBe(true);
		expect(tabStops(tree)).toEqual(['2 Sibling，第 5 页']);
	});

	it('folding an unrelated branch leaves the tab stop alone', () => {
		const { tree } = renderNavigation();
		press(tree, 'End');
		expect(tabStops(tree)).toEqual(['2 Sibling，第 5 页']);
		gutterOf(itemByTitle(tree, '1 Parent')).click();
		expect(tabStops(tree)).toEqual(['2 Sibling，第 5 页']);
	});

	it('keyboard folding keeps the tab stop on the focused parent', () => {
		const { tree } = renderNavigation();
		expect(tabStops(tree)).toEqual(['1 Parent，第 1 页']);
		press(tree, ' ');
		expect(tabStops(tree)).toEqual(['1 Parent，第 1 页']);
	});

	it('the tree keeps exactly one visible tab stop after a fold', () => {
		const { tree } = renderNavigation();
		press(tree, 'ArrowRight');
		gutterOf(itemByTitle(tree, '1 Parent')).click();
		const stops = items(tree).filter(element => element.getAttribute('tabindex') === '0');
		expect(stops).toHaveLength(1);
		expect(isVisible(stops[0])).toBe(true);
		expect(visibleItems(tree).filter(element => element.getAttribute('tabindex') === '0')).toHaveLength(1);
	});

	it('folding moves DOM focus out of the hidden subtree', () => {
		const { tree, doc } = renderNavigation();
		const parent = itemByTitle(tree, '1 Parent');
		const child = itemByTitle(tree, '1.1 Child');
		press(tree, 'ArrowRight');
		child.focus();
		expect(doc.activeElement).toBe(child);
		gutterOf(parent).click();
		expect(doc.activeElement).toBe(parent);
		expect(parent.focused).toBe(true);
	});

	it('expanding a node never moves the tab stop', () => {
		const { tree } = renderNavigation();
		const parent = itemByTitle(tree, '1 Parent');
		press(tree, 'End');
		gutterOf(parent).click();
		gutterOf(parent).click();
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		expect(tabStops(tree)).toEqual(['2 Sibling，第 5 页']);
	});

	it('revealPage re-expands the current path and keeps keyboard state valid', () => {
		const { navigation, tree } = renderNavigation({ page: 3 });
		const parent = itemByTitle(tree, '1 Parent');
		const child = itemByTitle(tree, '1.1 Child');
		gutterOf(parent).click();
		navigation.revealPage(3);
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		expect(child.getAttribute('aria-current')).toBe('location');
		expect(child.scrollCount).toBeGreaterThan(0);
		const stops = visibleItems(tree).filter(element => element.getAttribute('tabindex') === '0');
		expect(stops).toHaveLength(1);
		expect(press(tree, 'ArrowDown').defaultPrevented).toBe(true);
		expect(visibleItems(tree).some(element => element.getAttribute('tabindex') === '0')).toBe(true);
	});

	it('bullet outlines stay expanded and keep the tab stop on Space', () => {
		const { tree, jumps } = renderNavigation({ style: 'bullet' });
		expect(tabStops(tree)).toEqual(['1 Parent，第 1 页']);
		press(tree, ' ');
		expect(itemByTitle(tree, '1 Parent').getAttribute('aria-expanded')).toBe('true');
		expect(tabStops(tree)).toEqual(['1 Parent，第 1 页']);
		expect(jumps).toEqual([]);
	});
});

describe('P1 regression: clicks must take real DOM focus', () => {
	it('clicking title, page or row whitespace focuses the treeitem', () => {
		const { tree, doc } = renderNavigation({ outline: deepNumbered });
		const branch = itemByTitle(tree, '1.1 Branch');
		titleOf(branch).click();
		expect(doc.activeElement).toBe(branch);
		pageOf(branch).click();
		expect(doc.activeElement).toBe(branch);
		const leaf = itemByTitle(tree, '1.1.1 Leaf');
		rowOf(leaf).click();
		expect(doc.activeElement).toBe(leaf);
	});

	it('ArrowDown right after a click moves from the clicked node', () => {
		const { tree, doc } = renderNavigation({ outline: deepNumbered });
		titleOf(itemByTitle(tree, '1.1 Branch')).click();
		expect(doc.activeElement).toBe(itemByTitle(tree, '1.1 Branch'));
		press(tree, 'ArrowDown');
		expect(tabStops(tree)).toEqual(['1.1.1 Leaf，第 6 页']);
		expect(doc.activeElement).toBe(itemByTitle(tree, '1.1.1 Leaf'));
	});

	it('Enter and Space right after a click are handled by the tree', () => {
		const { tree, doc, jumps } = renderNavigation({ outline: deepNumbered });
		const branch = itemByTitle(tree, '1.1 Branch');
		titleOf(branch).click();
		expect(doc.activeElement).toBe(branch);
		expect(jumps).toEqual([3]);
		jumps.length = 0;
		press(tree, 'Enter');
		expect(jumps).toEqual([3]);
		press(tree, ' ');
		expect(branch.getAttribute('aria-expanded')).toBe('false');
	});

	it('chevron click takes DOM focus when the tree does not hold it', () => {
		const { tree, doc } = renderNavigation({ outline: deepNumbered });
		const root = itemByTitle(tree, '1 Root');
		doc.activeElement = null;
		gutterOf(root).click();
		expect(doc.activeElement).toBe(root);
		expect(root.getAttribute('aria-expanded')).toBe('false');
		expect(tabStops(tree)).toEqual(['1 Root，第 1 页']);
	});

	it('chevron click keeps DOM focus on the already-focused tree item', () => {
		const { tree, doc } = renderNavigation({ outline: deepNumbered });
		const other = itemByTitle(tree, '2 Other');
		press(tree, 'End');
		expect(doc.activeElement).toBe(other);
		gutterOf(itemByTitle(tree, '1 Root')).click();
		expect(doc.activeElement).toBe(other);
		expect(tabStops(tree)).toEqual(['2 Other，第 10 页']);
	});

	it('taking DOM focus on a treeitem moves the roving tab stop to it', () => {
		const { tree, doc } = renderNavigation({ outline: deepNumbered });
		const leaf = itemByTitle(tree, '1.1.1 Leaf');
		leaf.focus();
		expect(doc.activeElement).toBe(leaf);
		expect(tabStops(tree)).toEqual(['1.1.1 Leaf，第 6 页']);
	});
});

describe('P2 regression: focus survives navigation re-render and re-attach', () => {
	it('keeps DOM focus on the same node across a navigation re-render', () => {
		const { navigation, container, doc, tree } = renderNavigation({ outline: deepNumbered });
		const branch = itemByTitle(tree, '1.1 Branch');
		titleOf(branch).click();
		expect(doc.activeElement).toBe(branch);
		navigation.setOutline(deepNumbered, 'ready');
		const after = outlineOf(container);
		expect(doc.activeElement).toBe(itemByTitle(after, '1.1 Branch'));
		expect(tabStops(after)).toEqual(['1.1 Branch，第 3 页']);
	});

	it('keeps DOM focus across a navigation re-attach with a fresh instance', () => {
		const { container, doc, tree, goTo } = renderNavigation({ outline: deepNumbered });
		const branch = itemByTitle(tree, '1.1 Branch');
		titleOf(branch).click();
		expect(doc.activeElement).toBe(branch);
		const rebuilt = new ReaderNavigation({ renderThumbnail: vi.fn(async () => undefined) } as never, 10, () => 1, goTo, 'outline', undefined, 'tree');
		rebuilt.setOutline(deepNumbered, 'ready');
		rebuilt.render(container as unknown as HTMLElement);
		const after = outlineOf(container);
		expect(doc.activeElement).toBe(itemByTitle(after, '1.1 Branch'));
		expect(tabStops(after)).toEqual(['1.1 Branch，第 3 页']);
	});
});
