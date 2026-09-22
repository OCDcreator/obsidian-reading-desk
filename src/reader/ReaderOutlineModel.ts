import type { PdfOutlineEntry } from './PdfRenderer';
import type { ViewerSettings } from '../types/contracts';

/**
 * Display-only outline model. Everything here derives a Reader navigation tree
 * from the untouched PDF outline entries: the source `path[]` stays the entry
 * identity, nothing is written back to the PDF, and no result is persisted.
 */
export type OutlineStyle = ViewerSettings['outlineStyle'];

/** A display node keeps the source entry untouched; `path` is the PDF outline identity. */
export interface OutlineNode extends PdfOutlineEntry { children: OutlineNode[] }

/** One visible row of the display tree, in document order. */
export interface OutlineRow {
	node: OutlineNode;
	key: string;
	/** 0-based display depth; equals PDF path depth for native trees. */
	depth: number;
	parentKey: string | null;
	hasChildren: boolean;
	expanded: boolean;
}

export type OutlineKeyAction =
	| { kind: 'move'; index: number }
	| { kind: 'toggle'; index: number; expand: boolean }
	| { kind: 'activate' }
	| { kind: 'none' };

/** Stable identity for one outline entry: its untouched source path. */
export function pathKey(path: readonly string[]): string {
	return JSON.stringify(path);
}

export function outlineKey(entry: { path: readonly string[] }): string {
	return pathKey(entry.path);
}

/** `1`, `1.1`, `1.1.1`, `2024.1` … only when a separator or the title end follows. */
const NUMBER_PREFIX = /^([0-9]+(?:[.．][0-9]+)*)(?=$|[ .．、，。：:；;）)])/;
const CHINESE_CHAPTER = /^第 *[0-9一二三四五六七八九十百千两]+ *[篇章]/;
const CHINESE_SECTION = /^第 *[0-9一二三四五六七八九十百千两]+ *节/;

/** Rebuilds the hierarchy a PDF already declares through nested `path[]` values. */
export function buildOutlineTree(entries: readonly PdfOutlineEntry[]): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const nodes = new Map<string, OutlineNode>();
	for (const entry of entries) {
		for (let depth = 1; depth <= entry.path.length; depth += 1) {
			const path = entry.path.slice(0, depth);
			const key = pathKey(path);
			const existing = nodes.get(key);
			if (existing) {
				if (depth === entry.path.length) existing.page = entry.page;
				continue;
			}
			const node: OutlineNode = { title: path[path.length - 1], page: entry.page, path, children: [] };
			nodes.set(key, node);
			const parent = nodes.get(pathKey(path.slice(0, -1)));
			(parent?.children ?? roots).push(node);
		}
	}
	return roots;
}

/**
 * Reader display tree. Native PDF nesting always wins and is never re-inferred;
 * conservative numbering/Chinese-structure inference runs only when the whole
 * outline is single-level, and it only places nodes that already exist.
 */
export function buildDisplayTree(entries: readonly PdfOutlineEntry[]): OutlineNode[] {
	if (entries.some(entry => entry.path.length > 1)) return buildOutlineTree(entries);
	return inferFlatTree(entries);
}

function inferFlatTree(entries: readonly PdfOutlineEntry[]): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const byNumber = new Map<string, OutlineNode>();
	let chapter: OutlineNode | null = null;
	for (const entry of entries) {
		const node: OutlineNode = { title: entry.title, page: entry.page, path: [...entry.path], children: [] };
		const number = entry.title.match(NUMBER_PREFIX)?.[1] ?? null;
		if (number !== null) {
			const parentNumber = parentNumberOf(number);
			const parent = parentNumber === null ? null : byNumber.get(parentNumber) ?? null;
			if (parent) parent.children.push(node);
			else roots.push(node);
			byNumber.set(number, node);
			chapter = null;
			continue;
		}
		if (CHINESE_CHAPTER.test(entry.title)) {
			roots.push(node);
			chapter = node;
			continue;
		}
		if (chapter !== null && CHINESE_SECTION.test(entry.title)) {
			chapter.children.push(node);
			continue;
		}
		roots.push(node);
		chapter = null;
	}
	return roots;
}

function parentNumberOf(number: string): string | null {
	const cut = number.lastIndexOf('.');
	return cut === -1 ? null : number.slice(0, cut);
}

/**
 * Current outline entry for a 0-based page. The selection rule is unchanged
 * (greatest page at or before the page, then the deepest entry); only the depth
 * now comes from the display tree, so inferred children outrank same-page parents.
 */
export function activeOutlinePath(entries: readonly PdfOutlineEntry[], currentPage: number): string[] {
	const depths = new Map<string, number>();
	collectDepths(buildDisplayTree(entries), 1, depths);
	let selected: PdfOutlineEntry | undefined;
	let selectedDepth = 1;
	for (const entry of entries) {
		if (entry.page > currentPage) continue;
		const depth = depths.get(outlineKey(entry)) ?? entry.path.length;
		if (!selected || entry.page > selected.page || (entry.page === selected.page && depth > selectedDepth)) {
			selected = entry;
			selectedDepth = depth;
		}
	}
	return selected ? [...selected.path] : [];
}

function collectDepths(nodes: readonly OutlineNode[], depth: number, into: Map<string, number>): void {
	for (const node of nodes) {
		into.set(outlineKey(node), depth);
		collectDepths(node.children, depth + 1, into);
	}
}

/** Chapter attribution for excerpts; semantics stay identical to the ReaderView original. */
export function chapterPathForPage(entries: readonly PdfOutlineEntry[], page: number): string[] {
	const candidates = entries.filter(entry => entry.page <= page).sort((left, right) => right.page - left.page || right.path.length - left.path.length);
	const winner = candidates[0];
	return winner ? [...winner.path] : [];
}

/** Visible rows in document order; collapsed subtrees are excluded entirely. */
export function outlineRows(tree: readonly OutlineNode[], collapsed: ReadonlySet<string> = new Set()): OutlineRow[] {
	const rows: OutlineRow[] = [];
	const visit = (nodes: readonly OutlineNode[], depth: number, parentKey: string | null): void => {
		for (const node of nodes) {
			const key = outlineKey(node);
			const hasChildren = node.children.length > 0;
			const expanded = hasChildren && !collapsed.has(key);
			rows.push({ node, key, depth, parentKey, hasChildren, expanded });
			if (expanded) visit(node.children, depth + 1, key);
		}
	};
	visit(tree, 0, null);
	return rows;
}

/** Keys of the ancestors of `key`, outermost first; empty when the key is unknown. */
export function ancestorKeys(rows: readonly OutlineRow[], key: string): string[] {
	const parents = new Map(rows.map(row => [row.key, row.parentKey] as const));
	const chain: string[] = [];
	let cursor = parents.get(key) ?? null;
	while (cursor !== null) {
		chain.unshift(cursor);
		cursor = parents.get(cursor) ?? null;
	}
	return chain;
}

/** WAI-ARIA tree keyboard contract; bullet outlines only move focus, never fold. */
export function resolveOutlineKey(key: string, rows: readonly OutlineRow[], index: number, style: OutlineStyle): OutlineKeyAction {
	const row = rows[index];
	if (!row || rows.length === 0) return { kind: 'none' };
	switch (key) {
		case 'ArrowDown': return { kind: 'move', index: Math.min(index + 1, rows.length - 1) };
		case 'ArrowUp': return { kind: 'move', index: Math.max(index - 1, 0) };
		case 'Home': return { kind: 'move', index: 0 };
		case 'End': return { kind: 'move', index: rows.length - 1 };
		case 'Enter': return { kind: 'activate' };
		case 'ArrowRight':
			if (!row.hasChildren) return { kind: 'none' };
			return row.expanded ? { kind: 'move', index: Math.min(index + 1, rows.length - 1) } : { kind: 'toggle', index, expand: true };
		case 'ArrowLeft': {
			if (style === 'tree' && row.hasChildren && row.expanded) return { kind: 'toggle', index, expand: false };
			const parentIndex = rows.findIndex(candidate => candidate.key === row.parentKey);
			return parentIndex === -1 ? { kind: 'none' } : { kind: 'move', index: parentIndex };
		}
		case ' ':
		case 'Spacebar':
			if (style !== 'tree' || !row.hasChildren) return { kind: 'none' };
			return { kind: 'toggle', index, expand: !row.expanded };
		default: return { kind: 'none' };
	}
}

/** Typeahead: next visible row whose title starts with `prefix`, wrapping past the end. */
export function matchTypeahead(rows: readonly OutlineRow[], prefix: string, fromIndex: number): number | null {
	if (!prefix || rows.length === 0) return null;
	const needle = prefix.toLocaleLowerCase();
	for (let step = 1; step <= rows.length; step += 1) {
		const index = (fromIndex + step) % rows.length;
		if (rows[index].node.title.toLocaleLowerCase().startsWith(needle)) return index;
	}
	return null;
}
