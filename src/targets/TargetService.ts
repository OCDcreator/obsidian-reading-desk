import { AnnotationStore } from '../annotations/AnnotationStore';
import { AnnotationTargetWrite } from '../annotations/AnnotationTargetWrite';
import type { AnnotationTarget, PdfHighlight } from '../types/contracts';
import { canvasExcerptIds, canvasObjectIds, deleteCanvasExcerpt, syncCanvasOutline, writeCanvasExcerpt, type CanvasOutlineEntry, type CanvasOutlineSyncResult } from './CanvasTargetAdapter';
import { excalidrawExcerptIds, excalidrawObjectIds, deleteExcalidrawExcerpt, writeExcalidrawExcerpt } from './ExcalidrawTargetAdapter';
import type { FileGateway } from './FileGateway';
import { deleteMarkdownExcerpt, markdownExcerptIds, writeMarkdownExcerpt } from './MarkdownTargetAdapter';
import { createSourceLink, type TargetCardOptions, type TargetWriteResult } from './TargetTypes';
import { TargetRepairError, type TargetRepairDiagnostic, type TargetReconciliationResult, type TargetWriteRecoveryResult } from './TargetRepair';

export interface TargetServiceOptions {
	template?: () => string | undefined;
	onRepair?: (diagnostics: TargetRepairDiagnostic[]) => void;
	onRecovery?: (results: TargetWriteRecoveryResult[]) => void;
}

/** Owns native mutations, format diagnosis and replay; host events stay in main. */
export class TargetService {
	private static readonly pathWrites = new Map<string, Promise<void>>();
	private readonly repairs = new Map<string, TargetRepairDiagnostic[]>();

	constructor(private readonly files: FileGateway, private readonly options: TargetServiceOptions = {}) { }

	async writeExcerpt(target: AnnotationTarget, highlight: PdfHighlight, options: TargetCardOptions = {}): Promise<TargetWriteResult> {
		return this.serial(target.path, () => this.transformExcerpt(target, highlight, options));
	}

	/** Durable intent -> target -> atomic guarded source/card completion and clear. */
	async writeAndSaveExcerpt(target: AnnotationTarget, highlight: PdfHighlight, store: AnnotationStore, options: TargetCardOptions = {}): Promise<TargetWriteResult> {
		const expected = store.captureTargetWriteSource(highlight.id);
		return this.serial(target.path, async () => {
			const staged: PdfHighlight = { ...highlight, target: { ...target }, chapterPath: options.chapterPath ?? highlight.chapterPath };
			const card = { ...(options.title !== undefined ? { title: options.title } : {}), ...(options.folded !== undefined ? { folded: options.folded } : {}) };
			const receipt = await store.stageTargetWrite(staged, Object.keys(card).length ? card : undefined, expected);
			const result = await this.transformExcerpt(target, receipt.highlight, options);
			const completed = await store.completeTargetWrite(receipt, result.target, { title: result.title, folded: result.folded });
			if (completed !== 'completed') throw new Error(completed === 'deleted'
				? '目标写入期间标注已删除，旧写入没有恢复标注。'
				: '目标写入期间标注或写入意图已变化，已保留较新状态，请重试。');
			return result;
		});
	}

	async retryPendingTargetWrites(store: AnnotationStore): Promise<TargetWriteRecoveryResult[]> {
		const results: TargetWriteRecoveryResult[] = [];
		for (const intent of store.listPendingTargetWrites()) {
			try {
				const highlight = store.get(intent.id) ?? intent;
				if (!highlight.target) throw new Error('待写入标注缺少目标。');
				await this.writeAndSaveExcerpt(highlight.target, highlight, store, store.excerptCard(highlight.id));
				results.push({ highlightId: intent.id, status: 'recovered' });
			} catch (error) {
				results.push({ highlightId: intent.id, status: 'pending', message: errorMessage(error) });
			}
		}
		this.notify(() => this.options.onRecovery?.(results));
		return results;
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

	listPendingRepairs(): TargetRepairDiagnostic[] {
		return JSON.parse(JSON.stringify([...this.repairs.values()].flat())) as TargetRepairDiagnostic[];
	}

	reportMissingTarget(path: string, candidates: readonly PdfHighlight[] = []): TargetRepairDiagnostic {
		const diagnostic: TargetRepairDiagnostic = {
			target: { path }, highlightIds: candidates.filter(item => item.target?.path === path).map(item => item.id),
			reason: 'unavailable', message: '目标文件暂缺，已保留标注和评论。文件恢复后可重试核验。'
		};
		this.setRepairs(path, [diagnostic]);
		return diagnostic;
	}

	/** A valid document plus absent identity proves card deletion; damage does not. */
	async reconcileTarget(target: AnnotationTarget, candidates: readonly PdfHighlight[], store: AnnotationStore): Promise<TargetReconciliationResult> {
		return this.serial(target.path, async () => {
			const own = candidates.map(item => store.get(item.id))
				.filter((item): item is PdfHighlight => !!item && item.target?.type === target.type && item.target.path === target.path);
			let missing: string[] = [];
			const observed = new Map<string, AnnotationTargetWrite>();
			let diagnostics: TargetRepairDiagnostic[] = [];
			const inspect = (content: string | undefined): string => {
				if (content === undefined) throw new TargetRepairError('unavailable', '目标文件暂缺，保留标注等待修复。');
				const surviving = target.type === 'canvas' ? canvasExcerptIds(content)
					: target.type === 'markdown' ? markdownExcerptIds(content) : excalidrawExcerptIds(content);
				const objectIds = target.type === 'canvas' ? canvasObjectIds(content)
					: target.type === 'excalidraw' ? excalidrawObjectIds(content) : new Set<string>();
				const pending = new Set(store.listPendingTargetWrites().map(item => item.id));
				for (const previous of own) {
					const candidate = store.get(previous.id);
					if (!candidate || candidate.target?.type !== target.type || candidate.target.path !== target.path) continue;
					if (pending.has(candidate.id) || surviving.has(candidate.id)) continue;
					const objectSurvives = candidate.target?.objectId && objectIds.has(candidate.target.objectId);
					const linkSurvives = target.type === 'markdown' && content.includes(createSourceLink(candidate));
					if (objectSurvives || linkSurvives) {
						diagnostics.push({ target, highlightIds: [candidate.id], reason: 'metadata-missing', message: '目标内容仍在，但摘录元数据缺失或变化，已保留原标注。' });
					} else {
						missing.push(candidate.id);
						observed.set(candidate.id, new AnnotationTargetWrite(candidate, store.excerptCard(candidate.id)));
					}
				}
				return content;
			};
			try {
				if (this.files.read) inspect(await this.files.read(target.path));
				else await this.files.atomicTransform(target.path, inspect);
			} catch (error) {
				missing = [];
				diagnostics = [{ target, highlightIds: own.map(item => item.id), reason: error instanceof TargetRepairError ? error.reason : 'invalid-document', message: errorMessage(error) }];
			}
			this.setRepairs(target.path, diagnostics);
			if (missing.length) missing = await store.removeMissingTargetIds(missing, observed);
			return { removedIds: missing, diagnostics };
		});
	}

	async removeMissingTargetHighlights(target: AnnotationTarget, candidates: readonly PdfHighlight[], store: AnnotationStore): Promise<string[]> {
		return (await this.reconcileTarget(target, candidates, store)).removedIds;
	}

	private async transformExcerpt(target: AnnotationTarget, highlight: PdfHighlight, options: TargetCardOptions): Promise<TargetWriteResult> {
		let result: TargetWriteResult | undefined;
		try {
			if (this.files.read && await this.files.read(target.path) === undefined) {
				throw new TargetRepairError('unavailable', '目标文件暂缺，写入意图已保留；恢复文件后请手动重试。');
			}
			const resolved = { ...options, template: options.template ?? this.options.template?.() };
			const linked = { ...highlight, target };
			await this.files.atomicTransform(target.path, content => {
				const written = target.type === 'canvas' ? writeCanvasExcerpt(content, target.path, linked, resolved)
					: target.type === 'markdown' ? writeMarkdownExcerpt(content, target.path, linked, resolved)
						: writeExcalidrawExcerpt(content, target.path, linked, resolved);
				result = written.result;
				return written.content;
			});
			if (!result) throw new Error(`目标写入未返回结果：${target.path}`);
			this.setRepairs(target.path, []);
			return result;
		} catch (error) {
			this.setRepairs(target.path, [{ target, highlightIds: [highlight.id], reason: error instanceof TargetRepairError ? error.reason : 'invalid-document', message: errorMessage(error) }]);
			throw error;
		}
	}

	private setRepairs(path: string, diagnostics: TargetRepairDiagnostic[]): void {
		if (diagnostics.length) this.repairs.set(path, diagnostics);
		else this.repairs.delete(path);
		this.notify(() => this.options.onRepair?.(this.listPendingRepairs()));
	}

	private notify(callback: () => void): void {
		try { callback(); } catch { /* Host notification failure must not alter a transaction. */ }
	}

	private async serial<T>(path: string, operation: () => Promise<T>): Promise<T> {
		const previous = TargetService.pathWrites.get(path) ?? Promise.resolve();
		let release: (() => void) | undefined;
		const current = new Promise<void>(resolve => { release = resolve; });
		TargetService.pathWrites.set(path, current);
		await previous.catch(() => undefined);
		try { return await operation(); } finally {
			release?.();
			if (TargetService.pathWrites.get(path) === current) TargetService.pathWrites.delete(path);
		}
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
