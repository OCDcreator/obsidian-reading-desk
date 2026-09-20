import type { LibraryBook, LibraryCategory } from '../../types/contracts';
import { bindInlineInput, button, element, errorMessage, showActionMenu } from './ShelfDom';
import { categoryBookCount } from './ShelfViewModel';

export interface CategoryChipsHost {
	books: LibraryBook[];
	categories: LibraryCategory[];
	selectedId?: string;
	onSelect(id?: string): void;
	addCategory(name: string): Promise<void>;
	renameCategory(id: string, name: string): Promise<void>;
	removeCategory(id: string): Promise<void>;
	reorderCategories(ids: string[]): Promise<void>;
	notify(message: string): void;
}

/** 分类 chips 行：数量、选中 accent 描边、行尾「+」新建、右键重排/改名/删除。 */
export function createCategoryChips(host: CategoryChipsHost): HTMLElement {
	const chips = element('div', 'rd-category-chips');
	chips.setAttribute('role', 'group');
	chips.setAttribute('aria-label', '分类筛选');
	chips.append(categoryChip(host, undefined, `全部 ${host.books.length}`));
	host.categories.forEach((category, index) => {
		const chip = categoryChip(host, category.id, `${category.name} ${categoryBookCount(host.books, category.id)}`);
		const openMenu = (event: Event): void => {
			event.preventDefault();
			openChipMenu(chip, category, index, host);
		};
		chip.addEventListener('contextmenu', openMenu);
		/* The context-menu key (and Shift+F10) reach the same actions from the keyboard. */
		chip.addEventListener('keydown', event => {
			if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) openMenu(event);
		});
		chips.append(chip);
	});
	chips.append(createChip(host));
	const panel = element('section', 'rd-category-panel');
	panel.setAttribute('aria-label', '图书分类');
	panel.append(chips);
	return panel;
}

function categoryChip(host: CategoryChipsHost, categoryId: string | undefined, label: string): HTMLButtonElement {
	const control = button(label, `按${label}筛选`, () => host.onSelect(categoryId));
	control.classList.add('rd-category-chip');
	control.setAttribute('aria-pressed', String(host.selectedId === categoryId));
	if (host.selectedId === categoryId) control.classList.add('is-selected');
	return control;
}

/** 行尾「+」：点击后就地变成输入框，Enter 新建、Esc 取消。 */
function createChip(host: CategoryChipsHost): HTMLElement {
	const create = button('新建分类', '新建分类', () => beginChipEdit(create, '', name => {
		if (!name) return Promise.resolve();
		return host.addCategory(name);
	}, host));
	create.classList.add('rd-category-chip', 'rd-category-chip-add');
	create.textContent = '+';
	return create;
}

function openChipMenu(chipNode: HTMLElement, category: LibraryCategory, index: number, host: CategoryChipsHost): void {
	const count = categoryBookCount(host.books, category.id);
	showActionMenu(chipNode, [
		{ label: '改名', onClick: () => beginChipEdit(chipNode, category.name, name => host.renameCategory(category.id, name), host) },
		{ label: '上移', onClick: () => moveCategory(category.id, index, -1, host) },
		{ label: '下移', onClick: () => moveCategory(category.id, index, 1, host) },
		{
			label: '删除',
			danger: true,
			confirm: count > 0 ? `删除后 ${count} 本书变为未分类` : undefined,
			onClick: () => void removeCategory(category, host)
		}
	]);
}

async function removeCategory(category: LibraryCategory, host: CategoryChipsHost): Promise<void> {
	try {
		await host.removeCategory(category.id);
		host.notify(`已删除分类「${category.name}」。`);
	} catch (error) {
		host.notify(errorMessage(error, '无法删除分类'));
	}
}

async function moveCategory(id: string, index: number, offset: number, host: CategoryChipsHost): Promise<void> {
	const ids = host.categories.map(category => category.id);
	const target = index + offset;
	if (target < 0 || target >= ids.length) return;
	[ids[index], ids[target]] = [ids[target], ids[index]];
	try {
		await host.reorderCategories(ids);
	} catch (error) {
		host.notify(errorMessage(error, '无法调整分类顺序'));
	}
}

function beginChipEdit(current: HTMLElement, initial: string, commit: (name: string) => Promise<void>, host: CategoryChipsHost): void {
	const input = current.ownerDocument.createElement('input');
	input.type = 'text';
	input.className = 'rd-chip-input';
	input.value = initial;
	input.placeholder = '分类名称';
	input.setAttribute('aria-label', initial ? '重命名分类' : '新分类名称');
	current.replaceWith(input);
	input.focus();
	if (initial) input.select();
	bindInlineInput(input, () => {
		const name = input.value.trim();
		if (!name || name === initial) {
			input.replaceWith(current);
			return;
		}
		commit(name).catch(error => {
			host.notify(errorMessage(error, '无法保存分类'));
			input.replaceWith(current);
		});
	});
}
