import type { PdfHighlight } from '../types/contracts';

/** Builds the selection-preserving Reader palette and delegates excerpt creation. */
export function createReaderPalette(parent: HTMLElement, createExcerpt: (color: PdfHighlight['color']) => void): void {
	const group = document.createElement('div');
	group.className = 'rd-toolbar-palette';
	group.setAttribute('role', 'group');
	group.setAttribute('aria-label', '摘录颜色');
	for (const [color, label] of [['moss', '苔'], ['amber', '琥'], ['brick', '砖'], ['indigo', '靛'], ['plum', '梅']] as Array<[PdfHighlight['color'], string]>) {
		const button = group.createEl('button', { cls: ['rd-button', `rd-swatch--${color}`], text: label, attr: { title: `以${label}色摘录选中文本`, 'aria-label': `以${label}色摘录选中文本` } });
		button.type = 'button';
		button.addEventListener('mousedown', event => event.preventDefault());
		button.addEventListener('click', () => createExcerpt(color));
	}
	parent.append(group);
}
