import { AnnotationStore } from '../annotations/AnnotationStore';
import type { AnnotationTarget, PdfHighlight } from '../types/contracts';
import { canvasExcerptIds, deleteCanvasExcerpt, syncCanvasOutline, writeCanvasExcerpt, type CanvasOutlineEntry, type CanvasOutlineSyncResult } from './CanvasTargetAdapter';
import { excalidrawExcerptIds, deleteExcalidrawExcerpt, writeExcalidrawExcerpt } from './ExcalidrawTargetAdapter';
import type { FileGateway } from './FileGateway';
import { deleteMarkdownExcerpt, markdownExcerptIds, writeMarkdownExcerpt } from './MarkdownTargetAdapter';
import type { TargetCardOptions, TargetWriteResult } from './TargetTypes';

/**
 * Serializes each target path independently.  The gateway is deliberately
 * injected so this domain service has no dependency on Obsidian's Vault API.
 */
export class TargetService {
	private static readonly pathWrites = new Map<string, Promise<void>>();

	constructor(private readonly files: FileGateway) { }

	async writeExcerpt(target: AnnotationTarget, highlight: PdfHighlight, options: TargetCardOptions = {}): Promise<TargetWriteResult> {
		return this.serial(target.path, async () => {
			let result: TargetWriteResult | undefined;
			await this.files.atomicTransform(target.path, content => {
				const written = target.type === 'canvas'
					? writeCanvasExcerpt(content, target.path, highlight, options)
					: target.type === 'markdown'
						? writeMarkdownExcerpt(content, target.path, highlight, options)
						: writeExcalidrawExcerpt(content, target.path, highlight, options);
				result = written.result;
				return written.content;
			});
			if (!result) throw new Error(`目标写入未返回结果：${target.path}`);
			return result;
		});
	}

	async deleteExcerpt(target: AnnotationTarget, highlightId: string): Promise<void> {
		await this.serial(target.path, async () => {
			await this.files.atomicTransform(target.path, content => target.type === 'canvas'
				? deleteCanvasExcerpt(content, highlightId, target.objectId)
				: target.type === 'markdown'
					? deleteMarkdownExcerpt(content, highlightId)
					: deleteExcalidrawExcerpt(content, highlightId, target.objectId));
		});
	}

	/** Atomically adds all branches from a flattened PDF outline to a Canvas. */
	async syncOutline(targetPath: string, pdfPath: string, chapters: readonly CanvasOutlineEntry[]): Promise<CanvasOutlineSyncResult> {
		return this.serial(targetPath, async () => {
			let result: CanvasOutlineSyncResult | undefined;
			await this.files.atomicTransform(targetPath, content => {
				const synced = syncCanvasOutline(content, pdfPath, chapters);
				result = synced.result;
				return synced.content;
			});
			if (!result) throw new Error(`章节同步未返回结果：${targetPath}`);
			return result;
		});
	}

	/**
	 * Detects target cards that disappeared from a user edit.  Candidates must
	 * come from AnnotationStore's source-of-truth records; a file alone cannot
	 * reveal a card which has already been deleted.
	 */
	async removeMissingTargetHighlights(
		target: AnnotationTarget,
		candidates: readonly PdfHighlight[],
		annotationStore: AnnotationStore
	): Promise<string[]> {
		return this.serial(target.path, async () => {
			let missing: string[] = [];
			await this.files.atomicTransform(target.path, content => {
			const surviving = target.type === 'canvas'
				? canvasExcerptIds(content)
				: target.type === 'markdown'
					? markdownExcerptIds(content)
					: excalidrawExcerptIds(content);
			missing = candidates
				.filter(highlight => highlight.target?.type === target.type && highlight.target.path === target.path)
				.map(highlight => highlight.id)
				.filter(id => !surviving.has(id));
			return content;
			});
			if (missing.length > 0) await annotationStore.removeMissingTargetIds(missing);
			return missing;
		});
	}

	private async serial<T>(path: string, operation: () => Promise<T>): Promise<T> {
		const previous = TargetService.pathWrites.get(path) ?? Promise.resolve();
		let release: (() => void) | undefined;
		const current = new Promise<void>(resolve => { release = resolve; });
		TargetService.pathWrites.set(path, current);
		await previous.catch(() => undefined);
		try {
			return await operation();
		} finally {
			release?.();
			if (TargetService.pathWrites.get(path) === current) TargetService.pathWrites.delete(path);
		}
	}
}
