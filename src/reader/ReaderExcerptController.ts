import { Notice } from 'obsidian';
import type { PdfHighlight, TargetType } from '../types/contracts';
import type { PageSurface } from './PageSurface';
import { freezeExcerptSelection, ReaderSelectionError, writeReaderExcerpt, type ExcerptWriteInput, type FrozenExcerptSelection } from './ReaderExcerptWriter';
import { revealCreatedCanvasTarget } from './ReaderTargetHandoff';
import type { AnnotationStore } from '../annotations/AnnotationStore';
import type { TargetService } from '../targets';
export interface ReaderExcerptIO {
	input(text: string, type: TargetType, color: PdfHighlight['color']): ExcerptWriteInput | null;
	setColor(color: PdfHighlight['color']): void;
	refresh(): Promise<void>;
	openTargetInSplit(path: string, objectId?: string): Promise<void>;
}
/** Selection lifetime and per-leaf notices, without owning target serialization. */
export class ReaderExcerptController {
	constructor(private readonly io: ReaderExcerptIO) { }
	async create(text: string, type: TargetType, color: PdfHighlight['color'], frozenSelection?: FrozenExcerptSelection): Promise<void> {
		const input = this.io.input(text, type, color); if (!input) return;
		const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
		try {
			const written = await writeReaderExcerpt({ ...input, frozenSelection }, range);
			if (!written) return;
			this.io.setColor(color); selection?.removeAllRanges(); await this.io.refresh();
			const target = written.highlight.target; const reveal = target ? await revealCreatedCanvasTarget(target, this.io) : 'created';
			if (reveal === 'opened') new Notice('已创建 Canvas 卡片。');
			else if (reveal === 'open-failed') new Notice('Canvas 卡片已创建，但无法自动打开；可从摘录管理手动打开。');
		} catch (error) {
			console.error('[Reading Desk] 创建摘录失败', error);
			new Notice(error instanceof ReaderSelectionError ? error.message : '创建摘录失败；已保留的待写入记录可从设置中重试。');
		}
	}
	beginDrag(event: DragEvent, surface: PageSurface | null, pdfPath: string): void {
		if (!surface || !event.dataTransfer) return;
		const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		try {
			const frozen = freezeExcerptSelection(surface, range, pdfPath); if (!frozen?.text) return;
			event.dataTransfer.setData('text/plain', frozen.text);
			event.dataTransfer.setData('application/x-reading-desk-selection', JSON.stringify(frozen));
			event.dataTransfer.setData('application/x-reading-desk-rects', JSON.stringify(frozen.rects));
			event.dataTransfer.effectAllowed = 'copy';
		} catch (error) { event.preventDefault(); if (error instanceof ReaderSelectionError) new Notice(error.message); }
	}
}
/** Targeted recolor uses the same durable intent workflow as initial creation. */
export async function recolorReaderExcerpt(store: AnnotationStore, targets: TargetService, id: string, color: PdfHighlight['color']): Promise<void> {
	const highlight = store.get(id); if (!highlight) return;
	if (highlight.target) await targets.writeAndSaveExcerpt(highlight.target, { ...highlight, color, updatedAt: Date.now() }, store, store.excerptCard(id));
	else await store.recolor(id, color);
}
