import { FakeDocument, FakeElement, FakeEvent } from '../../support/fake-dom';

export class PanelElement extends FakeElement {
	value = '';
	disabled = false;
	checked = false;
	files: Array<{ size: number; text(): Promise<string> }> = [];
	get textContent(): string { return this.text + this.children.map(child => (child as PanelElement).textContent).join(''); }
	set textContent(value: string) { this.replaceChildren(); this.text = value; }
	remove(): void {
		if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
		this.parent = null;
	}
	click(): boolean { return this.disabled ? false : super.click(); }
	input(value: string): void { this.value = value; this.dispatchEvent(new FakeEvent('input')); }
	change(): void { this.dispatchEvent(new FakeEvent('change')); }
	choose(text: string): void {
		this.files = [{ size: text.length, text: async () => text }]; this.change();
	}
}
export class PanelDocument extends FakeDocument {
	readonly body = new PanelElement('body', this);
	createElement(tag: string): PanelElement { return new PanelElement(tag, this); }
}
export function byLabel(root: FakeElement, label: string): PanelElement {
	const descendants = (node: FakeElement): FakeElement[] => node.children.flatMap(child => [child, ...descendants(child)]);
	const element = descendants(root).find(node => node.getAttribute('aria-label') === label && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName));
	if (!element) throw new Error(`Missing control: ${label}`);
	return element as PanelElement;
}
export async function flushPanel(): Promise<void> { for (let step = 0; step < 20; step++) await Promise.resolve(); }
