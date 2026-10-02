import { createId } from '../utils/ids';
import type { PdfHighlight } from '../types/contracts';
import { decompressLzStringBase64 } from './LzStringBase64';
import type { TargetCardOptions, TargetWriteResult } from './TargetTypes';
import { createCardTitle, createSourceLink } from './TargetTypes';
import { excerptTemplateValues, renderExcerptTemplate } from './ExcerptTemplate';
import { isRecord, requireExcerptIdentity, TargetRepairError, updateManagedText } from './TargetRepair';

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
	const locations: SceneLocation[] = [];
	for (const match of content.matchAll(fence)) {
		const kind = match[1] as 'json' | 'compressed-json';
		let parsed: unknown;
		try {
			const sceneJson = kind === 'json' ? match[2] : decompressLzStringBase64(match[2]);
			parsed = JSON.parse(sceneJson ?? '');
		} catch {
			throw new UnsupportedExcalidrawFormatError('Excalidraw scene JSON 损坏，未写入任何内容。');
		}
		if (!isRecord(parsed) || parsed.type !== 'excalidraw') continue;
		if (!Array.isArray(parsed.elements) || !parsed.elements.every(element => isRecord(element)
			&& typeof element.id === 'string' && typeof element.type === 'string'
			&& (element.isDeleted === undefined || typeof element.isDeleted === 'boolean'))) {
			throw new TargetRepairError('invalid-document', 'Excalidraw elements 数据损坏。');
		}
		const objectIds = new Set<string>();
		const excerptIds = new Set<string>();
		for (const element of parsed.elements) {
			if (objectIds.has(element.id)) throw new TargetRepairError('ambiguous-card', 'Excalidraw 存在重复对象 ID。');
			objectIds.add(element.id);
			const id = highlightIdFor(element as ExcalidrawElement);
			if (id && !element.isDeleted) {
				if (excerptIds.has(id)) throw new TargetRepairError('ambiguous-card', 'Excalidraw 存在重复摘录 ID。');
				excerptIds.add(id);
			}
		}
		locations.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, scene: parsed as unknown as ExcalidrawScene, fenceKind: kind });
	}
	if (locations.length !== 1) throw new UnsupportedExcalidrawFormatError('不支持的 Excalidraw 文件：未找到唯一可解析的 scene，未写入任何内容。');
	return locations[0];
}

function highlightIdFor(element: ExcalidrawElement): string | undefined {
	return requireExcerptIdentity(element.customData?.readingDesk);
}

function excerptText(highlight: PdfHighlight, title: string, sourceLink: string, template?: string): string {
	const body = template
		? renderExcerptTemplate(template, excerptTemplateValues(highlight, title, sourceLink))
		: `${highlight.text}\n原文第 ${highlight.page + 1} 页：${sourceLink}`;
	return `${title}\n${body}`;
}

function createTextElement(highlight: PdfHighlight, title: string, sourceLink: string, folded: boolean, template?: string): ExcalidrawElement {
	const now = Date.now();
	const text = excerptText(highlight, title, sourceLink, template);
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
				folded,
				managedText: text.slice(title.length + 1)
			}
		}
	};
}

function replaceScene(content: string, location: SceneLocation): string {
	// Excalidraw accepts both representations.  A modified compressed scene is
	// deliberately emitted as ordinary JSON because this adapter includes only
	// a decoder; it avoids inventing a non-compatible compressor.
	const replacement = `\`\`\`json\n${JSON.stringify(location.scene, null, 2)}\n\`\`\``;
	return `${content.slice(0, location.start)}${replacement}${content.slice(location.end)}`;
}

export function writeExcalidrawExcerpt(
	content: string,
	targetPath: string,
	highlight: PdfHighlight,
	options: TargetCardOptions = {}
): { content: string; result: TargetWriteResult } {
	const location = sceneLocation(content);
	const existing = location.scene.elements.find(element => highlightIdFor(element) === highlight.id && !element.isDeleted)
		?? location.scene.elements.find(element => highlightIdFor(element) === highlight.id && element.id === highlight.target?.objectId);
	const referenced = location.scene.elements.find(element => element.id === highlight.target?.objectId);
	if (referenced && referenced !== existing) throw new TargetRepairError('metadata-missing', 'Excalidraw 目标对象元数据缺失或变化，请先修复。');
	const old = existing?.customData?.readingDesk;
	const previous = isRecord(old) ? old : undefined;
	const oldText = typeof existing?.text === 'string' ? existing.text : '';
	const title = createCardTitle(highlight, options.title ?? (existing ? oldText.split(/\r?\n/)[0] : undefined));
	const sourceLink = createSourceLink(highlight, options.sourceLink);
	const folded = options.folded ?? (previous?.folded === true);
	const text = excerptText(highlight, title, sourceLink, options.template);
	const body = text.slice(title.length + 1);
	if (existing) {
		const previousBody = typeof previous?.managedText === 'string' ? previous.managedText
			: `${highlight.text}\n原文第 ${Number(previous?.page ?? highlight.page) + 1} 页：${String(previous?.sourceLink ?? sourceLink)}`;
		existing.text = `${title}\n${updateManagedText(oldText.replace(/^[^\r\n]*\r?\n?/, ''), previousBody, body)}`;
		existing.originalText = existing.text;
		existing.link = sourceLink;
		existing.updated = Date.now();
		existing.version = typeof existing.version === 'number' ? existing.version + 1 : 1;
		existing.isDeleted = false;
		existing.customData = {
			...existing.customData,
			readingDesk: {
				...previous,
				schemaVersion: 1, kind: 'excerpt', highlightId: highlight.id, pdfPath: highlight.pdfPath, page: highlight.page,
				title, sourceLink, folded, managedText: body
			}
		};
		return {
			content: replaceScene(content, location),
			result: { target: { type: 'excalidraw', path: targetPath, objectId: existing.id }, objectId: existing.id, title, sourceLink, folded }
		};
	}

	const element = createTextElement(highlight, title, sourceLink, folded, options.template);
	location.scene.elements.push(element);
	return {
		content: replaceScene(content, location),
		result: { target: { type: 'excalidraw', path: targetPath, objectId: element.id }, objectId: element.id, title, sourceLink, folded }
	};
}

export function deleteExcalidrawExcerpt(content: string, highlightId: string, objectId?: string): string {
	const location = sceneLocation(content);
	for (const element of location.scene.elements) {
		if (element.type === 'text' && highlightIdFor(element) === highlightId && (!objectId || element.id === objectId)) {
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

export function excalidrawObjectIds(content: string): Set<string> {
	return new Set(sceneLocation(content).scene.elements.filter(element => !element.isDeleted).map(element => element.id));
}
