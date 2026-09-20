export interface ReaderPageControlOptions {
	page: number;
	pages: number;
	goTo(page: number): Promise<void>;
}

export function createReaderButton(parent: HTMLElement, label: string, action: () => void, icon?: string): HTMLButtonElement {
	const button = parent.createEl('button', { text: icon ? '' : label, cls: icon ? 'rd-button rd-icon-button' : 'rd-button', attr: icon ? { 'aria-label': label, title: label } : {} });
	button.type = 'button';
	if (icon) setIcon(button, icon);
	button.addEventListener('click', action);
	return button;
}

export function createReaderPageControl(parent: HTMLElement, options: ReaderPageControlOptions): void {
	const group = parent.createDiv({ cls: 'rd-page-control', attr: { role: 'group', 'aria-label': 'PDF 页码导航' } });
	const previous = createReaderButton(group, '上一页', () => void options.goTo(options.page - 1), 'chevron-left');
	previous.disabled = options.page <= 1;
	group.createEl('span', { cls: 'rd-page-control__prefix', text: '第' });
	const input = group.createEl('input', { type: 'number', value: String(options.page), attr: { min: '1', max: String(Math.max(options.pages, 1)), 'aria-label': `当前页，共 ${options.pages} 页` } });
	input.disabled = options.pages === 0;
	input.addEventListener('change', () => void options.goTo(input.value.trim() === '' ? options.page : Number(input.value)));
	group.createEl('span', { cls: 'rd-page-count', text: `/ ${options.pages}` });
	group.createEl('span', { cls: 'rd-page-control__suffix', text: '页' });
	const next = createReaderButton(group, '下一页', () => void options.goTo(options.page + 1), 'chevron-right');
	next.disabled = options.page >= Math.max(options.pages, 1);
}
import { setIcon } from 'obsidian';
