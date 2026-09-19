import { createId } from '../utils/ids';
import type { PdfHighlight } from '../types/contracts';
import { decompressLzStringBase64 } from './LzStringBase64';
import type { TargetCardOptions, TargetWriteResult } from './TargetTypes';
import { createCardTitle, createSourceLink } from './TargetTypes';

interface ExcalidrawElement {
	id: string;
	type: string;
	isDeleted?: boolean;
	customData?: Record<string, unknown>;
	[key: string]: unknown;
}

interface ExcalidrawScene {
	type: 'excalidraw';
	elements: ExcalidrawElement[];
	[key: string]: unknown;
}

interface SceneLocation {
	start: number;
	end: number;
	scene: ExcalidrawScene;
	fenceKind: 'json' | 'compressed-json';
}

export class UnsupportedExcalidrawFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedExcalidrawFormatError';
	}
}

function sceneLocation(content: string): SceneLocation {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	if (!frontmatter || !/^excalidraw-plugin\s*:/m.test(frontmatter[1])) {
		throw new UnsupportedExcalidrawFormatError('不支持的 Excalidraw 文件：缺少 excalidraw-plugin frontmatter，未写入任何内容。');
	}
	const fence = /```(json|compressed-json)\s*\r?\n([\s\S]*?)\r?\n```/g;
	for (const match of content.matchAll(fence)) {
		try {
			const kind = match[1] as 'json' | 'compressed-json';
			const sceneJson = kind === 'json' ? match[2] : decompressLzStringBase64(match[2]);
			if (!sceneJson) continue;
			const parsed: unknown = JSON.parse(sceneJson);
			if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
				&& (parsed as { type?: unknown }).type === 'excalidraw'
				&& Array.isArray((parsed as { elements?: unknown }).elements)) {
				return {
					start: match.index ?? 0,
					end: (match.index ?? 0) + match[0].length,
					scene: parsed as ExcalidrawScene,
					fenceKind: kind
				};
			}
		} catch {
			continue;
		}
	}
	throw new UnsupportedExcalidrawFormatError('不支持的 Excalidraw 文件：未找到可解析的 JSON 或 compressed-json scene fenced block，未写入任何内容。');
}

function highlightIdFor(element: ExcalidrawElement): string | undefined {
	const readingDesk = element.customData?.readingDesk;
	if (typeof readingDesk !== 'object' || readingDesk === null) return undefined;
	if ((readingDesk as { schemaVersion?: unknown }).schemaVersion !== 1) return undefined;
	const highlightId = (readingDesk as { highlightId?: unknown }).highlightId;
	return typeof highlightId === 'string' ? highlightId : undefined;
}

function excerptText(highlight: PdfHighlight, title: string, sourceLink: string): string {
	return `${title}\n${highlight.text}\n原文第 ${highlight.page + 1} 页：${sourceLink}`;
}

function createTextElement(highlight: PdfHighlight, title: string, sourceLink: string, folded: boolean): ExcalidrawElement {
	const now = Date.now();
	const text = excerptText(highlight, title, sourceLink);
	return {
		id: createId('rd-excalidraw'),
		type: 'text',
		x: 0,
		y: 0,
		width: Math.max(220, Math.min(680, text.length * 7)),
		height: 72,
		angle: 0,
		strokeColor: '#1e1e1e',
		backgroundColor: 'transparent',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
		roughness: 1,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		seed: Math.floor(Math.random() * 2147483647),
		version: 1,
		versionNonce: Math.floor(Math.random() * 2147483647),
		isDeleted: false,
		boundElements: null,
		updated: now,
		link: sourceLink,
		locked: false,
		text,
		fontSize: 18,
		fontFamily: 1,
		textAlign: 'left',
		verticalAlign: 'top',
		containerId: null,
		originalText: text,
		autoResize: true,
		lineHeight: 1.25,
		customData: {
			readingDesk: {
				schemaVersion: 1,
				kind: 'excerpt',
				highlightId: highlight.id,
				pdfPath: highlight.pdfPath,
				page: highlight.page,
				title,
				sourceLink,
				folded
			}
		}
	};
}

function replaceScene(content: string, location: SceneLocation): string {
	// Excalidraw accepts both representations.  A modified compressed scene is
	// deliberately emitted as ordinary JSON because this adapter includes only
	// a decoder; it avoids inventing a non-compatible compressor.
	const replacement = `\`\`\`json\n${JSON.stringify(location.scene, null, 2)}\n\`\`\``;
	const rewritten = `${content.slice(0, location.start)}${replacement}${content.slice(location.end)}`;
	return hasOfficialDrawingEnvelope(rewritten) ? rewritten : officialDrawingDocument(location.scene);
}

function hasOfficialDrawingEnvelope(content: string): boolean {
	return /^---\r?\n[\s\S]*?excalidraw-plugin\s*:[\s\S]*?\r?\n---/m.test(content)
		&& /^# Excalidraw Data\s*$/m.test(content)
		&& /^## Drawing\s*$/m.test(content)
		&& /\n%%\s*$/.test(content);
}

function officialDrawingDocument(scene: ExcalidrawScene): string {
	return `---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n# Excalidraw Data\n\n## Text Elements\n%%\n## Drawing\n\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\`\n%%\n`;
}

export function writeExcalidrawExcerpt(
	content: string,
	targetPath: string,
	highlight: PdfHighlight,
	options: TargetCardOptions = {}
): { content: string; result: TargetWriteResult } {
	const location = sceneLocation(content);
	const title = createCardTitle(highlight, options.title);
	const sourceLink = createSourceLink(highlight, options.sourceLink);
	const existing = location.scene.elements.find(element => highlightIdFor(element) === highlight.id && !element.isDeleted);
	if (existing) {
		const text = excerptText(highlight, title, sourceLink);
		existing.text = text;
		existing.originalText = text;
		existing.link = sourceLink;
		existing.updated = Date.now();
		existing.version = typeof existing.version === 'number' ? existing.version + 1 : 1;
		existing.isDeleted = false;
		existing.customData = {
			...existing.customData,
			readingDesk: {
				schemaVersion: 1, kind: 'excerpt', highlightId: highlight.id, pdfPath: highlight.pdfPath, page: highlight.page,
				title, sourceLink, folded: options.folded ?? false
			}
		};
		return {
			content: replaceScene(content, location),
			result: { target: { type: 'excalidraw', path: targetPath, objectId: existing.id }, objectId: existing.id, title, sourceLink }
		};
	}
	const element = createTextElement(highlight, title, sourceLink, options.folded ?? false);
	location.scene.elements.push(element);
	return {
		content: replaceScene(content, location),
		result: { target: { type: 'excalidraw', path: targetPath, objectId: element.id }, objectId: element.id, title, sourceLink }
	};
}

export function deleteExcalidrawExcerpt(content: string, highlightId: string, objectId?: string): string {
	const location = sceneLocation(content);
	for (const element of location.scene.elements) {
		if (element.type === 'text' && (element.id === objectId || highlightIdFor(element) === highlightId)) {
			element.isDeleted = true;
		}
	}
	return replaceScene(content, location);
}

export function excalidrawExcerptIds(content: string): Set<string> {
	const location = sceneLocation(content);
	return new Set(location.scene.elements
		.filter(element => element.type === 'text' && !element.isDeleted)
		.map(highlightIdFor)
		.filter((id): id is string => typeof id === 'string'));
}
