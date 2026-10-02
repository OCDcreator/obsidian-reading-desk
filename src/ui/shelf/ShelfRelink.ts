import type { LibraryBook } from '../../types/contracts';
import { button, element, errorMessage, field, select } from './ShelfDom';
import { ShelfDialog } from './ShelfDialog';
import type { ShelfViewHost } from './ShelfHost';
export function openRelinkDialog(root: HTMLElement, trigger: HTMLElement, book: LibraryBook, host: ShelfViewHost, changed: () => Promise<void>): ShelfDialog {
	const dialog = new ShelfDialog(root, '重新关联源文件', trigger);
	dialog.body.append(element('p', '', book.title), element('p', 'rd-relink-path', '原路径：' + book.path), element('p', '', '选择同一本书的文件。确认后保留图书 ID、进度和标注，由宿主更新引用。'));
	const status = element('p', 'rd-setting-save-status', '正在读取候选文件…'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
	const candidate = select('候选源文件', [['', '请选择文件']]); candidate.disabled = true;
	const preview = element('p', 'rd-relink-path', '尚未选择候选文件。');
	const confirm = button('确认重新关联', '确认重新关联源文件', async () => {
		if (!candidate.value || !host.relinkBook) return;
		confirm.disabled = true; candidate.disabled = true; status.textContent = '正在关联并更新标注引用…';
		try { await host.relinkBook(book.id, candidate.value); await changed(); dialog.close(); }
		catch (error) { status.textContent = errorMessage(error, '关联失败，请重试'); confirm.disabled = false; candidate.disabled = false; }
	}); confirm.disabled = true;
	candidate.addEventListener('change', () => { preview.textContent = candidate.value ? '将关联到：' + candidate.value : '尚未选择候选文件。'; confirm.disabled = !candidate.value || !host.relinkBook; });
	const load = async (): Promise<void> => {
		status.textContent = '正在读取候选文件…';
		try {
			const files = host.candidateFiles ? await host.candidateFiles() : (await host.listSourcePaths?.() ?? []).map(path => ({ path }));
			candidate.replaceChildren(); const blank = element('option', '', '请选择文件'); blank.value = ''; candidate.append(blank);
			if (!dialog.panel.isConnected) return;
			for (const file of files.filter(file => file.path !== book.path && file.path.toLowerCase().endsWith('.' + book.format))) {
				const option = element('option', '', file.path); option.value = file.path; candidate.append(option);
			}
			candidate.disabled = false; status.textContent = candidate.options.length > 1 ? '请核对新路径，点击确认后才会修改。' : '没有同格式候选文件。添加文件后可重试。'; candidate.focus();
		} catch (error) { status.textContent = errorMessage(error, '无法读取候选文件，请重试'); }
	};
	dialog.body.append(field('候选文件', candidate), preview, status, button('刷新候选', '重新读取候选文件', () => void load()), confirm);
	void load(); return dialog;
}
