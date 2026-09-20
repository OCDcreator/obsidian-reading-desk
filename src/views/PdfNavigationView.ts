import { ItemView, type Workspace, type WorkspaceLeaf } from 'obsidian';
import type { ReaderView } from './ReaderView';

export const PDF_NAVIGATION_VIEW_TYPE = 'reading-desk-pdf-navigation';

/** Reload cycles can strand duplicate navigation leaves in the left sidebar; keep exactly one. */
export function detachDuplicateNavigationLeaves(workspace: Workspace, viewType: string, keep: WorkspaceLeaf): void {
	for (const duplicate of workspace.getLeavesOfType(viewType)) {
		if (duplicate !== keep) duplicate.detach();
	}
}

export class PdfNavigationView extends ItemView {
	private stopWorkspaceListener: (() => void) | null = null;
	private activeReader: ReaderView | null = null;
	private navigationRoot: HTMLElement | null = null;
	constructor(leaf: WorkspaceLeaf, private readonly findReader: () => ReaderView | null) { super(leaf); }
	getViewType(): string { return PDF_NAVIGATION_VIEW_TYPE; }
	getDisplayText(): string { return 'PDF 导航'; }
	getIcon(): string { return 'panel-left'; }
	async onOpen(): Promise<void> {
		this.containerEl.children[1]?.replaceChildren();
		this.containerEl.children[1]?.addClass('reading-desk-pdf-navigation-host');
		this.navigationRoot = this.navigationHost().createDiv();
		this.activeReader = this.findReader();
		this.render();
		const eventRef = this.app.workspace.on('active-leaf-change', leaf => {
			if (leaf?.view && this.isReader(leaf.view) && leaf.view !== this.activeReader) {
				if (this.navigationRoot) this.activeReader?.detachNavigation(this.navigationRoot);
				this.activeReader = leaf.view;
			}
			this.render();
		});
		this.registerEvent(eventRef);
		this.stopWorkspaceListener = () => this.app.workspace.offref(eventRef);
	}
	async onClose(): Promise<void> {
		this.stopWorkspaceListener?.();
		this.stopWorkspaceListener = null;
		if (this.navigationRoot) this.activeReader?.detachNavigation(this.navigationRoot);
		this.activeReader = null;
		this.navigationRoot = null;
	}
	private navigationHost(): HTMLElement { return this.containerEl.children[1] as HTMLElement; }
	private render(): void {
		if (!this.navigationRoot) return;
		const reader = this.activeReader ?? this.findReader();
		if (!reader) {
			this.navigationRoot.replaceChildren();
			this.navigationRoot.createEl('p', { cls: 'rd-empty', text: '打开 Reading Desk 阅读器后显示 PDF 导航。', attr: { role: 'status' } });
			return;
		}
		this.activeReader = reader;
		this.restorePreferredMode(reader);
		reader.attachNavigation(this.navigationRoot);
	}
	/** Restores the last-used thumbnail/outline tab across sessions. */
	private restorePreferredMode(reader: ReaderView): void {
		try {
			const saved = window.localStorage.getItem('reading-desk-nav-mode');
			if (saved === 'thumbnails' || saved === 'outline') reader.setPreferredNavigationMode(saved);
		} catch { /* Storage can be unavailable in private windows. */ }
	}
	refresh(): void { this.render(); }
	private isReader(view: unknown): view is ReaderView { return typeof (view as ReaderView | undefined)?.attachNavigation === 'function'; }
}
