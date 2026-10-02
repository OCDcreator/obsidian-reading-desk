import type { ExcerptCardState, PdfHighlight } from '../types/contracts';

export type AnnotationTargetWriteCompletion = 'completed' | 'pending' | 'deleted';

function signature(value: unknown): string {
	if (value === undefined) return 'undefined';
	return JSON.stringify(value, (_key: string, item: unknown) => {
		if (item && typeof item === 'object' && !Array.isArray(item)) {
			const object = item as Record<string, unknown>;
			return Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));
		}
		return item;
	});
}

/** A process-local receipt; the replayable highlight itself remains persisted. */
export class AnnotationTargetWrite {
	readonly highlight: PdfHighlight;
	private readonly highlightSignature: string;
	private readonly cardSignature: string;

	constructor(private readonly intent: PdfHighlight, card?: ExcerptCardState) {
		this.highlight = JSON.parse(JSON.stringify(intent)) as PdfHighlight;
		this.highlightSignature = signature(intent);
		this.cardSignature = signature(card);
	}

	/** Identity also rejects a replacement intent with identical payload (ABA). */
	matchesIntent(current: PdfHighlight | undefined): boolean {
		return current === this.intent && signature(current) === this.highlightSignature;
	}

	matchesHighlight(current: PdfHighlight): boolean {
		return signature(current) === this.highlightSignature;
	}

	matchesCard(current: ExcerptCardState | undefined): boolean {
		return signature(current) === this.cardSignature;
	}
}
