import type { LibraryBook, LibraryList } from '../../types/contracts';
import { button, element, errorMessage, input } from './ShelfDom';
import { ShelfDialog } from './ShelfDialog';
import type { ShelfViewHost } from './ShelfHost';

export function openListManager(root: HTMLElement, trigger: HTMLElement, lists: () => LibraryList[], books: () => LibraryBook[], host: ShelfViewHost, changed: () => Promise<void>): ShelfDialog {
	const dialog = new ShelfDialog(root, '管理阅读列表', trigger);
	const rows = element('div', 'rd-shelf-dialog__body');
	const status = element('p', 'rd-setting-save-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
	let busy = false;
	const drafts = new Map<string, string>();
	const draw = (): void => {
		rows.replaceChildren();
		if (!lists().length) rows.append(element('p', '', '暂无阅读列表，可从书架新建。'));
		for (const list of lists()) {
			const row = element('div', 'rd-batch-field');
			const name = input('text', '阅读列表名称：' + list.name, drafts.get(list.id) ?? list.name);
			name.addEventListener('input', () => drafts.set(list.id, name.value));
			const count = books().filter(book => book.listIds?.includes(list.id)).length;
			const confirmation = element('div', 'rd-batch-field'); confirmation.hidden = true;
			const save = button('保存名称', '保存阅读列表名称：' + list.name, () => void run(async () => {
				if (!name.value.trim()) throw new Error('阅读列表名称不能为空。');
				await host.renameList?.(list.id, name.value.trim()); drafts.delete(list.id);
			}, '阅读列表名称已保存。', name));
			save.disabled = !host.renameList;
			const remove = button('删除列表', '删除阅读列表：' + list.name, () => {
				if (busy) return;
				confirmation.hidden = false; confirm.focus();
			}); remove.disabled = !host.deleteList;
			const confirm = button('确认删除列表', '确认删除阅读列表：' + list.name, () => void run(async () => { if (!confirmation.hidden) { await host.deleteList?.(list.id); drafts.delete(list.id); } }, '阅读列表已删除，图书与标注均保留。'));
			const cancel = button('取消', '取消删除阅读列表：' + list.name, () => { confirmation.hidden = true; remove.focus(); });
			confirmation.append(element('p', '', '将从 ' + count + ' 本图书移除此列表关系。不会删除图书、文件或标注。'), confirm, cancel);
			name.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); save.click(); } });
			row.append(name, element('span', '', count + ' 本'), save, remove, confirmation); rows.append(row);
		}
	};
	const run = async (operation: () => Promise<unknown>, message: string, restore?: HTMLElement): Promise<void> => {
		if (busy) return; busy = true;
		const controls = Array.from(rows.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'));
		const disabled = controls.map(control => control.disabled); controls.forEach(control => { control.disabled = true; });
		status.textContent = '保存中…';
		try { await operation(); await changed(); if (dialog.panel.isConnected) { draw(); status.textContent = message; dialog.focusFirst(); } }
		catch (error) { status.textContent = errorMessage(error); controls.forEach((control, index) => { control.disabled = disabled[index]; }); if (dialog.panel.isConnected) restore?.focus(); }
		finally { busy = false; }
	};
	draw(); dialog.body.append(rows, status); dialog.focusFirst(); return dialog;
}
