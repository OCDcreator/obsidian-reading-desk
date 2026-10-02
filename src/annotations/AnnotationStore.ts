import type { AnnotationTarget, DeletedAnnotation, ExcerptCardState, PdfComment, PdfHighlight } from '../types/contracts';
import { createId } from '../utils/ids';
import { AnnotationTargetWrite, type AnnotationTargetWriteCompletion } from './AnnotationTargetWrite';

export interface AnnotationPersistence {
	readHighlights(): Record<string, PdfHighlight>;
	readComments(): Record<string, PdfComment[]>;
	readExcerptCards?(): Record<string, unknown>;
	readDeletedAnnotations?(): Record<string, DeletedAnnotation>;
	readPendingTargetWrites?(): Record<string, PdfHighlight>;
	/** Resolves only after the mutated snapshot is durably saved. */
	commit(mutator: () => void): Promise<void>;
}

function copy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export class AnnotationStore {
	/** Compatibility for old embedders; production supplies the durable port. */
	private readonly deletedFallback: Record<string, DeletedAnnotation> = {};
	/** A failed clear may already have mutated memory; the durable intent remains on disk. */
	private readonly failedTargetWrites = new Set<string>();

	constructor(private readonly persistence: AnnotationPersistence) { }

	list(pdfPath: string): PdfHighlight[] {
		return Object.values(this.persistence.readHighlights())
			.filter(highlight => highlight.pdfPath === pdfPath)
			.sort((left, right) => left.createdAt - right.createdAt);
	}

	listAll(): PdfHighlight[] {
		return Object.values(this.persistence.readHighlights()).sort((left, right) => left.createdAt - right.createdAt);
	}

	get(id: string): PdfHighlight | undefined {
		return this.persistence.readHighlights()[id];
	}

	async save(highlight: PdfHighlight, card?: ExcerptCardState): Promise<void> {
		await this.persistence.commit(() => {
			this.persistence.readHighlights()[highlight.id] = highlight;
			this.refreshPending(highlight);
			const cards = this.persistence.readExcerptCards?.();
			if (cards && card) cards[highlight.id] = { ...this.excerptCard(highlight.id), ...card };
		});
	}

	/** Capture before waiting on any target path lock; null records an absent source. */
	captureTargetWriteSource(id: string): AnnotationTargetWrite | null {
		const current = this.get(id);
		return current ? new AnnotationTargetWrite(current, this.excerptCard(id)) : null;
	}

	/** Persist the source annotation and replayable intent before target I/O. */
	async stageTargetWrite(highlight: PdfHighlight, card?: ExcerptCardState, expected?: AnnotationTargetWrite | null): Promise<AnnotationTargetWrite> {
		if (!highlight.target?.path) throw new Error('目标写入意图缺少目标路径。');
		this.pending();
		const snapshot = copy(highlight);
		const before = expected === undefined ? this.captureTargetWriteSource(highlight.id) : expected;
		let receipt: AnnotationTargetWrite | undefined;
		await this.persistence.commit(() => {
			const current = this.get(snapshot.id);
			if (this.deleted()[snapshot.id]) throw new Error(`标注已删除，请通过恢复入口重试：${snapshot.id}`);
			if (before ? !current || !before.matchesIntent(current) || !before.matchesCard(this.excerptCard(snapshot.id)) : !!current) {
				throw new Error(`标注在写入排队期间已变化，请重试：${snapshot.id}`);
			}
			this.persistence.readHighlights()[snapshot.id] = copy(snapshot);
			const intent = copy(snapshot);
			this.pending()[snapshot.id] = intent;
			const cards = this.persistence.readExcerptCards?.();
			if (cards && card) cards[snapshot.id] = { ...this.excerptCard(snapshot.id), ...card };
			this.failedTargetWrites.delete(snapshot.id);
			receipt = new AnnotationTargetWrite(intent, this.excerptCard(snapshot.id));
		});
		if (!receipt) throw new Error('目标写入意图未保存。');
		return receipt;
	}

	/** Compare and finish in the Repository queue; never replay a stale full highlight. */
	async completeTargetWrite(receipt: AnnotationTargetWrite, target: AnnotationTarget, card?: ExcerptCardState): Promise<AnnotationTargetWriteCompletion> {
		const id = receipt.highlight.id;
		let status: AnnotationTargetWriteCompletion = 'pending';
		let written: PdfHighlight | undefined;
		try {
			await this.persistence.commit(() => {
				const current = this.get(id);
				if (!current || this.deleted()[id]) { status = 'deleted'; return; }
				if (!receipt.matchesIntent(this.pending()[id])) return;
				if (!receipt.matchesHighlight(current) || !receipt.matchesCard(this.excerptCard(id))) {
					this.pending()[id] = copy(current);
					return;
				}
				written = { ...current, target: { ...target } };
				this.persistence.readHighlights()[id] = written;
				const cards = this.persistence.readExcerptCards?.();
				if (cards && card) cards[id] = { ...this.excerptCard(id), ...card };
				delete this.pending()[id];
				this.failedTargetWrites.delete(id);
				status = 'completed';
			});
		} catch (error) {
			// Do not mutate persistence outside its queue. The failed durable clear
			// is exposed locally so retry can stage the current source again.
			if (written && this.get(id) === written && !this.deleted()[id] && !this.pending()[id]) this.failedTargetWrites.add(id);
			throw error;
		}
		return status;
	}

	/** Compatibility API: only clear the intent observed by this invocation. */
	async finishTargetWrite(id: string): Promise<void> {
		const intent = this.pending()[id];
		const current = this.get(id);
		if (!intent || !current) return;
		const receipt = new AnnotationTargetWrite(intent, this.excerptCard(id));
		const source = new AnnotationTargetWrite(current);
		let cleared = false;
		try {
			await this.persistence.commit(() => {
				const live = this.get(id);
				if (!live || this.deleted()[id] || !source.matchesHighlight(live)
					|| !receipt.matchesIntent(this.pending()[id]) || !receipt.matchesCard(this.excerptCard(id))) return;
				delete this.pending()[id];
				cleared = true;
			});
		} catch (error) {
			if (cleared && this.get(id) === current && !this.deleted()[id] && !this.pending()[id]) this.failedTargetWrites.add(id);
			throw error;
		}
	}

	listPendingTargetWrites(): PdfHighlight[] {
		const pending = { ...this.persistence.readPendingTargetWrites?.() };
		for (const id of this.failedTargetWrites) {
			const live = this.get(id);
			if (live && !this.deleted()[id]) pending[id] ??= live;
		}
		return Object.values(pending).map(copy);
	}

	excerptCard(id: string): ExcerptCardState | undefined {
		const card = this.persistence.readExcerptCards?.()[id];
		return card && typeof card === 'object' ? copy(card as ExcerptCardState) : undefined;
	}

	async recolor(id: string, color: PdfHighlight['color']): Promise<void> {
		await this.persistence.commit(() => {
			const highlight = this.require(id);
			highlight.color = color;
			highlight.updatedAt = Date.now();
			this.refreshPending(highlight);
		});
	}

	async setTags(id: string, tags: string[]): Promise<void> {
		await this.persistence.commit(() => {
			const highlight = this.require(id);
			highlight.tags = [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
			highlight.updatedAt = Date.now();
			this.refreshPending(highlight);
		});
	}

	allTags(): string[] {
		return [...new Set(Object.values(this.persistence.readHighlights()).flatMap(highlight => highlight.tags))]
			.sort((left, right) => left.localeCompare(right, 'zh-CN'));
	}

	async addComment(highlightId: string, content: string, source: PdfComment['source'], showTimestamp = source === 'pdf'): Promise<PdfComment> {
		const comment: PdfComment = {
			id: createId('comment'),
			highlightId,
			content: content.trim(),
			createdAt: Date.now(),
			showTimestamp,
			source
		};
		await this.persistence.commit(() => {
			this.require(highlightId);
			const all = this.persistence.readComments();
			all[highlightId] ??= [];
			all[highlightId].push(comment);
		});
		return comment;
	}

	comments(highlightId: string): PdfComment[] {
		return this.persistence.readComments()[highlightId] ?? [];
	}

	async deleteComment(highlightId: string, commentId: string): Promise<void> {
		await this.persistence.commit(() => {
			const all = this.persistence.readComments()[highlightId] ?? [];
			this.persistence.readComments()[highlightId] = all.filter(comment => comment.id !== commentId);
		});
	}

	async remove(id: string, reason: DeletedAnnotation['reason'] = 'user-deleted'): Promise<void> {
		await this.removeIds([id], reason);
	}

	async removeMissingTargetIds(ids: string[], expected?: ReadonlyMap<string, AnnotationTargetWrite>): Promise<string[]> {
		return this.removeIds(ids, 'target-deleted', expected);
	}

	listDeleted(): DeletedAnnotation[] {
		return Object.values(this.deleted()).sort((left, right) => right.deletedAt - left.deletedAt).map(copy);
	}

	/** Restore source data atomically; target restoration is a durable replay. */
	async restoreDeleted(id: string): Promise<PdfHighlight> {
		let restored: PdfHighlight | undefined;
		await this.persistence.commit(() => {
			const record = this.deleted()[id];
			if (!record) throw new Error(`未找到可恢复标注：${id}`);
			if (this.get(id)) throw new Error(`标注已存在，不能覆盖：${id}`);
			if (record.highlight.target) this.pending();
			restored = copy(record.highlight);
			this.persistence.readHighlights()[id] = copy(restored);
			this.persistence.readComments()[id] = copy(record.comments);
			const cards = this.persistence.readExcerptCards?.();
			if (cards) {
				if (record.excerptCard) cards[id] = copy(record.excerptCard);
				else delete cards[id];
			}
			if (restored.target) this.pending()[id] = copy(restored);
			this.failedTargetWrites.delete(id);
			delete this.deleted()[id];
		});
		if (!restored) throw new Error(`标注恢复未提交：${id}`);
		return restored;
	}

	private async removeIds(ids: string[], reason: DeletedAnnotation['reason'], expected?: ReadonlyMap<string, AnnotationTargetWrite>): Promise<string[]> {
		const removed: string[] = [];
		await this.persistence.commit(() => {
			for (const id of new Set(ids)) {
				const highlight = this.get(id);
				if (!highlight) continue;
				const observed = expected?.get(id);
				if (expected && (!observed?.matchesIntent(highlight) || !observed.matchesCard(this.excerptCard(id))
					|| this.persistence.readPendingTargetWrites?.()[id] || this.failedTargetWrites.has(id))) continue;
				removed.push(id);
				this.deleted()[id] = {
					highlight: copy(highlight), comments: copy(this.comments(id)), excerptCard: this.excerptCard(id), deletedAt: Date.now(), reason
				};
				this.failedTargetWrites.delete(id);
				delete this.persistence.readHighlights()[id];
				delete this.persistence.readComments()[id];
				const cards = this.persistence.readExcerptCards?.();
				if (cards) delete cards[id];
				const pending = this.persistence.readPendingTargetWrites?.();
				if (pending) delete pending[id];
			}
		});
		return removed;
	}

	private deleted(): Record<string, DeletedAnnotation> {
		return this.persistence.readDeletedAnnotations?.() ?? this.deletedFallback;
	}

	private pending(): Record<string, PdfHighlight> {
		const pending = this.persistence.readPendingTargetWrites?.();
		if (!pending) throw new Error('标注持久化未接入 readPendingTargetWrites，不能开始可恢复目标写入。');
		return pending;
	}

	private refreshPending(highlight: PdfHighlight): void {
		const pending = this.persistence.readPendingTargetWrites?.();
		if (pending && (pending[highlight.id] || this.failedTargetWrites.has(highlight.id))) pending[highlight.id] = copy(highlight);
	}

	private require(id: string): PdfHighlight {
		const highlight = this.get(id);
		if (!highlight) throw new Error(`未找到标注：${id}`);
		return highlight;
	}
}
