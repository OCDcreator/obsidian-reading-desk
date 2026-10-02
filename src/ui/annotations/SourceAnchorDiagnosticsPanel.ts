import type { SourceAnchorDiagnostic } from '../../annotations/SourceAnchorDiagnostics';

const PAGE_SIZE = 20;
type SearchQuote = (query: string) => Promise<void> | void;
/** A bounded, expandable read-only check inside the existing highlight drawer. */
export class SourceAnchorDiagnosticsPanel {
	private root?: HTMLDetailsElement;
	private page = 1;
	private signature = '';

	render(container: HTMLElement, diagnostics: readonly SourceAnchorDiagnostic[], onSearch: SearchQuote): void {
		const signature = diagnostics.map(item => item.highlightId + ':' + item.status).join('|');
		if (signature !== this.signature) this.page = 1;
		this.signature = signature;
		const open = this.root?.open ?? false;
		this.root?.remove(); this.root = undefined;
		if (!diagnostics.length) return;
		const doc = container.ownerDocument;
		const root = doc.createElement('details'); root.className = 'rd-source-anchor-diagnostics'; root.open = open; this.root = root;
		const changed = diagnostics.filter(item => item.status === 'changed').length;
		const unknown = diagnostics.filter(item => item.status === 'unknown').length;
		const summary = doc.createElement('summary');
		summary.textContent = '源文件核验：' + changed + ' 条信息变化 · ' + unknown + ' 条尚未核验';
		const description = doc.createElement('p'); description.className = 'rd-setting-save-status';
		description.textContent = '仅比较文件修改时间和大小，不能证明正文未变。请对照原引文核验；不会自动移动高亮或更改页码。';
		const list = doc.createElement('ol'); list.setAttribute('aria-label', '源文件核验结果');
		const navigation = doc.createElement('div');
		const feedback = doc.createElement('p'); feedback.className = 'rd-setting-save-status'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
		const makeButton = (text: string, label: string, action: () => void): HTMLButtonElement => {
			const control = doc.createElement('button'); control.type = 'button'; control.className = 'rd-button'; control.textContent = text; control.setAttribute('aria-label', label);
			control.addEventListener('click', action); return control;
		};
		const draw = (): void => {
			list.replaceChildren(); navigation.replaceChildren();
			const pages = Math.max(1, Math.ceil(diagnostics.length / PAGE_SIZE)); this.page = Math.min(pages, this.page);
			for (const item of diagnostics.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE)) {
				const row = doc.createElement('li'); row.dataset.highlightId = item.highlightId;
				const position = doc.createElement('p');
				position.textContent = (item.pageLabel ? '印刷页 ' + item.pageLabel + ' · ' : '') + 'PDF 第 ' + (item.page + 1) + ' 页 · ' + item.message;
				const quote = doc.createElement('p'); quote.textContent = item.quote || '此标注没有文字引文，请按页码人工核验。';
				row.append(position, quote);
				if (item.chapter) { const chapter = doc.createElement('p'); chapter.className = 'rd-setting-save-status'; chapter.textContent = '章节：' + item.chapter; row.append(chapter); }
				const find = makeButton('查找引文', '查找引文：PDF 第 ' + (item.page + 1) + ' 页', () => {
					find.disabled = true; feedback.textContent = '正在查找原引文…';
					void Promise.resolve().then(() => { if (this.root === root && root.isConnected) return onSearch(item.searchQuery); }).then(() => {
						if (this.root === root) feedback.textContent = '已在全文搜索中查找引文；长引文使用开头片段。';
					}).catch(error => {
						if (this.root === root) feedback.textContent = '查找失败：' + (error instanceof Error ? error.message : '请重试');
					}).finally(() => { find.disabled = !item.searchQuery; });
				});
				find.disabled = !item.searchQuery; row.append(find); list.append(row);
			}
			if (pages > 1) {
				const previous = makeButton('上一页', '上一页源文件核验结果', () => { this.page--; draw(); Array.from(navigation.querySelectorAll<HTMLButtonElement>('button')).find(control => !control.disabled)?.focus(); }); previous.disabled = this.page <= 1;
				const next = makeButton('下一页', '下一页源文件核验结果', () => { this.page++; draw(); Array.from(navigation.querySelectorAll<HTMLButtonElement>('button')).find(control => !control.disabled)?.focus(); }); next.disabled = this.page >= pages;
				const count = doc.createElement('span'); count.textContent = '第 ' + this.page + ' / ' + pages + ' 页';
				navigation.append(previous, count, next);
			}
		};
		root.append(summary, description, list, navigation, feedback); container.append(root); draw();
	}
	destroy(): void { this.root?.remove(); this.root = undefined; this.page = 1; this.signature = ''; }
}
