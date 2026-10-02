import { button, element } from './ShelfDom';
/** A per-leaf modal surface; callers keep the trigger mounted while it is open. */
export class ShelfDialog {
	readonly panel: HTMLElement;
	readonly body: HTMLElement;
	private readonly previous: HTMLElement;
	private closed = false;
	constructor(private readonly root: HTMLElement, title: string, trigger: HTMLElement, private readonly onClose: () => void = () => undefined) {
		this.previous = trigger;
		this.panel = element('section', 'rd-shelf-dialog');
		this.panel.setAttribute('role', 'dialog');
		this.panel.setAttribute('aria-modal', 'true');
		this.panel.setAttribute('aria-label', title);
		this.panel.tabIndex = -1;
		const header = element('div', 'rd-shelf-dialog__header');
		header.append(element('h2', 'rd-section-title', title), button('关闭', '关闭' + title, () => this.close()));
		this.body = element('div', 'rd-shelf-dialog__body');
		this.panel.append(header, this.body);
		this.panel.addEventListener('keydown', event => {
			if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
			if (event.key !== 'Tab') return;
			const controls = this.focusableControls();
			const first = controls[0], last = controls[controls.length - 1];
			if (!first) { event.preventDefault(); this.panel.focus(); }
			else if (event.shiftKey && (this.panel.ownerDocument.activeElement === first || this.panel.ownerDocument.activeElement === this.panel)) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && this.panel.ownerDocument.activeElement === last) { event.preventDefault(); first.focus(); }
		});
		root.append(this.panel);
		this.panel.focus();
	}
	focusFirst(): void { (this.focusableControls().find(node => this.body.contains(node)) ?? this.focusableControls()[0] ?? this.panel).focus(); }
	private focusableControls(): HTMLElement[] {
		return Array.from(this.panel.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')).filter(node => {
			if (node.hasAttribute('disabled')) return false;
			for (let parent: HTMLElement | null = node; parent && parent !== this.panel; parent = parent.parentElement) if (parent.hidden) return false;
			return true;
		});
	}
	close(restore = true): void {
		if (this.closed) return;
		this.closed = true;
		this.panel.remove();
		this.onClose();
		if (restore) {
			const label = this.previous.getAttribute('aria-label');
			const equivalent = this.previous.isConnected ? this.previous : Array.from(this.root.querySelectorAll<HTMLElement>('[aria-label]')).find(node => node.getAttribute('aria-label') === label);
			equivalent?.focus();
		}
	}
}
