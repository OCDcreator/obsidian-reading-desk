import { HighlightPreviewController } from './HighlightPreviewController';

export type HighlightScope = 'book' | 'page';

/** Owns only the transient, per-leaf highlight drawer scope and DOM bindings. */
export class ReaderHighlightCoordinator {
	private scope: HighlightScope = 'book';
	private readonly preview: HighlightPreviewController;

	constructor(jumpToTarget: (highlightId: string) => Promise<void> | void) {
		this.preview = new HighlightPreviewController(jumpToTarget);
	}

	getScope(): HighlightScope { return this.scope; }
	setScope(scope: HighlightScope): void { this.scope = scope; }
	bind(page: HTMLElement | null, drawer: HTMLElement | null): void { this.preview.bind(page, drawer); }
	clear(): void { this.preview.clear(); }
	close(): void { this.preview.destroy(); }
}
