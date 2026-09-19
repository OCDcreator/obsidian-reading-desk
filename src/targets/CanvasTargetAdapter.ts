import { createId } from '../utils/ids';
import { READING_DESK_PALETTE } from '../shared/ReadingDeskPalette';
import type { PdfHighlight } from '../types/contracts';
import type { TargetCardMetadata, TargetCardOptions, TargetWriteResult } from './TargetTypes';
import { createCardTitle, createSourceLink, excerptMetadata } from './TargetTypes';

interface CanvasNode {
	id: string;
	type: string;
	text?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	color?: string;
	readingDesk?: TargetCardMetadata;
	[key: string]: unknown;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide?: string;
	toSide?: string;
	readingDesk?: { kind: 'chapter-edge' | 'excerpt-edge' };
	[key: string]: unknown;
}

interface CanvasDocument {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	[key: string]: unknown;
}

/** The flattened, 0-based outline shape returned by PdfRenderer.getOutline(). */
export interface CanvasOutlineEntry {
	title: string;
	page: number;
	path: string[];
}

export interface CanvasOutlineSyncResult {
	chapterNodeIds: string[];
	createdNodeIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCanvas(content: string): CanvasDocument {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new Error('不支持的 Canvas 文件：内容不是有效 JSON。');
	}
	if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
		throw new Error('不支持的 Canvas 文件：缺少 nodes 或 edges 数组。');
	}
	if (!parsed.nodes.every(node => isRecord(node) && typeof node.id === 'string')
		|| !parsed.edges.every(edge => isRecord(edge) && typeof edge.id === 'string')) {
		throw new Error('不支持的 Canvas 文件：nodes/edges 不是 Obsidian Canvas 对象。');
	}
	return parsed as CanvasDocument;
}

function excerptNode(node: CanvasNode): boolean {
	return node.readingDesk?.schemaVersion === 1
		&& node.readingDesk.kind === 'excerpt'
		&& typeof node.readingDesk.highlightId === 'string';
}

function chapterNode(node: CanvasNode): boolean {
	return node.readingDesk?.schemaVersion === 1
		&& node.readingDesk.kind === 'chapter'
		&& Array.isArray(node.readingDesk.chapterPath);
}

function nextY(nodes: CanvasNode[]): number {
	return nodes.reduce((bottom, node) => Math.max(bottom, (node.y ?? 0) + (node.height ?? 120)), 0) + 48;
}

function findChapter(nodes: CanvasNode[], pdfPath: string, chapterPath: string[]): CanvasNode | undefined {
	const key = `${pdfPath}\u001e${chapterPath.join('\u001f')}`;
	return nodes.find(node => chapterNode(node)
		&& `${node.readingDesk?.pdfPath}\u001e${node.readingDesk?.chapterPath?.join('\u001f')}` === key);
}

function hasEdge(edges: CanvasEdge[], fromNode: string, toNode: string): boolean {
	return edges.some(edge => edge.fromNode === fromNode && edge.toNode === toNode);
}

function stableId(prefix: string, value: string): string {
	let left = 0x811c9dc5;
	let right = 0x9e3779b9;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		left = Math.imul(left ^ code, 0x01000193);
		right = Math.imul(right ^ code, 0x85ebca6b);
	}
	return `${prefix}-${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

function chapterIdentity(pdfPath: string, chapterPath: string[]): string {
	return `${pdfPath}\u001e${chapterPath.join('\u001f')}`;
}

function stableChapterNodeId(pdfPath: string, chapterPath: string[]): string {
	return stableId('rd-chapter', chapterIdentity(pdfPath, chapterPath));
}

function stableChapterEdgeId(parentId: string, childId: string): string {
	return stableId('rd-chapter-edge', `${parentId}\u001e${childId}`);
}

function unusedNodeId(document: CanvasDocument, preferred: string): string {
	if (!document.nodes.some(node => node.id === preferred)) return preferred;
	let suffix = 1;
	while (document.nodes.some(node => node.id === `${preferred}-${suffix}`)) suffix += 1;
	return `${preferred}-${suffix}`;
}

function createChapterNode(chapterPath: string[], y: number, folded: boolean, highlight: PdfHighlight, sourceLink: string): CanvasNode {
	const title = chapterPath[chapterPath.length - 1];
	return {
		id: createId('rd-chapter'),
		type: 'text',
		text: `## ${title}`,
		x: (chapterPath.length - 1) * 420,
		y,
		width: 340,
		height: 90,
		readingDesk: {
			schemaVersion: 1,
			kind: 'chapter',
			pdfPath: highlight.pdfPath,
			page: highlight.page,
			title,
			sourceLink,
			folded,
			color: highlight.color,
			chapterPath: [...chapterPath]
		}
	};
}

function createOutlineChapterNode(id: string, pdfPath: string, chapterPath: string[], page: number, y: number): CanvasNode {
	const title = chapterPath[chapterPath.length - 1];
	return {
		id,
		type: 'text',
		text: `## ${title}`,
		x: (chapterPath.length - 1) * 420,
		y,
		width: 340,
		height: 90,
		readingDesk: {
			schemaVersion: 1,
			kind: 'chapter',
			pdfPath,
			page,
			title,
			sourceLink: '',
			folded: false,
			color: 'moss',
			chapterPath: [...chapterPath]
		}
	};
}

function addChapters(document: CanvasDocument, highlight: PdfHighlight, options: TargetCardOptions): CanvasNode | undefined {
	const chapterPath = options.chapterPath ?? highlight.chapterPath;
	const sourceLink = createSourceLink(highlight, options.sourceLink);
	let parent: CanvasNode | undefined;
	let y = nextY(document.nodes);
	for (let index = 0; index < chapterPath.length; index += 1) {
		const path = chapterPath.slice(0, index + 1);
		let chapter = findChapter(document.nodes, highlight.pdfPath, path);
		if (!chapter) {
			chapter = createChapterNode(path, y, options.folded ?? false, highlight, sourceLink);
			document.nodes.push(chapter);
			y += 138;
		}
		if (parent && !hasEdge(document.edges, parent.id, chapter.id)) {
			document.edges.push({
				id: createId('rd-chapter-edge'),
				fromNode: parent.id,
				fromSide: 'bottom',
				toNode: chapter.id,
				toSide: 'top',
				readingDesk: { kind: 'chapter-edge' }
			});
		}
		parent = chapter;
	}
	return parent;
}

const CANVAS_COLORS = Object.fromEntries(
	Object.entries(READING_DESK_PALETTE).map(([color, value]) => [color, value.canvasCode])
) as Record<PdfHighlight['color'], string>;

function excerptText(highlight: PdfHighlight, title: string, sourceLink: string): string {
	return `# ${title}\n\n${highlight.text}\n\n[原文第 ${highlight.page + 1} 页](${sourceLink})`;
}

function textHeight(text: string, width: number): number {
	const charactersPerLine = Math.max(16, Math.floor(width / 8));
	const lineCount = text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
	return Math.max(120, 32 + lineCount * 26);
}

/**
 * Canvas text nodes do not offer a persisted folded state.  For Reading Desk
 * excerpt nodes only, folding is represented by a compact native node height;
 * the complete text and source link stay in the node so an unfold write can
 * restore its calculated text height without reconstructing user content.
 */
function excerptHeight(text: string, width: number, folded: boolean): number {
	return folded ? 72 : textHeight(text, width);
}

interface OutlineChapter {
	path: string[];
	page: number;
}

function normalizedOutline(chapters: readonly CanvasOutlineEntry[]): OutlineChapter[] {
	const byIdentity = new Map<string, OutlineChapter>();
	for (const entry of chapters) {
		if (!Number.isInteger(entry.page) || entry.page < 0 || entry.path.length === 0) continue;
		for (let depth = 1; depth <= entry.path.length; depth += 1) {
			const path = entry.path.slice(0, depth).map(title => title.trim());
			if (path.some(title => !title)) continue;
			const identity = path.join('\u001f');
			const current = byIdentity.get(identity);
			// Parents without their own destination inherit their earliest child's page.
			if (!current || entry.page < current.page) byIdentity.set(identity, { path, page: entry.page });
		}
	}
	return [...byIdentity.values()].sort((left, right) => left.path.length - right.path.length || left.page - right.page || left.path.join('\u001f').localeCompare(right.path.join('\u001f')));
}

/**
 * Materializes every outline branch (including branches with no excerpts) as
 * versioned chapter nodes. Existing user nodes and existing excerpt links are
 * never rewritten or removed.
 */
export function syncCanvasOutline(content: string, pdfPath: string, chapters: readonly CanvasOutlineEntry[]): { content: string; result: CanvasOutlineSyncResult } {
	const document = parseCanvas(content);
	const result: CanvasOutlineSyncResult = { chapterNodeIds: [], createdNodeIds: [] };
	let y = nextY(document.nodes);
	const nodesByIdentity = new Map<string, CanvasNode>();
	for (const node of document.nodes) {
		if (!chapterNode(node) || node.readingDesk?.pdfPath !== pdfPath || !node.readingDesk.chapterPath) continue;
		nodesByIdentity.set(chapterIdentity(pdfPath, node.readingDesk.chapterPath), node);
	}
	for (const chapter of normalizedOutline(chapters)) {
		const identity = chapterIdentity(pdfPath, chapter.path);
		let node = nodesByIdentity.get(identity);
		if (!node) {
			const id = unusedNodeId(document, stableChapterNodeId(pdfPath, chapter.path));
			node = createOutlineChapterNode(id, pdfPath, chapter.path, chapter.page, y);
			document.nodes.push(node);
			nodesByIdentity.set(identity, node);
			result.createdNodeIds.push(node.id);
			y += 138;
		}
		result.chapterNodeIds.push(node.id);
		if (chapter.path.length < 2) continue;
		const parent = nodesByIdentity.get(chapterIdentity(pdfPath, chapter.path.slice(0, -1)));
		if (parent && !hasEdge(document.edges, parent.id, node.id)) {
			document.edges.push({
				id: stableChapterEdgeId(parent.id, node.id),
				fromNode: parent.id,
				fromSide: 'bottom',
				toNode: node.id,
				toSide: 'top',
				readingDesk: { kind: 'chapter-edge' }
			});
		}
	}
	return { content: JSON.stringify(document, null, 2), result };
}

export function writeCanvasExcerpt(
	content: string,
	targetPath: string,
	highlight: PdfHighlight,
	options: TargetCardOptions = {}
): { content: string; result: TargetWriteResult } {
	const document = parseCanvas(content);
	const title = createCardTitle(highlight, options.title);
	const sourceLink = createSourceLink(highlight, options.sourceLink);
	const folded = options.folded ?? false;
	const existing = document.nodes.find(node => excerptNode(node) && node.readingDesk?.highlightId === highlight.id);
	if (existing) {
		existing.text = excerptText(highlight, title, sourceLink);
		existing.height = excerptHeight(existing.text, existing.width ?? 400, folded);
		existing.color = CANVAS_COLORS[highlight.color];
		existing.readingDesk = excerptMetadata(highlight, title, sourceLink, folded, options.chapterPath ?? highlight.chapterPath);
		return {
			content: JSON.stringify(document, null, 2),
			result: { target: { type: 'canvas', path: targetPath, objectId: existing.id }, objectId: existing.id, title, sourceLink }
		};
	}

	const parent = addChapters(document, highlight, options);
	const node: CanvasNode = {
		id: createId('rd-excerpt'),
		type: 'text',
		text: excerptText(highlight, title, sourceLink),
		x: parent ? (parent.x ?? 0) + 420 : 0,
		y: nextY(document.nodes),
		width: 400,
		height: 0,
		color: CANVAS_COLORS[highlight.color],
		readingDesk: excerptMetadata(highlight, title, sourceLink, folded, options.chapterPath ?? highlight.chapterPath)
	};
	node.height = excerptHeight(node.text ?? '', node.width ?? 400, folded);
	document.nodes.push(node);
	if (parent) {
		document.edges.push({
			id: createId('rd-excerpt-edge'),
			fromNode: parent.id,
			fromSide: 'right',
			toNode: node.id,
			toSide: 'left',
			readingDesk: { kind: 'excerpt-edge' }
		});
	}
	return {
		content: JSON.stringify(document, null, 2),
		result: { target: { type: 'canvas', path: targetPath, objectId: node.id }, objectId: node.id, title, sourceLink }
	};
}

export function deleteCanvasExcerpt(content: string, highlightId: string, objectId?: string): string {
	const document = parseCanvas(content);
	const removedIds = new Set(document.nodes
		.filter(node => excerptNode(node) && (node.id === objectId || node.readingDesk?.highlightId === highlightId))
		.map(node => node.id));
	if (removedIds.size === 0) return content;
	document.nodes = document.nodes.filter(node => !removedIds.has(node.id));
	document.edges = document.edges.filter(edge => !removedIds.has(edge.fromNode) && !removedIds.has(edge.toNode));
	return JSON.stringify(document, null, 2);
}

export function canvasExcerptIds(content: string): Set<string> {
	const document = parseCanvas(content);
	return new Set(document.nodes
		.filter(excerptNode)
		.map(node => node.readingDesk?.highlightId)
		.filter((id): id is string => typeof id === 'string'));
}
