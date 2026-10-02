import { createReaderButton } from './ReaderPageControl';
import type { ReaderPersistenceController } from './ReaderPersistenceController';
/** Inline native controls keep naming, errors and retry next to the saved positions. */
export function renderReaderBookmarks(parent: HTMLElement, state: ReaderPersistenceController, label: (page: number) => string): void {
	parent.createEl('h2', { text: '书签' });
	const entry = parent.createDiv({ cls: 'rd-reader-bookmark-entry' });
	const name = entry.createEl('input', { type: 'text', cls: 'rd-input', attr: { 'aria-label': '新书签名称', placeholder: '为当前位置命名', maxlength: '160' } });
	const status = parent.createEl('p', { cls: 'rd-empty', attr: { role: 'status', 'aria-live': 'polite' } });
	const list = parent.createDiv();
	const run = async (action: () => Promise<void>, success: string, after?: () => void): Promise<void> => {
		try { await action(); status.textContent = success; refresh(); after?.(); }
		catch (error) { status.textContent = error instanceof Error ? error.message : '书签未保存，请重试。'; }
	};
	const add = createReaderButton(entry, '添加书签', () => void run(() => state.addBookmark(name.value), '书签已保存。', () => { name.value = ''; name.focus(); }));
	add.disabled = !state.available(); name.disabled = !state.available();
	createReaderButton(parent, '重试保存阅读位置', () => void state.flush());
	function refresh(): void {
		list.replaceChildren();
		const bookmarks = state.bookmarks();
		if (!bookmarks.length) list.createEl('p', { cls: 'rd-empty', text: state.available() ? '尚无书签。可将当前阅读位置保存到这里。' : '将此 PDF 加入书库后即可保存书签。' });
		for (const bookmark of bookmarks) {
			const row = list.createDiv({ cls: 'rd-reader-bookmark-entry' });
			const jump = createReaderButton(row, `${bookmark.name} · ${label(bookmark.position.page + 1)}`, () => void run(() => state.jumpBookmark(bookmark.id), '已到达书签位置。'));
			jump.title = jump.textContent ?? '';
			const input = row.createEl('input', { type: 'text', cls: 'rd-input', value: bookmark.name, attr: { 'aria-label': `重命名书签 ${bookmark.name}`, maxlength: '160' } });
			createReaderButton(row, '保存名称', () => void run(() => state.renameBookmark(bookmark.id, input.value), '书签名称已保存。', () => name.focus()));
			createReaderButton(row, '删除书签', () => void run(() => state.removeBookmark(bookmark.id), '书签已删除。', () => name.focus()));
		}
	}
	name.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); add.click(); } });
	refresh();
}
