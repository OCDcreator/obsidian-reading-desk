import { Menu, Notice } from 'obsidian';
import type { PdfHighlight, TargetType } from '../types/contracts';
import { ReaderSearchPanel } from '../ui/search/ReaderSearchPanel';
import { clearSearchMarks, markSearchHits, ReaderSearchService, type SearchHit } from './ReaderSearchService';
import { targetTypeLabel } from '../ui/targets/TargetUiTypes';

export interface ReaderToolsDeps {
	/** Live PDF renderer; switches when the document changes. */
	pdf(): { pageText(page: number): Promise<string> };
	pageCount(): number;
	/** Jumps to a page, e.g. a search hit. */
	goToPage(page: number): Promise<void>;
	/** The rendered host for a page, when present. */
	hostForPage(page: number): HTMLElement | null;
	currentPage(): number;
	annotations(): { list(path: string | null | undefined): PdfHighlight[] };
	activePath(): string | null;
	refreshAnnotations(): Promise<void>;
	/** Deletes the target card before removing the highlight. */
	deleteExcerptFor(highlight: PdfHighlight): Promise<void>;
	removeHighlight(id: string): Promise<void>;
	createExcerpt(text: string, type: TargetType, color: PdfHighlight['color']): Promise<void>;
	lastColor(): PdfHighlight['color'];
	selectionText(): string;
	writeClipboard(text: string): Promise<void>;
}

/**
 * Reader tooling that is pure orchestration: full-text search wiring, selection
 * copy and undo of the latest excerpt. ReaderView delegates instead of owning it.
 */
export class ReaderToolsController {
	private readonly searchService = new ReaderSearchService();
	readonly searchPanel: ReaderSearchPanel;

	constructor(private readonly deps: ReaderToolsDeps) {
		this.searchPanel = new ReaderSearchPanel({
			run: async (query): Promise<SearchHit[]> => this.searchService.search(this.deps.pdf(), this.deps.pageCount(), query),
			goTo: async hit => { await this.deps.goToPage(hit.page); this.applySearchMarks(); }
		});
	}

	/** Invalidates caches when another document opens. */
	resetForDocument(): void {
		this.searchService.reset();
	}

	toggleSearch(): void {
		this.searchPanel.toggle();
		this.applySearchMarks();
	}

	/** Re-marks the current query on the rendered page after navigation. */
	applySearchMarks(): void {
		const query = this.searchPanel.isOpen() ? this.searchPanel.currentQuery() : '';
		for (let page = 1; page <= this.deps.pageCount(); page += 1) {
			const host = this.deps.hostForPage(page);
			if (host) clearSearchMarks(host);
		}
		const current = this.deps.hostForPage(this.deps.currentPage());
		if (current && query) markSearchHits(current, query);
	}

	canCopySelection(): boolean {
		return this.deps.selectionText().length > 0;
	}

	async copySelectedText(): Promise<void> {
		const text = this.deps.selectionText();
		if (!text) {
			new Notice('请先选择要复制的 PDF 原文。');
			return;
		}
		try {
			await this.deps.writeClipboard(text);
			new Notice(`已复制 ${text.length} 字选中文本。`);
		} catch (_error) {
			new Notice('复制失败：无法写入剪贴板，请检查系统权限后重试。');
		}
	}

	canUndoLastExcerpt(): boolean {
		return this.latestHighlight() !== null;
	}

	async undoLastExcerpt(): Promise<void> {
		const highlight = this.latestHighlight();
		if (!highlight) {
			new Notice('本书还没有可撤销的摘录。');
			return;
		}
		try {
			await this.deps.deleteExcerptFor(highlight);
			await this.deps.removeHighlight(highlight.id);
			await this.deps.refreshAnnotations();
			new Notice('已撤销上一条摘录及其高亮。');
		} catch (error) {
			console.error('[Reading Desk] 撤销摘录失败', error);
			new Notice('撤销摘录失败。目标文档可能正在被编辑，请稍后重试。');
		}
	}

	private latestHighlight(): PdfHighlight | null {
		const list = this.deps.annotations().list(this.deps.activePath());
		if (!list.length) return null;
		return list.reduce((latest, current) => current.createdAt > latest.createdAt ? current : latest, list[0]);
	}

	/** Opens the selection context menu; the reader passes the stage bounds for keyboard entry. */
	openSelectionMenu(event: MouseEvent | undefined, stageBounds?: DOMRect): void {
		const selection = this.deps.selectionText();
		if (!selection) {
			if (event) return;
			new Notice('请先选择 PDF 原文，再按 Enter 打开摘录菜单。');
			return;
		}
		event?.preventDefault();
		showSelectionMenu({
			selection,
			lastColor: () => this.deps.lastColor(),
			createExcerpt: (text, type, color) => this.deps.createExcerpt(text, type, color),
			copySelectedText: () => void this.copySelectedText()
		}, event, stageBounds ? { x: stageBounds.left + stageBounds.width / 2, y: stageBounds.top + stageBounds.height / 2 } : undefined);
	}
}

/** Builds the selection context menu shared by right-click and Enter paths. */
export function showSelectionMenu(deps: {
	selection: string;
	lastColor(): PdfHighlight['color'];
	createExcerpt(text: string, type: TargetType, color: PdfHighlight['color']): Promise<void>;
	copySelectedText(): void;
}, event?: MouseEvent, stageCenter?: { x: number; y: number }): Menu {
	const menu = new Menu();
	for (const type of ['canvas', 'markdown', 'excalidraw'] as TargetType[]) {
		menu.addItem(item => item.setTitle(`添加到${targetTypeLabel(type)}`).onClick(() => deps.createExcerpt(deps.selection, type, deps.lastColor())));
	}
	menu.addItem(item => item.setTitle('复制选中文本').onClick(() => deps.copySelectedText()));
	if (event) menu.showAtMouseEvent(event);
	else if (stageCenter) menu.showAtPosition({ x: Math.round(stageCenter.x), y: Math.round(stageCenter.y) });
	return menu;
}
