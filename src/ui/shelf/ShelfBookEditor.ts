import type { LibraryBook } from '../../types/contracts';
import type { ShelfBookContext } from './ShelfBooks';
import type { ShelfBookField } from './ShelfBookDrafts';
import type { BookPatch } from './ShelfHost';
import { button, element } from './ShelfDom';

/** Restores the draft before binding a replacement control after shelf repaint. */
export function bindBookEditor(control: HTMLInputElement | HTMLSelectElement, wrapper: HTMLElement, book: LibraryBook, field: ShelfBookField, context: ShelfBookContext, patch: (value: string) => BookPatch, onCancel?: () => void): void {
	const original = control.value; let cancelled = false;
	control.value = context.drafts.value(book.id, field, original);
	control.dataset.editor = context.drafts.key(book.id, field);
	const feedback = element('span', 'rd-setting-save-status');
	feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
	const save = (): void => {
		if (cancelled) return;
		const draft = context.drafts.read(book.id, field);
		if (!draft && control.value === original) return;
		if (draft?.error && control.value === draft.value) { void context.drafts.retry(book.id, field, context.onChanged); return; }
		const value = control.value;
		void context.drafts.save(book.id, field, value, async () => context.host.updateBook(book.id, patch(value)), context.onChanged);
	};
	const retry = button('重试保存', '重试保存 ' + (control.getAttribute('aria-label') ?? '图书信息'), () => void context.drafts.retry(book.id, field, context.onChanged));
	retry.hidden = true;
	control.addEventListener('input', () => context.drafts.edit(book.id, field, control.value));
	if (control instanceof HTMLInputElement) {
		control.addEventListener('blur', save);
		control.addEventListener('keydown', event => {
			if (event.isComposing) return;
			if (event.key === 'Enter') { event.preventDefault(); control.blur(); }
			if (event.key === 'Escape' && context.drafts.discard(book.id, field)) { event.preventDefault(); cancelled = true; control.value = original; control.blur(); onCancel?.(); }
		});
	} else control.addEventListener('change', save);
	context.drafts.watch(book.id, field, () => {
		const draft = context.drafts.read(book.id, field);
		if (draft && control.value !== draft.value) control.value = draft.value;
		if (draft?.saving) control.setAttribute('aria-busy', 'true'); else control.removeAttribute('aria-busy');
		feedback.className = draft?.error ? 'rd-table-error' : 'rd-setting-save-status';
		feedback.textContent = draft?.error ? '保存失败：' + draft.error : draft?.saving ? '保存中…' : '';
		feedback.hidden = !feedback.textContent; retry.hidden = !draft?.error;
	});
	wrapper.append(feedback, retry);
}
