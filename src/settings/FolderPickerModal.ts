import { App, Modal, setIcon } from 'obsidian';
import { collectExpandedPaths, FolderTreeNode } from './FolderSelection';

/** 文件夹树多选弹窗:按库内目录结构勾选,确认后把路径数组交回设置行。 */
export class FolderPickerModal extends Modal {
	private readonly selected: Set<string>;
	private readonly expanded = new Set<string>();
	private status: HTMLElement | null = null;

	constructor(app: App, initial: string[], private readonly tree: FolderTreeNode, private readonly onConfirm: (paths: string[]) => void) {
		super(app);
		this.selected = new Set(initial);
		for (const path of collectExpandedPaths(this.tree, this.selected)) this.expanded.add(path);
	}

	onOpen(): void {
		this.modalEl.addClass('rd-folder-modal');
		this.titleEl.setText('选择书库文件夹');
		this.contentEl.empty();
		const tree = this.contentEl.createDiv({ cls: 'rd-folder-modal__tree', attr: { role: 'tree', 'aria-label': '库内文件夹' } });
		this.renderChildren(tree, this.tree, 0);
		this.status = this.contentEl.createDiv({ cls: 'rd-folder-modal__status', attr: { role: 'status' } });
		this.updateStatus();
		const actions = this.contentEl.createDiv({ cls: 'rd-folder-modal__actions' });
		const cancel = actions.createEl('button', { cls: 'rd-folder-modal__button', text: '取消' });
		cancel.type = 'button';
		cancel.addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', { cls: 'rd-folder-modal__button rd-folder-modal__button--primary', text: '确定' });
		confirm.type = 'button';
		confirm.addEventListener('click', () => {
			this.onConfirm([...this.selected].sort());
			this.close();
		});
	}

	private renderChildren(container: HTMLElement, node: FolderTreeNode, depth: number): void {
		for (const child of node.children) {
			const hasChildren = child.children.length > 0;
			const expanded = hasChildren && this.expanded.has(child.path);
			const row = container.createDiv({ cls: 'rd-folder-modal__row', attr: { role: 'treeitem' } });
			row.setAttribute('aria-expanded', hasChildren ? String(expanded) : 'none');
			row.style.paddingInlineStart = `${depth * 18 + 6}px`;
			const caret = row.createSpan({ cls: 'rd-folder-modal__caret', attr: { 'aria-hidden': 'true' } });
			if (hasChildren) {
				setIcon(caret, expanded ? 'chevron-down' : 'chevron-right');
				caret.addEventListener('click', () => {
					if (this.expanded.has(child.path)) this.expanded.delete(child.path);
					else this.expanded.add(child.path);
					this.renderTree();
				});
			}
			const label = row.createEl('label', { cls: 'rd-folder-modal__label' });
			const checkbox = label.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.selected.has(child.path);
			checkbox.setAttribute('aria-label', `选择文件夹 ${child.path}`);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) this.selected.add(child.path);
				else this.selected.delete(child.path);
				this.updateStatus();
			});
			label.createSpan({ cls: 'rd-folder-modal__name', text: child.name });
			if (expanded) this.renderChildren(container, child, depth + 1);
		}
	}

	private renderTree(): void {
		const tree = this.contentEl.querySelector<HTMLElement>('.rd-folder-modal__tree');
		if (!tree) return;
		tree.replaceChildren();
		this.renderChildren(tree, this.tree, 0);
	}

	private updateStatus(): void {
		this.status?.setText(`已选 ${this.selected.size} 个文件夹`);
	}
}
