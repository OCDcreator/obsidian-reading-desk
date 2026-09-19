import type { PdfHighlight } from '../../types/contracts';
import {
	CommentPopoverHost,
	createButton,
	createConfirmDelete,
	errorMessage,
	formatCommentTimestamp,
	HIGHLIGHT_COLORS,
	setBusy,
	targetLabel,
	watchSwatchContrast
} from './CommentUiTypes';

export interface CommentPopoverOptions {
	highlight: PdfHighlight;
	onClose?: () => void;
}

const FAILURE_NEXT_STEP = '请重试；若持续失败，请关闭后重新打开此评论框。';

/** A host-driven annotation popover that never reads or writes vault state itself. */
export class CommentPopover {
	private container: HTMLElement | null = null;
	private options: CommentPopoverOptions | null = null;
	private error = '';
	private stopSwatchWatcher: (() => void) | null = null;
	private liveRegion: HTMLParagraphElement | null = null;

	constructor(private readonly host: CommentPopoverHost) { }

	open(container: HTMLElement, options: CommentPopoverOptions): void {
		this.container = container;
		this.options = options;
		this.error = '';
		this.render();
	}

	close(): void {
		this.stopSwatchWatcher?.();
		this.stopSwatchWatcher = null;
		this.container?.replaceChildren();
		this.options?.onClose?.();
		this.container = null;
		this.options = null;
	}

	private render(): void {
		if (!this.container || !this.options) return;
		this.stopSwatchWatcher?.();
		this.stopSwatchWatcher = null;
		const { highlight } = this.options;
		const root = document.createElement('section');
		root.className = 'rd-comment-popover';
		root.tabIndex = -1;
		root.setAttribute('role', 'dialog');
		root.setAttribute('aria-label', '高亮评论');
		root.addEventListener('keydown', event => {
			if (event.key === 'Escape') {
				event.preventDefault();
				this.close();
			}
		});

		const heading = document.createElement('h3');
		heading.textContent = '评论与标注';
		const header = document.createElement('div');
		header.className = 'rd-comment-popover__header';
		header.append(heading, createButton('关闭评论', 'rd-button rd-comment-popover__close', () => this.close()));
		root.append(header);
		const excerpt = document.createElement('p');
		excerpt.className = 'rd-comment-popover__excerpt';
		excerpt.textContent = highlight.text || '此高亮没有可显示的原文。';
		root.append(excerpt);
		const target = document.createElement('p');
		target.className = 'rd-comment-popover__target';
		target.textContent = `目标：${targetLabel(highlight)}`;
		root.append(target);

		root.append(this.renderActions(highlight));
		root.append(this.renderColorChoices(highlight));
		root.append(this.renderTags(highlight));
		root.append(this.renderComments(highlight));
		root.append(this.renderComposer(highlight));
		root.append(this.liveMessageNode());
		this.container.replaceChildren(root);
		this.setLiveMessage(this.failureText());
		this.stopSwatchWatcher = watchSwatchContrast(root);
	}

	/**
	 * The alert node survives renders and is mutated in place: replacing a
	 * live-region node on every state change often silences announcements.
	 */
	private liveMessageNode(): HTMLParagraphElement {
		if (!this.liveRegion) {
			this.liveRegion = document.createElement('p');
			this.liveRegion.className = 'rd-error';
			this.liveRegion.setAttribute('role', 'alert');
		}
		return this.liveRegion;
	}

	private failureText(): string {
		return this.error ? `操作失败：${this.error}。${FAILURE_NEXT_STEP}` : '';
	}

	private setLiveMessage(text: string): void {
		if (this.liveRegion && this.liveRegion.textContent !== text) this.liveRegion.textContent = text;
	}

	private renderActions(highlight: PdfHighlight): HTMLElement {
		const actions = document.createElement('div');
		actions.className = 'rd-comment-popover__actions';
		actions.append(createButton('跳转到此高亮', 'rd-button rd-comment-popover__jump', async () => {
			await this.run(() => this.host.jumpToHighlight(highlight));
		}));
		// Deleting a highlight also deletes its linked target excerpt.
		const deletion = createConfirmDelete('删除此高亮', 'rd-button rd-comment-popover__delete-highlight', '确认删除此高亮', async () => {
			await this.run(async () => {
				await this.host.deleteHighlight(highlight.id);
				this.close();
			});
		});
		actions.append(deletion.confirm, deletion.cancel);
		return actions;
	}

	private renderColorChoices(highlight: PdfHighlight): HTMLElement {
		const fieldset = document.createElement('fieldset');
		fieldset.className = 'rd-swatch-group';
		const legend = document.createElement('legend');
		legend.textContent = '高亮颜色';
		fieldset.append(legend);
		for (const option of HIGHLIGHT_COLORS) {
			const button = createButton(`选择${option.label}高亮色`, `rd-swatch rd-swatch--${option.value}`, async () => {
				await this.run(() => this.host.recolorHighlight(highlight.id, option.value));
			});
			button.textContent = option.label;
			button.setAttribute('aria-pressed', String(option.value === highlight.color));
			button.dataset.color = option.value;
			fieldset.append(button);
		}
		return fieldset;
	}

	private renderTags(highlight: PdfHighlight): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-comment-popover__tags';
		const label = document.createElement('label');
		const inputId = `rd-tag-${safeId(highlight.id)}`;
		label.htmlFor = inputId;
		// Same text as the input's accessible name, so the announced label is
		// exactly what sighted users read (WCAG 2.5.3 Label in Name).
		label.textContent = '添加标签';
		section.append(label);
		const input = document.createElement('input');
		input.id = inputId;
		input.type = 'text';
		// Class hook for the shared control chrome and :focus-visible styling.
		input.className = 'rd-comment-popover__tag-input';
		input.placeholder = '输入或选择已有标签';
		input.setAttribute('aria-label', '添加标签');
		const listId = `${inputId}-suggestions`;
		input.setAttribute('list', listId);
		section.append(input);
		const dataList = document.createElement('datalist');
		dataList.id = listId;
		for (const tag of this.host.allTags()) {
			const option = document.createElement('option');
			option.value = tag;
			dataList.append(option);
		}
		section.append(dataList);
		const add = createButton('添加标签', 'rd-button rd-comment-popover__add-tag', async () => {
			const tag = input.value.trim();
			if (!tag || highlight.tags.includes(tag)) return;
			await this.run(() => this.host.setTags(highlight.id, [...highlight.tags, tag]), [add]);
		});
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				add.click();
			}
		});
		section.append(add);
		const tags = document.createElement('div');
		tags.className = 'rd-comment-popover__tag-list';
		if (!highlight.tags.length) {
			tags.textContent = '尚未添加标签。';
		} else {
			for (const tag of highlight.tags) {
				const tagEl = document.createElement('span');
				tagEl.className = 'rd-tag';
				tagEl.textContent = tag;
				const remove = createButton(`删除标签：${tag}`, 'rd-tag__remove', async () => {
					await this.run(() => this.host.setTags(highlight.id, highlight.tags.filter(item => item !== tag)), [remove]);
				});
				tagEl.append(remove);
				tags.append(tagEl);
			}
		}
		section.append(tags);
		return section;
	}

	private renderComments(highlight: PdfHighlight): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-comment-popover__comments';
		const heading = document.createElement('h4');
		heading.textContent = '评论列表';
		section.append(heading);
		const comments = this.host.comments(highlight.id);
		if (!comments.length) {
			const empty = document.createElement('p');
			empty.className = 'rd-empty';
			empty.textContent = '还没有评论。';
			section.append(empty);
			return section;
		}
		const list = document.createElement('ol');
		for (const comment of comments) {
			const item = document.createElement('li');
			item.className = 'rd-comment-popover__comment';
			const content = document.createElement('p');
			content.textContent = comment.content;
			item.append(content);
			if (comment.showTimestamp) {
				const time = document.createElement('time');
				time.dateTime = new Date(comment.createdAt).toISOString();
				time.textContent = formatCommentTimestamp(comment.createdAt);
				item.append(time);
			}
			const deletion = createConfirmDelete('删除', 'rd-button rd-comment-popover__delete-comment', `确认删除评论：${comment.content}`, async () => {
				await this.run(() => this.host.deleteComment(highlight.id, comment.id));
			});
			deletion.confirm.setAttribute('aria-label', `删除评论：${comment.content}`);
			item.append(deletion.confirm, deletion.cancel);
			list.append(item);
		}
		section.append(list);
		return section;
	}

	private renderComposer(highlight: PdfHighlight): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-comment-popover__composer';
		const label = document.createElement('label');
		const inputId = `rd-comment-${safeId(highlight.id)}`;
		label.htmlFor = inputId;
		label.textContent = '新增评论';
		section.append(label);
		const input = document.createElement('textarea');
		input.id = inputId;
		// Class hook for the shared control chrome and :focus-visible styling.
		input.className = 'rd-comment-popover__composer-input';
		input.placeholder = '记录你的想法';
		// Matches the visible 新增评论 label instead of overriding it.
		input.setAttribute('aria-label', '新增评论');
		section.append(input);
		const add = createButton('添加评论', 'rd-button rd-comment-popover__add-comment', async () => {
			const content = input.value.trim();
			if (!content) return;
			await this.run(() => this.host.addComment(highlight.id, content), [add]);
		});
		add.disabled = true;
		input.addEventListener('input', () => { add.disabled = !input.value.trim(); });
		input.addEventListener('keydown', event => {
			if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') add.click();
		});
		section.append(add);
		return section;
	}

	private async run(operation: () => Promise<void> | void, controls: HTMLButtonElement[] = []): Promise<void> {
		for (const control of controls) setBusy(control, true);
		try {
			this.error = '';
			await operation();
			this.render();
		} catch (error) {
			// Mutate the mounted alert instead of re-rendering: the live region
			// must not be replaced, and a rebuild would also wipe the composer
			// draft the user needs for the retry.
			this.error = errorMessage(error);
			this.setLiveMessage(this.failureText());
		} finally {
			for (const control of controls) setBusy(control, false);
		}
	}
}

function safeId(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
