export interface ReaderTargetPanelOptions {
	id: string;
	selectedPath: string;
	close(): void;
	listTargets(): Promise<Array<{ path: string; label: string }>>;
	selectPath(path: string): Promise<void>;
	openTarget(): Promise<void>;
	drop(event: DragEvent): Promise<void>;
	renderExcerpts(container: HTMLElement): Promise<void>;
}

/** Auxiliary target management only; native Canvas/Markdown/Excalidraw remain host leaves. */
export function createReaderTargetPanel(options: ReaderTargetPanelOptions): { panel: HTMLElement; excerptContainer: HTMLElement; closeButton: HTMLButtonElement } {
	const panel = document.createElement('aside');
	panel.className = 'rd-target-panel rd-target-panel--auxiliary';
	panel.id = options.id;
	panel.setAttribute('aria-label', '摘录管理');
	const header = panel.createDiv({ cls: 'rd-target-panel__header' });
	header.createEl('h2', { text: '摘录管理' });
	const closeButton = header.createEl('button', { cls: 'rd-button', text: '关闭', attr: { 'aria-label': '关闭摘录管理' } });
	closeButton.type = 'button';
	closeButton.addEventListener('click', options.close);
	panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); options.close(); } });
	panel.createEl('p', { text: '在这里选择目标并管理摘录；Canvas 会在相邻的原生工作区打开。' });
	const select = panel.createEl('select', { attr: { 'aria-label': '选择已有目标文档' } });
	select.append(new Option('正在加载已有目标…', ''));
	const open = panel.createEl('button', { cls: 'rd-button', text: '打开原生目标' });
	open.type = 'button';
	open.disabled = !options.selectedPath;
	open.addEventListener('click', () => void options.openTarget());
	select.addEventListener('change', () => {
		open.disabled = !select.value;
		void options.selectPath(select.value);
	});
	void options.listTargets().then(targets => {
		select.replaceChildren();
		if (!targets.length) select.append(new Option('暂无已有目标，创建摘录时会自动生成', ''));
		else {
			select.append(new Option('选择已有目标…', ''));
			for (const target of targets) select.append(new Option(target.label, target.path));
		}
		select.value = options.selectedPath;
		open.disabled = !options.selectedPath;
	}).catch(() => {
		select.replaceChildren(new Option('目标列表加载失败，仍可直接创建摘录', ''));
		open.disabled = true;
	});
	const excerpts = panel.createEl('section', { attr: { 'aria-label': 'Reading Desk 摘录卡片' } });
	void options.renderExcerpts(excerpts);
	panel.addEventListener('dragover', event => event.preventDefault());
	panel.addEventListener('drop', event => void options.drop(event));
	return { panel, excerptContainer: excerpts, closeButton };
}
