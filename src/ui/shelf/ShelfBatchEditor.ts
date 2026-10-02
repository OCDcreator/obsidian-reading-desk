import type { LibraryBook, LibraryCategory, LibraryList, ReadingStatus } from '../../types/contracts';
import { parseTags } from '../../views/shelf/ShelfViewModel';
import { button, element, errorMessage, field, input, select } from './ShelfDom';
import { ShelfDialog } from './ShelfDialog';
import type { ShelfBatchPatch, ShelfViewHost } from './ShelfHost';
import { STATUS_LABELS } from './ShelfQuery';
export function openBatchEditor(root: HTMLElement, trigger: HTMLElement, books: LibraryBook[], categories: LibraryCategory[], lists: LibraryList[], host: ShelfViewHost, changed: () => Promise<void>): ShelfDialog {
	const dialog = new ShelfDialog(root, '批量整理 ' + books.length + ' 本图书', trigger);
	const body = dialog.body;
	body.append(element('p', '', '仅更新下面启用的字段；追加保留原有内容，替换会清空后写入新内容。选择会跨页保留。'));
	const tags = input('text', '批量标签');
	const tagMode = select('标签操作', [['append', '追加标签'], ['replace', '替换全部标签'], ['remove', '移除指定标签']]);
	const category = select('批量分类', [['', '未分类'], ...categories.map(item => [item.id, item.name] as [string, string])]);
	const status = select('批量阅读状态', Object.entries(STATUS_LABELS));
	const list = select('批量阅读列表', [['', '不选择列表'], ...lists.map(item => [item.id, item.name] as [string, string])]);
	const listMode = select('列表操作', [['append', '追加到列表'], ['replace', '替换全部列表'], ['remove', '从列表移除']]);
	const enableTags = enabledField(body, '修改标签', tags, tagMode);
	const enableCategory = enabledField(body, '修改分类', category);
	const enableStatus = enabledField(body, '修改状态', status);
	const enableList = enabledField(body, '修改阅读列表', list, listMode);
	const summary = element('p', 'rd-batch-preview'); summary.setAttribute('aria-live', 'polite');
	const updatePreview = (): void => {
		const changes: string[] = [];
		if (enableTags.checked) changes.push(tagMode.selectedOptions[0].text + '：' + (parseTags(tags.value).join('、') || '空标签'));
		if (enableCategory.checked) changes.push('分类设为：' + category.selectedOptions[0].text);
		if (enableStatus.checked) changes.push('状态设为：' + status.selectedOptions[0].text);
		if (enableList.checked) changes.push(listMode.selectedOptions[0].text + '：' + (list.value ? list.selectedOptions[0].text : '空列表'));
		summary.textContent = changes.length ? books.length + ' 本：' + changes.join('；') : '尚未启用修改字段。';
		apply.disabled = !host.batchUpdate || changes.length === 0;
	};
	const feedback = element('p', 'rd-setting-save-status'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
	const apply = button('确认应用', '确认批量修改 ' + books.length + ' 本图书', async () => {
		const patch: ShelfBatchPatch = {};
		if (enableTags.checked) { patch.tags = parseTags(tags.value); patch.tagMode = tagMode.value as ShelfBatchPatch['tagMode']; }
		if (enableCategory.checked) patch.categoryId = category.value || null;
		if (enableStatus.checked) patch.readingStatus = status.value as ReadingStatus;
		if (enableList.checked) { patch.listIds = list.value ? [list.value] : []; patch.listMode = listMode.value as ShelfBatchPatch['listMode']; }
		if ((enableTags.checked && tagMode.value !== 'replace' && !patch.tags?.length) || (enableList.checked && listMode.value !== 'replace' && !list.value)) {
			feedback.textContent = '追加或移除操作需要指定标签或列表。'; return;
		}
		apply.disabled = true; feedback.textContent = '保存中…'; body.setAttribute('aria-busy', 'true');
		try { await host.batchUpdate?.(books.map(book => book.id), patch); await changed(); dialog.close(); }
		catch (error) { feedback.textContent = errorMessage(error, '批量保存失败，请重试'); apply.disabled = false; apply.textContent = '重试应用'; }
		finally { body.removeAttribute('aria-busy'); }
	});
	body.addEventListener('change', updatePreview); body.addEventListener('input', updatePreview);
	body.append(summary, feedback, apply); updatePreview(); dialog.focusFirst(); return dialog;
}
function enabledField(parent: HTMLElement, label: string, ...controls: HTMLElement[]): HTMLInputElement {
	const wrapper = element('div', 'rd-batch-field'); const enabled = input('checkbox', label);
	wrapper.append(field(label, enabled), ...controls); parent.append(wrapper); return enabled;
}
