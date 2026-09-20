export interface ReaderPageControlOptions {
	page: number;
	pages: number;
	goTo(page: number): Promise<void>;
}

export function createReaderButton(parent: HTMLElement, label: string, action: () => void): HTMLButtonElement {
	const button = parent.createEl('button', { text: label, cls: 'rd-button' });
	button.type = 'button';
	button.addEventListener('click', action);
	return button;
}

export function createReaderPageControl(parent: HTMLElement, options: ReaderPageControlOptions): void {
	const group = parent.createDiv({ cls: 'rd-page-control', attr: { role: 'group', 'aria-label': 'PDF 页码导航' } });
	const previous = group.createEl('button', { cls: 'rd-button', text: '上一页', attr: { 'aria-label': '上一页' } });
	previous.type = 'button';
	previous.disabled = options.page <= 1;
	previous.addEventListener('click', () => void options.goTo(options.page - 1));
	group.createEl('span', { cls: 'rd-page-control__prefix', text: '第' });
	const input = group.createEl('input', { type: 'number', value: String(options.page), attr: { min: '1', max: String(Math.max(options.pages, 1)), 'aria-label': `当前页，共 ${options.pages} 页` } });
	input.disabled = options.pages === 0;
	input.addEventListener('change', () => void options.goTo(input.value.trim() === '' ? options.page : Number(input.value)));
	group.createEl('span', { cls: 'rd-page-count', text: `/ ${options.pages}` });
	group.createEl('span', { cls: 'rd-page-control__suffix', text: '页' });
	const next = group.createEl('button', { cls: 'rd-button', text: '下一页', attr: { 'aria-label': '下一页' } });
	next.type = 'button';
	next.disabled = options.page >= Math.max(options.pages, 1);
	next.addEventListener('click', () => void options.goTo(options.page + 1));
}
