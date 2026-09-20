import { describe, expect, it, vi } from 'vitest';
import { createReaderPageControl } from '../../src/reader/ReaderPageControl';

class ElementDouble {
	children: ElementDouble[] = [];
	text = '';
	value = '';
	disabled = false;
	type = '';
	attributes: Record<string, string> = {};
	listeners: Record<string, () => void> = {};
	createDiv(options: { cls?: string; attr?: Record<string, string> }): ElementDouble { return this.createEl('div', options); }
	createEl(_tag: string, options: { text?: string; value?: string; attr?: Record<string, string> } = {}): ElementDouble {
		const child = new ElementDouble();
		child.text = options.text ?? '';
		child.value = options.value ?? '';
		child.attributes = options.attr ?? {};
		this.children.push(child);
		return child;
	}
	addEventListener(type: string, listener: () => void): void { this.listeners[type] = listener; }
}

describe('Reader page control', () => {
	it('renders compact Chinese page context and navigates from an edited page', () => {
		const root = new ElementDouble();
		const goTo = vi.fn(async () => undefined);
		createReaderPageControl(root as unknown as HTMLElement, { page: 42, pages: 286, goTo });
		const group = root.children[0];
		expect(group.attributes).toMatchObject({ role: 'group', 'aria-label': 'PDF 页码导航' });
		expect(group.children.map(child => child.text)).toEqual(['', '第', '', '/ 286', '页', '']);
		expect(group.children[0].attributes['aria-label']).toBe('上一页');
		expect(group.children[5].attributes['aria-label']).toBe('下一页');
		const input = group.children[2];
		expect(input.attributes['aria-label']).toBe('当前页，共 286 页');
		input.value = '57';
		input.listeners.change();
		expect(goTo).toHaveBeenCalledWith(57);
	});
});
