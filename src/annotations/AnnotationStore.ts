import type { PdfComment, PdfHighlight } from '../types/contracts';
import { createId } from '../utils/ids';

export interface AnnotationPersistence {
	readHighlights(): Record<string, PdfHighlight>;
	readComments(): Record<string, PdfComment[]>;
	readExcerptCards?(): Record<string, unknown>;
	commit(mutator: () => void): Promise<void>;
}

export class AnnotationStore {
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

	async save(highlight: PdfHighlight): Promise<void> {
		await this.persistence.commit(() => {
			this.persistence.readHighlights()[highlight.id] = highlight;
		});
	}

	async recolor(id: string, color: PdfHighlight['color']): Promise<void> {
		await this.persistence.commit(() => {
			const highlight = this.require(id);
			highlight.color = color;
			highlight.updatedAt = Date.now();
		});
	}

	async setTags(id: string, tags: string[]): Promise<void> {
		await this.persistence.commit(() => {
			const highlight = this.require(id);
			highlight.tags = [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
			highlight.updatedAt = Date.now();
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

	async remove(id: string): Promise<void> {
		await this.persistence.commit(() => {
			delete this.persistence.readHighlights()[id];
			delete this.persistence.readComments()[id];
			const cards = this.persistence.readExcerptCards?.();
			if (cards) delete cards[id];
		});
	}

	async removeMissingTargetIds(ids: string[]): Promise<void> {
		for (const id of ids) await this.remove(id);
	}

	private require(id: string): PdfHighlight {
		const highlight = this.get(id);
		if (!highlight) throw new Error(`未找到标注：${id}`);
		return highlight;
	}
}
