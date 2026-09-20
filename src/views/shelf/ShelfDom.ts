/** Shared DOM vocabulary for the shelf surface modules; no Obsidian API coupling. */

export function element(tag: string, className: string, text?: string): HTMLElement {
	const value = document.createElement(tag);
	value.className = className;
	if (text !== undefined) value.textContent = text;
	return value;
}

export function button(text: string, label: string, onClick: () => void): HTMLButtonElement {
	const control = document.createElement('button');
	control.type = 'button';
	control.className = 'rd-button';
	control.textContent = text;
	control.setAttribute('aria-label', label);
	control.addEventListener('click', event => {
		event.stopPropagation();
		onClick();
	});
	return control;
}

export function documentInput(type: string, placeholder: string): HTMLInputElement {
	const input = document.createElement('input');
	input.type = type;
	input.placeholder = placeholder;
	return input;
}

export function option(document: Document, value: string, label: string): HTMLOptionElement {
	const item = document.createElement('option');
	item.value = value;
	item.textContent = label;
	return item;
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

/** A text button styled as an inline section link (transparent chrome, accent ink). */
export function linkButton(text: string, label: string, onClick: () => void): HTMLButtonElement {
	const control = button(text, label, onClick);
	control.classList.add('rd-section-link');
	return control;
}

/** Runs `save` unless Escape cancelled the edit first; blur/Enter commit. */
export function bindInlineInput(input: HTMLInputElement, save: () => void): void {
	let cancelled = false;
	input.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelled = true;
			input.blur();
		}
	});
	input.addEventListener('blur', () => {
		if (cancelled) return;
		save();
	});
}

/** A lightweight anchored menu used for chip right-click actions. */
export interface MenuAction {
	label: string;
	onClick: () => void;
	danger?: boolean;
	/** Asks the user to confirm inside the menu before running onClick. */
	confirm?: string;
}

export function showActionMenu(anchor: HTMLElement, actions: MenuAction[]): void {
	const document = anchor.ownerDocument;
	hideActionMenu(document);
	const menu = element('div', 'rd-action-menu');
	menu.setAttribute('role', 'menu');
	for (const action of actions) menu.append(createMenuItem(document, action));
	const close = (): void => hideActionMenu(document);
	document.body.append(menu);
	const rect = anchor.getBoundingClientRect();
	menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
	menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8)}px`;
	menu.addEventListener('click', event => event.stopPropagation());
	window.setTimeout(() => {
		document.addEventListener('click', close, { once: true });
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape') close();
		}, { once: true });
	}, 0);
}

function createMenuItem(document: Document, action: MenuAction): HTMLButtonElement {
	const item = button(action.label, action.label, () => {
		if (!action.confirm) {
			hideActionMenu(document);
			action.onClick();
			return;
		}
		const row = element('span', 'rd-action-menu-confirm');
		row.append(element('span', 'rd-action-menu-question', action.confirm));
		const yes = button('确认', action.label, () => {
			hideActionMenu(document);
			action.onClick();
		});
		yes.classList.add('rd-action-menu-item', 'is-danger');
		const no = button('取消', `取消${action.label}`, () => hideActionMenu(document));
		no.classList.add('rd-action-menu-item');
		row.append(yes, no);
		item.replaceChildren(row);
	});
	item.classList.add('rd-action-menu-item');
	if (action.danger) item.classList.add('is-danger');
	item.setAttribute('role', 'menuitem');
	return item;
}

function hideActionMenu(document: Document): void {
	document.querySelectorAll('.rd-action-menu').forEach(node => node.remove());
}
