export interface FocusControl {
	setAttribute(name: string, value: string): void;
	focus(): void;
	isConnected?: boolean;
}

const openingTriggers = new WeakMap<FocusControl, FocusControl>();

/** Remember the visible toolbar/menu entry before its action moves focus. */
export function rememberDisclosureTrigger(toggle: FocusControl, trigger: FocusControl): void {
	openingTriggers.set(toggle, trigger);
}

export class TargetPanelDisclosure {
	private panel: FocusControl | null = null;
	private trigger: FocusControl;
	constructor(private readonly toggle: FocusControl, readonly panelId: string) {
		this.trigger = toggle;
		toggle.setAttribute('aria-controls', panelId);
		toggle.setAttribute('aria-expanded', 'false');
	}

	open(panel: FocusControl, initialFocus: FocusControl, trigger?: FocusControl): void {
		this.trigger = trigger ?? openingTriggers.get(this.toggle) ?? this.toggle;
		openingTriggers.delete(this.toggle);
		this.panel = panel;
		this.toggle.setAttribute('aria-expanded', 'true');
		initialFocus.focus();
	}

	close(remove: () => void): void {
		if (!this.panel) return;
		remove();
		this.panel = null;
		this.toggle.setAttribute('aria-expanded', 'false');
		(this.trigger.isConnected === false ? this.toggle : this.trigger).focus();
	}

	isOpen(): boolean { return this.panel !== null; }
}
