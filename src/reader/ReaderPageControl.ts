import { setIcon } from 'obsidian';

export interface ReaderPageControlOptions {
	page: number;
	pages: number;
	goTo(page: number): Promise<void>;
}

export interface ReaderPageControl {
	update(page: number, pages: number): void;
}

export function createReaderButton(parent: HTMLElement, label: string, action: () => void, icon?: string): HTMLButtonElement {
	const button = parent.createEl('button', { text: icon ? '' : label, cls: icon ? 'rd-button rd-icon-button' : 'rd-button', attr: icon ? { 'aria-label': label, title: label } : {} });
	button.type = 'button';
	if (icon) setIcon(button, icon);
	button.addEventListener('click', action);
	return button;
}

export function createReaderPageControl(parent: HTMLElement, options: ReaderPageControlOptions): ReaderPageControl {
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
	return {
		update(page: number, pages: number): void {
			const bounded = Math.max(1, Math.min(Math.max(pages, 1), page));
			input.value = String(bounded);
			input.setAttribute('max', String(Math.max(pages, 1)));
			input.setAttribute('aria-label', `当前页，共 ${pages} 页`);
			previous.disabled = bounded <= 1;
			next.disabled = bounded >= Math.max(pages, 1);
		}
	};
}

export interface ReaderZoomControlOptions {
	scale: number;
	setScale(scale: number): void;
	zoomOut(): void;
	zoomIn(): void;
}

export interface ReaderZoomControl {
	update(scale: number): void;
}

/** Compact zoom group: − [100%] + with direct percentage entry. */
export function createReaderZoomControl(parent: HTMLElement, options: ReaderZoomControlOptions): ReaderZoomControl {
	const group = parent.createDiv({ cls: 'rd-zoom-control', attr: { role: 'group', 'aria-label': 'PDF 缩放' } });
	createReaderButton(group, '缩小', options.zoomOut, 'zoom-out');
	const input = group.createEl('input', {
		type: 'number', value: String(Math.round(options.scale * 100)), cls: 'rd-input',
		attr: { min: '50', max: '300', step: '5', 'aria-label': '缩放百分比' }
	});
	group.createSpan({ cls: 'rd-zoom-control__suffix', text: '%' });
	createReaderButton(group, '放大', options.zoomIn, 'zoom-in');
	input.addEventListener('change', () => {
		const value = Number(input.value);
		if (Number.isFinite(value) && value > 0) options.setScale(value / 100);
		else input.value = String(Math.round(options.scale * 100));
	});
	return {
		update(scale: number): void { input.value = String(Math.round(scale * 100)); }
	};
}
