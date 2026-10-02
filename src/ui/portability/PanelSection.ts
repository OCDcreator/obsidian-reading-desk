export function panelElement<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	if (text !== undefined) element.textContent = text;
	return element;
}

/** Owns one stable live region and its async/lifecycle boundary. */
export class PanelSection {
	readonly root = panelElement('section');
	readonly body = panelElement('div');
	readonly status = panelElement('p');
	protected busy = false;
	protected disposed = false;
	private controls: Array<{ element: HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; enabled: () => boolean }> = [];

	constructor(label: string, className: string) {
		this.root.className = `rd-data-section ${className}`;
		this.root.setAttribute('aria-label', label);
		this.status.setAttribute('role', 'status');
		this.status.setAttribute('aria-live', 'polite');
		this.root.append(panelElement('h3', label), this.body, this.status);
	}

	protected button(label: string, action: () => void, enabled: () => boolean = () => true): HTMLButtonElement {
		const button = panelElement('button', label);
		button.type = 'button';
		button.className = 'rd-button';
		button.setAttribute('aria-label', label);
		button.addEventListener('click', () => { if (!this.busy && !this.disposed && enabled()) action(); });
		this.control(button, enabled);
		return button;
	}

	protected control<T extends HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(element: T, enabled: () => boolean = () => true): T {
		this.controls.push({ element, enabled });
		return element;
	}

	protected refreshControls(): void {
		for (const { element, enabled } of this.controls) element.disabled = this.busy || this.disposed || !enabled();
		this.root.setAttribute('aria-busy', String(this.busy));
	}

	protected clearContents(container: HTMLElement): void {
		this.controls = this.controls.filter(({ element }) => !container.contains(element));
		container.replaceChildren();
	}

	/** Every row remains reachable while the DOM is bounded to one page. */
	protected pagedRows<T>(container: HTMLElement, items: T[], label: string, render: (item: T) => HTMLElement): void {
		this.clearContents(container);
		const rows = panelElement('div');
		const pageStatus = panelElement('span');
		const count = Math.max(1, Math.ceil(items.length / 100));
		let page = 0;
		const renderPage = (): void => {
			this.clearContents(rows);
			for (const item of items.slice(page * 100, (page + 1) * 100)) rows.append(render(item));
			pageStatus.textContent = `${label}：第 ${page + 1} / ${count} 页，共 ${items.length} 项`;
			this.refreshControls();
		};
		container.append(rows);
		if (count > 1) {
			const navigation = panelElement('div');
			navigation.append(this.button(`${label}上一页`, () => { page--; renderPage(); }, () => page > 0), pageStatus,
				this.button(`${label}下一页`, () => { page++; renderPage(); }, () => page < count - 1));
			container.append(navigation);
		}
		renderPage();
	}

	protected message(text: string, error = false): void {
		if (this.disposed) return;
		this.status.textContent = text;
		this.status.setAttribute('role', error ? 'alert' : 'status');
		this.status.setAttribute('aria-live', error ? 'assertive' : 'polite');
	}

	protected async run(label: string, action: () => Promise<void>): Promise<void> {
		if (this.busy || this.disposed) return;
		this.busy = true;
		this.message(label);
		this.refreshControls();
		try { await action(); }
		catch (error) {
			const detail = error instanceof Error ? error.message.slice(0, 300) : '未知错误';
			this.message(`${label.replace(/…$/, '')}失败：${detail}。请检查文件和存储状态后重试。`, true);
		} finally {
			this.busy = false;
			this.refreshControls();
		}
	}

	protected filePicker(label: string, accept: string, action: (file: File) => Promise<void>): HTMLInputElement {
		const wrapper = panelElement('label', label);
		const input = this.control(panelElement('input'));
		input.type = 'file'; input.accept = accept;
		input.setAttribute('aria-label', label);
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			if (file && !this.busy && !this.disposed) void action(file);
		});
		wrapper.append(input); this.body.append(wrapper);
		return input;
	}

	destroy(): void { this.disposed = true; this.root.remove(); }
}

export async function readPanelFile(file: File, capacity = { bytes: 10 * 1024 * 1024, message: '文件超过 10 MiB，请分批处理' }): Promise<string> {
	if (file.size > capacity.bytes) throw new Error(capacity.message);
	const text = await file.text();
	if (!text.trim()) throw new Error('文件为空');
	return text;
}

export function labelledInput(label: string, value = ''): { wrapper: HTMLLabelElement; input: HTMLInputElement } {
	const wrapper = panelElement('label', label);
	const input = panelElement('input');
	input.type = 'text'; input.value = value;
	input.setAttribute('aria-label', label);
	wrapper.append(input);
	return { wrapper, input };
}
