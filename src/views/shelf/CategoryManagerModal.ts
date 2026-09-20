import type { LibraryBook, LibraryCategory } from '../../types/contracts';
import { bindInlineInput, button, documentInput, element, errorMessage } from './ShelfDom';
import { categoryBookCount } from './ShelfViewModel';

export interface CategoryManagerHost {
	books: LibraryBook[];
	categories: LibraryCategory[];
	addCategory(name: string): Promise<void>;
	renameCategory(id: string, name: string): Promise<void>;
	removeCategory(id: string): Promise<void>;
	reorderCategories(ids: string[]): Promise<void>;
	notify(message: string): void;
	/** Called after every successful write so the shelf underneath stays in sync. */
	refresh(): Promise<void>;
}

/** 集中式分类管理面板：列表式重排/改名/删除，与 chips 右键共用同一套 LibraryIndex 写路径。 */
export function openCategoryManager(host: CategoryManagerHost): void {
	const document = window.document;
	const scrim = element('div', 'rd-modal-scrim');
	const dialog = element('div', 'rd-category-modal');
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-label', '管理分类');
	dialog.tabIndex = -1;
	const close = (): void => scrim.remove();
	const guarded = (work: () => Promise<void>): void => {
		void work().then(() => host.refresh()).catch(error => host.notify(errorMessage(error, '无法保存分类')));
	};
	const renderList = (): void => {
		const list = dialog.querySelector('.rd-category-modal-list');
		if (!list) return;
		list.replaceChildren();
		if (host.categories.length === 0) {
			list.append(element('p', 'rd-category-modal-empty', '还没有分类。在下方输入名称新建一个。'));
			return;
		}
		host.categories.forEach((category, index) => list.append(categoryRow(category, index, host, guarded, renderList)));
	};
	const heading = element('div', 'rd-category-modal-heading');
	heading.append(element('h2', 'rd-category-modal-title', '管理分类'));
	const closeButton = button('关闭', '关闭分类管理面板', close);
	closeButton.classList.add('rd-category-modal-close');
	heading.append(closeButton);
	dialog.append(heading, element('p', 'rd-category-modal-desc', '重排、改名或删除分类；删除分类不会删除图书，只会把它们变为未分类。'));
	const list = element('ol', 'rd-category-modal-list');
	list.setAttribute('aria-label', '分类列表');
	dialog.append(list);
	const createRow = element('div', 'rd-category-modal-create');
	const input = documentInput('text', '新分类名称');
	input.setAttribute('aria-label', '新分类名称');
	const add = async (): Promise<void> => {
		const name = input.value.trim();
		if (!name) return;
		await host.addCategory(name);
		input.value = '';
		await host.refresh();
		renderList();
	};
	input.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			guarded(add);
		}
	});
	createRow.append(input, button('新建', '新建分类', () => guarded(add)));
	dialog.append(createRow);
	scrim.append(dialog);
	scrim.addEventListener('click', event => {
		if (event.target === scrim) close();
	});
	scrim.addEventListener('keydown', event => {
		if (event.key === 'Escape') close();
	});
	document.body.append(scrim);
	renderList();
	dialog.focus();
}

function categoryRow(
	category: LibraryCategory,
	index: number,
	host: CategoryManagerHost,
	guarded: (work: () => Promise<void>) => void,
	renderList: () => void
): HTMLElement {
	const row = element('li', 'rd-category-modal-row');
	const name = element('span', 'rd-category-modal-name', category.name);
	const count = categoryBookCount(host.books, category.id);
	const actions = element('span', 'rd-category-modal-actions');
	const rename = button('改名', `重命名 ${category.name}`, () => {
		const input = name.ownerDocument.createElement('input');
		input.type = 'text';
		input.className = 'rd-chip-input';
		input.value = category.name;
		input.setAttribute('aria-label', `重命名 ${category.name}`);
		name.replaceWith(input);
		input.focus();
		input.select();
		bindInlineInput(input, () => {
			const value = input.value.trim();
			if (!value || value === category.name) {
				input.replaceWith(name);
				return;
			}
			guarded(async () => {
				await host.renameCategory(category.id, value);
				renderList();
			});
		});
	});
	const move = (offset: number): (() => void) => () => {
		const ids = host.categories.map(item => item.id);
		const target = index + offset;
		if (target < 0 || target >= ids.length) return;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		guarded(async () => {
			await host.reorderCategories(ids);
			renderList();
		});
	};
	const up = button('上移', `上移 ${category.name}`, move(-1));
	const down = button('下移', `下移 ${category.name}`, move(1));
	up.disabled = index === 0;
	down.disabled = index === host.categories.length - 1;
	const remove = button('删除', `删除 ${category.name}`, () => {
		if (!remove.classList.contains('is-armed')) {
			remove.classList.add('is-armed');
			remove.textContent = count > 0 ? `确认删除（${count} 本变未分类）` : '确认删除';
			window.setTimeout(() => {
				remove.classList.remove('is-armed');
				remove.textContent = '删除';
			}, 3000);
			return;
		}
		guarded(async () => {
			await host.removeCategory(category.id);
			host.notify(`已删除分类「${category.name}」。`);
			renderList();
		});
	});
	remove.classList.add('is-danger');
	actions.append(rename, up, down, remove, element('span', 'rd-category-modal-count', `${count} 本`));
	row.append(name, actions);
	return row;
}
