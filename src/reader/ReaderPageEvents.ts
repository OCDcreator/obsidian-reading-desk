import type { PdfHighlight } from '../types/contracts';
import { readerKeyAction, readerKeyTargetIsEditable, type ReaderKeyAction } from './ReaderKeyboard';

export interface ReaderPageEventDeps {
	/** Resolves a highlight id from the annotation source. */
	getHighlight(id: string): PdfHighlight | null;
	/** Opens the comment popover for a PDF mark. */
	openComment(highlight: PdfHighlight, anchor: HTMLElement): void;
	/** Current selection text, trimmed. */
	selectionText(): string;
	/** Jumps to a highlight's target object. */
	jumpToTarget(highlightId: string): void;
	/** Semantic actions for bound keys. */
	page(delta: -1 | 1): void;
	zoom(delta: number): void;
	fit(mode: 'width' | 'height' | 'page'): void;
	rotate(delta: 90 | -90): void;
	back(): void;
	forward(): void;
	openSearch(): void;
	/** Ctrl/Cmd+wheel zoom factor application. */
	applyZoomFactor(factor: number): void;
	/** Begins an excerpt drag from the current selection. */
	beginDrag(event: DragEvent): void;
	/** Opens the selection context menu. */
	openSelectionMenu(event: MouseEvent): void;
}

/**
 * Translates raw DOM events on the PDF stage into semantic reader actions:
 * key dispatch (with editable-target guard), wheel zoom, click routing for
 * comment marks, drag starts and the selection context menu.
 */
export function bindReaderPageEvents(stage: HTMLElement, deps: ReaderPageEventDeps): void {
	stage.addEventListener('contextmenu', event => deps.openSelectionMenu(event));
	stage.addEventListener('keydown', event => {
		if (readerKeyTargetIsEditable(event.target)) return;
		const action = readerKeyAction(event);
		if (!action) return;
		event.preventDefault();
		dispatchReaderAction(action, deps);
	});
	stage.addEventListener('dblclick', event => {
		const mark = (event.target as HTMLElement).closest<HTMLElement>('[data-highlight-id]');
		if (mark) deps.jumpToTarget(mark.dataset.highlightId ?? '');
	});
	stage.addEventListener('click', event => routeStageClick(event, deps));
	stage.addEventListener('dragstart', event => deps.beginDrag(event));
	stage.addEventListener('wheel', event => {
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		deps.applyZoomFactor(event.deltaY < 0 ? 1.1 : 1 / 1.1);
	}, { passive: false });
}

export function dispatchReaderAction(action: ReaderKeyAction, deps: ReaderPageEventDeps): void {
	switch (action.type) {
		case 'page': deps.page(action.delta); break;
		case 'zoom': deps.zoom(action.delta * 0.15); break;
		case 'fit': deps.fit(action.mode); break;
		case 'rotate': deps.rotate(action.delta); break;
		case 'back': deps.back(); break;
		case 'forward': deps.forward(); break;
		case 'search': deps.openSearch(); break;
	}
}

function routeStageClick(event: MouseEvent, deps: ReaderPageEventDeps): void {
	const button = (event.target as HTMLElement).closest<HTMLElement>('.rd-highlight-comment-button');
	if (button) {
		const highlight = deps.getHighlight(button.dataset.highlightId ?? '');
		if (highlight) deps.openComment(highlight, button);
		return;
	}
	// Clicking a mark with a collapsed selection opens its comment popover, which
	// carries recolor/tag/delete; drag-selecting text keeps the native behavior.
	if (deps.selectionText()) return;
	const mark = (event.target as HTMLElement).closest<HTMLElement>('.rd-highlight');
	if (!mark) return;
	const highlight = deps.getHighlight(mark.dataset.highlightId ?? '');
	if (highlight) deps.openComment(highlight, mark);
}
