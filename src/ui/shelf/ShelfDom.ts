export function element<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = cls;
	if (text !== undefined) node.textContent = text;
	return node;
}
export function button(text: string, label: string, run: () => void): HTMLButtonElement {
	const node = element('button', 'rd-button', text);
	node.type = 'button';
	node.setAttribute('aria-label', label);
	node.addEventListener('click', event => { event.stopPropagation(); run(); });
	return node;
}
export function input(type: string, label: string, value = ''): HTMLInputElement {
	const node = element('input', 'rd-input');
	node.type = type;
	node.value = value;
	node.setAttribute('aria-label', label);
	return node;
}
export function select(label: string, values: Array<[string, string]>, value = ''): HTMLSelectElement {
	const node = element('select', 'rd-select');
	node.setAttribute('aria-label', label);
	for (const [key, text] of values) {
		const option = element('option', '', text); option.value = key; node.append(option);
	}
	node.value = values.some(([key]) => key === value) ? value : values[0]?.[0] ?? '';
	return node;
}
export function field(label: string, control: HTMLElement): HTMLLabelElement {
	const wrapper = element('label', 'rd-shelf-field');
	wrapper.append(element('span', '', label), control);
	return wrapper;
}
export function errorMessage(error: unknown, fallback = '操作失败，请重试'): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
/** Only the card/row itself handles activation. Native nested controls keep their keys. */
export function isItemActivation(event: KeyboardEvent): boolean {
	return event.target === event.currentTarget && !event.isComposing && (event.key === 'Enter' || event.key === ' ');
}
