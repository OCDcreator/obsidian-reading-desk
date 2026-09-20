import type { PdfHighlight } from '../types/contracts';

/** Builds the selection-preserving Reader palette and delegates excerpt creation. */
export function createReaderPalette(parent: HTMLElement, createExcerpt: (color: PdfHighlight['color']) => void): void {
	const colors = [['moss', '苔'], ['amber', '琥'], ['brick', '砖'], ['indigo', '靛'], ['plum', '梅']] as Array<[PdfHighlight['color'], string]>;
	const swatches = parent.createDiv({ cls: 'rd-toolbar-palette', attr: { role: 'group', 'aria-label': '摘录颜色' } });
	for (const [color, label] of colors) {
		const swatch = swatches.createEl('button', { cls: ['rd-button', `rd-swatch--${color}`], attr: { title: `以${label}色摘录选中文本`, 'aria-label': `以${label}色摘录选中文本` } });
		swatch.type = 'button';
		swatch.addEventListener('mousedown', event => event.preventDefault());
		swatch.addEventListener('click', () => createExcerpt(color));
	}
	const button = createReaderButton(parent, '摘录颜色', () => {
		const menu = new Menu().setUseNativeMenu(false);
		for (const [color, label] of colors) {
			menu.addItem(item => item.setTitle(`以${label}色摘录选中文本`).onClick(() => createExcerpt(color)));
		}
		const bounds = button.getBoundingClientRect();
		menu.showAtPosition({ x: bounds.left, y: bounds.bottom }, button.ownerDocument);
	}, 'palette');
	button.addClass('rd-toolbar-palette__more');
	button.addEventListener('mousedown', event => event.preventDefault());
}
import { Menu } from 'obsidian';
import { createReaderButton } from './ReaderPageControl';
