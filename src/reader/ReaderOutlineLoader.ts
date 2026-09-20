import type { PdfOutlineEntry } from './PdfRenderer';

export type OutlineLoadResult = { entries: PdfOutlineEntry[]; error?: undefined } | { entries: []; error: unknown };

/** Serializes async outline ownership so an older PDF can never overwrite the active document. */
export class ReaderOutlineLoader {
	private generation = 0;

	load(task: Promise<PdfOutlineEntry[]>): Promise<OutlineLoadResult | null> {
		const generation = ++this.generation;
		return task.then(
			entries => generation === this.generation ? { entries } : null,
			error => generation === this.generation ? { entries: [], error } : null
		);
	}

	invalidate(): void { this.generation += 1; }
}
