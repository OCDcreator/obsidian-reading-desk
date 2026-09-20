import type { PdfHighlight } from '../types/contracts';
import type { AnnotationStore } from '../annotations/AnnotationStore';
import { CommentPopover } from '../ui/comments/CommentPopover';
import { HighlightList } from '../ui/comments/HighlightList';
import type { HighlightListHost } from '../ui/comments/CommentUiTypes';
import type { HighlightListScope } from '../ui/comments/HighlightList';

export interface ReaderBridgeActions {
	annotations(): AnnotationStore;
	/** Deletes the target excerpt card and the highlight itself. */
	deleteExcerptFor(highlightId: string): Promise<void>;
	recolor(highlightId: string, color: PdfHighlight['color']): Promise<void>;
	focusHighlight(highlight: PdfHighlight): Promise<void>;
	copyHighlightLink(highlight: PdfHighlight): Promise<void>;
	/** Scope changes must re-render the drawer and rebind previews. */
	onScopeChanged(): void;
	goToPage(page: number): Promise<void>;
	hostForPage(page: number): HTMLElement | null;
	/** Collapses the highlight drawer while a popover is open. */
	collapseDrawer(): void;
}

/**
 * Owns the comment popover and the highlight list wiring so ReaderView stays the
 * orchestrator, not the host factory. Both UIs share one annotation source.
 */
export class ReaderCommentBridge {
	private readonly comments: CommentPopover;
	private readonly list: HighlightList;

	constructor(private readonly actions: ReaderBridgeActions) {
		const excerptActions = {
			recolorHighlight: async (id: string, color: PdfHighlight['color']) => { await actions.recolor(id, color); },
			deleteHighlight: async (id: string) => { await actions.deleteExcerptFor(id); },
			jumpToHighlight: (highlight: PdfHighlight) => actions.focusHighlight(highlight)
		};
		const store = () => actions.annotations();
		this.comments = new CommentPopover({
			comments: id => store().comments(id),
			allTags: () => store().allTags(),
			addComment: async (id, content) => { await store().addComment(id, content, 'pdf'); },
			deleteComment: async (id, commentId) => { await store().deleteComment(id, commentId); },
			setTags: async (id, tags) => { await store().setTags(id, tags); },
			...excerptActions
		});
		const listHost: HighlightListHost = {
			...excerptActions,
			copyHighlightLink: highlight => actions.copyHighlightLink(highlight),
			setScope: (scope: HighlightListScope) => {
				this.pendingScope = scope;
				actions.onScopeChanged();
			}
		};
		this.list = new HighlightList(listHost);
	}

	private pendingScope: HighlightListScope | null = null;

	/** The scope chosen inside the list since the last drain; consumed by onScopeChanged flows. */
	drainPendingScope(): HighlightListScope | null {
		const scope = this.pendingScope;
		this.pendingScope = null;
		return scope;
	}

	renderList(drawer: HTMLElement, highlights: PdfHighlight[], currentPage: number, scope: HighlightListScope): void {
		this.list.render(drawer, { highlights, currentPage, scope });
	}

	/** Opens the shared comment state anchored to a PDF mark, a list row target or the page host. */
	async openFor(highlight: PdfHighlight, anchor: HTMLElement | undefined, jumpToPage: boolean): Promise<void> {
		if (jumpToPage) await this.actions.goToPage(highlight.page + 1);
		const pageHost = this.actions.hostForPage(highlight.page + 1);
		const commentAnchor = anchor
			?? pageHost?.querySelector<HTMLElement>(`[data-highlight-id="${highlight.id}"]`)
			?? pageHost;
		if (!commentAnchor) return;
		const ownerDocument = commentAnchor.ownerDocument;
		const view = ownerDocument.defaultView;
		if (!view) return;
		const host = ownerDocument.createElement('div');
		host.className = 'rd-comment-popover-host reading-desk-shell';
		if (ownerDocument.body.classList.contains('theme-dark') || ownerDocument.documentElement.classList.contains('theme-dark')) host.classList.add('theme-dark');
		ownerDocument.body.append(host);
		this.actions.collapseDrawer();
		this.comments.open(host, {
			highlight,
			onClose: () => { host.remove(); commentAnchor.focus(); }
		});
		const anchorBounds = commentAnchor.getBoundingClientRect();
		const popoverBounds = host.getBoundingClientRect();
		const margin = 16;
		const left = Math.max(margin, Math.min(anchorBounds.right + 8, view.innerWidth - popoverBounds.width - margin));
		const top = Math.max(margin, Math.min(anchorBounds.top, view.innerHeight - popoverBounds.height - margin));
		Object.assign(host.style, { left: `${left}px`, top: `${top}px` });
		host.querySelector<HTMLElement>('.rd-comment-popover')?.focus();
	}
}
