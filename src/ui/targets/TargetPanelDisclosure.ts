export interface FocusControl {
	setAttribute(name: string, value: string): void;
	focus(): void;
}

export class TargetPanelDisclosure {
	private panel: FocusControl | null = null;
	constructor(private readonly toggle: FocusControl, readonly panelId: string) {
		toggle.setAttribute('aria-controls', panelId);
		toggle.setAttribute('aria-expanded', 'false');
	}

	open(panel: FocusControl, initialFocus: FocusControl): void {
		this.panel = panel;
		this.toggle.setAttribute('aria-expanded', 'true');
		initialFocus.focus();
	}

	close(remove: () => void): void {
		if (!this.panel) return;
		remove();
		this.panel = null;
		this.toggle.setAttribute('aria-expanded', 'false');
		this.toggle.focus();
	}

	isOpen(): boolean { return this.panel !== null; }
}
