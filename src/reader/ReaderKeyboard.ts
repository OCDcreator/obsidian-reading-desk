/** Reader key bindings shared by the page host and the toolbar keyboard surface. */

export type ReaderKeyAction =
	| { type: 'page'; delta: -1 | 1 }
	| { type: 'zoom'; delta: -1 | 1 }
	| { type: 'fit'; mode: 'width' | 'height' | 'page' }
	| { type: 'rotate'; delta: 90 | -90 }
	| { type: 'back' }
	| { type: 'forward' }
	| { type: 'search' };

export interface ReaderKeyEvent {
	key: string;
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
}

/** Returns the reader action for a key, or null when the key is not bound. */
export function readerKeyAction(event: ReaderKeyEvent): ReaderKeyAction | null {
	const modifier = event.ctrlKey === true || event.metaKey === true;
	if (event.altKey && !modifier) {
		if (event.key === 'ArrowLeft') return { type: 'back' };
		if (event.key === 'ArrowRight') return { type: 'forward' };
		return null;
	}
	if (modifier || event.altKey) return null;
	switch (event.key) {
		case 'ArrowRight':
		case 'PageDown':
		case ' ':
			return { type: 'page', delta: 1 };
		case 'ArrowLeft':
		case 'PageUp':
			return { type: 'page', delta: -1 };
		case '+':
		case '=':
			return { type: 'zoom', delta: 1 };
		case '-':
		case '_':
			return { type: 'zoom', delta: -1 };
		case 'w':
			return { type: 'fit', mode: 'width' };
		case 'h':
			return { type: 'fit', mode: 'height' };
		case 'p':
			return { type: 'fit', mode: 'page' };
		case 'r':
			return { type: 'rotate', delta: 90 };
		case 'R':
			return { type: 'rotate', delta: -90 };
		case '/':
		case 'f':
			return { type: 'search' };
		default:
			return null;
	}
}

/** True when the event target is a text-entry surface that must keep native keys. */
export function readerKeyTargetIsEditable(target: EventTarget | null): boolean {
	const element = target as { isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
	if (!element || typeof element.closest !== 'function') return false;
	if (element.isContentEditable === true) return true;
	return !!element.closest('input, textarea, select, [contenteditable="true"]');
}
