import { closeReaderTargetPanel, toggleReaderTargetPanel } from './ReaderTargetDisclosure';
import type { TargetPanelDisclosure } from './TargetPanelDisclosure';
import type { TargetType } from '../../types/contracts';

export interface ReaderTargetPanelDeps {
	panelId: string;
	root(): HTMLElement;
	disclosure(): TargetPanelDisclosure | null;
	selectedTarget(): TargetType;
	selectedTargetPath(): string;
	/** Records the chosen target path on the reader. */
	onSelectPath(path: string): void;
	listTargets(): Promise<Array<{ path: string; label: string }>>;
	openTargetInSplit(path: string): Promise<void>;
	/** Commits a dropped prepared crop; resolves false when the payload is not a crop. */
	commitCropDrop(event: DragEvent, canvasTargetPath: string | undefined): Promise<boolean>;
	/** Builds an excerpt from a dragged text selection. */
	dropExcerpt(event: DragEvent): Promise<void>;
	renderExcerpts(container: HTMLElement): Promise<void>;
	/** Canvas targets need outline sync once selected. */
	syncOutlineForCanvas(targetPath: string): Promise<void>;
	onNotice(message: string): void;
}

/**
 * Owns the on-demand excerpt-management overlay: mount/unmount lifecycle, crop
 * drop routing and target path selection. The real target surface stays native.
 */
export class ReaderTargetPanelController {
	private panel: HTMLElement | null = null;
	private excerpts: HTMLElement | null = null;

	constructor(private readonly deps: ReaderTargetPanelDeps) { }

	isOpen(): boolean { return this.panel !== null; }

	/** Detaches DOM bookkeeping when the reader re-renders its whole surface. */
	reset(): void {
		this.panel = null;
		this.excerpts = null;
	}
	excerptsContainer(): HTMLElement | null { return this.excerpts; }

	toggle(): void {
		const disclosure = this.deps.disclosure();
		if (!disclosure) return;
		toggleReaderTargetPanel(this.deps.root(), disclosure, {
			id: this.deps.panelId,
			selectedPath: this.deps.selectedTargetPath(),
			close: () => this.close(),
			listTargets: () => this.deps.listTargets(),
			selectPath: path => this.selectPath(path),
			openTarget: () => this.deps.selectedTargetPath() ? this.deps.openTargetInSplit(this.deps.selectedTargetPath()) : Promise.resolve(),
			drop: event => this.drop(event),
			renderExcerpts: container => this.deps.renderExcerpts(container)
		}, (panel, excerpts) => {
			this.panel = panel;
			this.excerpts = excerpts;
		}, () => {
			this.panel = null;
			this.excerpts = null;
		});
	}

	close(): void {
		closeReaderTargetPanel(this.deps.disclosure(), this.panel, () => {
			this.panel = null;
			this.excerpts = null;
		});
	}

	private async drop(event: DragEvent): Promise<void> {
		const canvasTargetPath = this.deps.selectedTarget() === 'canvas' ? this.deps.selectedTargetPath() || undefined : undefined;
		if (await this.deps.commitCropDrop(event, canvasTargetPath)) return;
		event.preventDefault();
		await this.deps.dropExcerpt(event);
	}

	private async selectPath(path: string): Promise<void> {
		this.deps.onSelectPath(path);
		if (!path || this.deps.selectedTarget() !== 'canvas') return;
		try {
			await this.deps.syncOutlineForCanvas(path);
		} catch (error) {
			this.deps.onNotice(error instanceof Error ? `无法同步 Canvas 目录：${error.message}` : '无法同步 Canvas 目录。');
		}
	}
}
