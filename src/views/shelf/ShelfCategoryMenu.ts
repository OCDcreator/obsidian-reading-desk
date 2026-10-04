import type { LibraryCategory } from '../../types/contracts';
import type { ShelfViewHost } from '../../ui/shelf/ShelfHost';
import { button, element, errorMessage, input } from '../../ui/shelf/ShelfDom';

/** Per-leaf menu; uses the same LibraryIndex callbacks as the live category manager. */
export function openShelfCategoryMenu(root: HTMLElement, anchor: HTMLElement, category: LibraryCategory, categories: LibraryCategory[], host: ShelfViewHost, refresh: () => Promise<void>): () => void {
	const menu = element('div', 'rd-action-menu'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', category.name + ' 分类操作');
	const status = element('span', 'rd-table-error'); status.setAttribute('role', 'alert');
	const close = (): void => { menu.remove(); anchor.focus(); };
	const run = async (operation: () => unknown): Promise<void> => { try { await operation(); await refresh(); close(); } catch (error) { status.textContent = errorMessage(error); } };
	if (host.renameCategory) menu.append(button('改名', '改名分类 ' + category.name, () => {
		const field = input('text', '分类名称 ' + category.name, category.name); const save = button('保存', '保存分类名称 ' + category.name, () => void run(() => host.renameCategory?.(category.id, field.value.trim())));
		menu.setAttribute('role', 'dialog'); menu.replaceChildren(field, save, button('取消', '取消分类改名', close), status); for (const control of Array.from(menu.querySelectorAll('button'))) control.classList.add('rd-action-menu-item'); field.focus();
	}));
	const index = categories.findIndex(item => item.id === category.id);
	for (const [offset, label] of [[-1, '上移'], [1, '下移']] as const) {
		const move = button(label, label + '分类 ' + category.name, () => { const ids = categories.map(item => item.id); [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]]; void run(() => host.reorderCategories(ids)); });
		move.disabled = index + offset < 0 || index + offset >= categories.length; menu.append(move);
	}
	if (host.removeCategory) { let armed = false; const remove = button('删除', '删除分类 ' + category.name, () => {
		if (!armed) { armed = true; remove.textContent = '确认删除分类，图书保留'; return; } void run(() => host.removeCategory?.(category.id));
	}); menu.append(remove); }
	menu.append(button('关闭', '关闭分类操作', close), status); const rect = anchor.getBoundingClientRect(); menu.style.left = rect.left + 'px'; menu.style.top = rect.bottom + 4 + 'px';
	menu.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); return; }
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || menu.getAttribute('role') !== 'menu') return;
		const controls = Array.from(menu.querySelectorAll<HTMLButtonElement>('button')).filter(control => !control.disabled); const index = controls.findIndex(control => control === menu.ownerDocument.activeElement);
		event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length; controls[next]?.focus(); }); for (const control of Array.from(menu.querySelectorAll('button'))) { control.classList.add('rd-action-menu-item'); control.setAttribute('role', 'menuitem'); } root.ownerDocument.body.append(menu); menu.querySelector<HTMLButtonElement>('button')?.focus(); return () => menu.remove();
}
