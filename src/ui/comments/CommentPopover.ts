import { setIcon } from 'obsidian';
import type { PdfHighlight } from '../../types/contracts';
import { TagCombobox } from './TagCombobox';
import {
	CommentPopoverHost,
	colorLabel,
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
	private tagCombo: TagCombobox | null = null;
	private reopenTags = false;

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
		this.tagCombo?.dispose();
		this.tagCombo = null;
		this.container?.replaceChildren();
		this.options?.onClose?.();
		this.container = null;
		this.options = null;
	}

	private render(): void {
		if (!this.container || !this.options) return;
		this.stopSwatchWatcher?.();
		this.stopSwatchWatcher = null;
		this.tagCombo?.dispose();
		this.tagCombo = null;
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

		const titles = document.createElement('div');
		titles.className = 'rd-comment-popover__titles';
		const heading = document.createElement('h3');
		heading.className = 'rd-comment-popover__heading';
		heading.textContent = '评论与标注';
		const target = document.createElement('p');
		target.className = 'rd-comment-popover__target';
		target.textContent = `目标：${targetLabel(highlight)}`;
		titles.append(heading, target);
		const closeButton = createButton('关闭评论', 'rd-button rd-button--ghost rd-button--icon rd-comment-popover__close', () => this.close());
		closeButton.textContent = '';
		setIcon(closeButton, 'x');
		const header = document.createElement('div');
		header.className = 'rd-comment-popover__header';
		header.append(titles, closeButton);
		root.append(header);

		const body = document.createElement('div');
		body.className = 'rd-comment-popover__body';
		body.append(this.renderExcerpt(highlight));
		body.append(this.renderActions(highlight));
		body.append(this.renderSeparator());
		body.append(this.renderColorChoices(highlight));
		body.append(this.renderSeparator());
		body.append(this.renderTags(highlight));
		body.append(this.renderSeparator());
		body.append(this.renderComments(highlight));
		root.append(body);

		root.append(this.renderComposer(highlight));
		root.append(this.liveMessageNode());
		this.container.replaceChildren(root);
		this.setLiveMessage(this.failureText());
		this.stopSwatchWatcher = watchSwatchContrast(root);
		if (this.reopenTags) {
			this.reopenTags = false;
			this.tagCombo?.focusAndOpen();
		}
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

	private renderSeparator(): HTMLElement {
		const separator = document.createElement('hr');
		separator.className = 'rd-comment-popover__sep';
		return separator;
	}

	private renderExcerpt(highlight: PdfHighlight): HTMLElement {
		const excerpt = document.createElement('p');
		excerpt.className = 'rd-comment-popover__excerpt';
		// The colour bar follows the current highlight colour via data-color rules.
		excerpt.dataset.color = highlight.color;
		excerpt.textContent = highlight.text || '此高亮没有可显示的原文。';
		return excerpt;
	}

	private renderActions(highlight: PdfHighlight): HTMLElement {
		const actions = document.createElement('div');
		actions.className = 'rd-comment-popover__actions';
		const jump = createButton('跳转到此高亮', 'rd-button rd-button--outline rd-button--sm rd-comment-popover__jump', async () => {
			await this.run(() => this.host.jumpToHighlight(highlight));
		});
		jump.textContent = '';
		setIcon(jump, 'arrow-up-right');
		const jumpLabel = document.createElement('span');
		jumpLabel.textContent = '跳转到此高亮';
		jump.append(jumpLabel);
		actions.append(jump);
		// Deleting a highlight also deletes its linked target excerpt.
		const deletion = createConfirmDelete('删除此高亮', 'rd-button rd-button--ghost-danger rd-button--sm rd-comment-popover__delete-highlight', '确认删除此高亮', async () => {
			await this.run(async () => {
				await this.host.deleteHighlight(highlight.id);
				this.close();
			});
		});
		deletion.cancel.className = 'rd-button rd-button--outline rd-button--sm';
		actions.append(deletion.confirm, deletion.cancel);
		return actions;
	}

	private renderColorChoices(highlight: PdfHighlight): HTMLElement {
		const fieldset = document.createElement('fieldset');
		fieldset.className = 'rd-swatch-group';
		const legend = document.createElement('legend');
		legend.textContent = '高亮颜色';
		// The row wrapper keeps the legend on its own line: a flexed fieldset
		// pulls the rendered legend into the item flow and it overlaps swatches.
		const row = document.createElement('div');
		row.className = 'rd-swatch-group__row';
		fieldset.append(legend, row);
		for (const option of HIGHLIGHT_COLORS) {
			const button = createButton(`选择${option.label}高亮色`, `rd-swatch rd-swatch--${option.value}`, async () => {
				await this.run(() => this.host.recolorHighlight(highlight.id, option.value));
			});
			// Circle swatches carry no visible label; the check mark inherits the
			// WCAG foreground that applySwatchContrast writes inline.
			button.textContent = '';
			setIcon(button, 'check');
			button.setAttribute('aria-pressed', String(option.value === highlight.color));
			button.dataset.color = option.value;
			row.append(button);
		}
		const name = document.createElement('span');
		name.className = 'rd-comment-popover__color-name';
		name.textContent = colorLabel(highlight.color);
		row.append(name);
		return fieldset;
	}

	private renderTags(highlight: PdfHighlight): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-comment-popover__tags';
		const label = document.createElement('label');
		const inputId = `rd-tag-${safeId(highlight.id)}`;
		label.htmlFor = inputId;
		label.className = 'rd-comment-popover__label';
		label.textContent = '标签';
		section.append(label);

		const row = document.createElement('div');
		row.className = 'rd-comment-popover__tag-row';
		const combo = new TagCombobox({
			inputId,
			inputLabel: '添加标签',
			placeholder: '输入或选择已有标签',
			allTags: () => this.host.allTags(),
			exclude: () => this.options?.highlight.tags ?? [],
			onPick: tag => { void this.addTag(highlight, tag); }
		});
		this.tagCombo = combo;
		const add = createButton('添加', 'rd-button rd-button--secondary rd-button--sm rd-comment-popover__add-tag', async () => {
			await this.addTag(highlight, combo.currentValue(), [add]);
		});
		row.append(combo.element, add);
		section.append(row);

		const tags = document.createElement('div');
		tags.className = 'rd-comment-popover__tag-list';
		if (!highlight.tags.length) {
			tags.textContent = '尚未添加标签。';
		} else {
			for (const tag of highlight.tags) {
				const tagEl = document.createElement('span');
				tagEl.className = 'rd-tag';
				const tagText = document.createElement('span');
				tagText.textContent = tag;
				tagEl.append(tagText);
				const remove = createButton(`删除标签：${tag}`, 'rd-tag__remove', async () => {
					await this.run(() => this.host.setTags(highlight.id, highlight.tags.filter(item => item !== tag)), [remove]);
				});
				remove.textContent = '';
				setIcon(remove, 'x');
				tagEl.append(remove);
				tags.append(tagEl);
			}
		}
		section.append(tags);
		return section;
	}

	private async addTag(highlight: PdfHighlight, value: string, controls: HTMLButtonElement[] = []): Promise<void> {
		const tag = value.trim();
		if (!tag || highlight.tags.includes(tag)) return;
		// The re-render replaces the combobox; reopen it so tagging can continue.
		this.reopenTags = true;
		await this.run(() => this.host.setTags(highlight.id, [...highlight.tags, tag]), controls);
	}

	private renderComments(highlight: PdfHighlight): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-comment-popover__comments';
		const comments = this.host.comments(highlight.id);
		const header = document.createElement('div');
		header.className = 'rd-comment-popover__comments-header';
		const heading = document.createElement('h4');
		heading.textContent = '评论';
		const count = document.createElement('span');
		count.className = 'rd-comment-popover__count';
		count.textContent = `${comments.length} 条`;
		header.append(heading, count);
		section.append(header);
		if (!comments.length) {
			const empty = document.createElement('div');
			empty.className = 'rd-comment-popover__empty';
			const icon = document.createElement('span');
			icon.className = 'rd-comment-popover__empty-icon';
			empty.append(icon);
			setIcon(icon, 'message-square');
			const text = document.createElement('p');
			text.textContent = '还没有评论，在下方写下第一条想法。';
			empty.append(text);
			section.append(empty);
			return section;
		}
		const list = document.createElement('ol');
		for (const comment of comments) {
			const item = document.createElement('li');
			item.className = 'rd-comment-popover__comment';
			const content = document.createElement('p');
			content.textContent = comment.content;
			const meta = document.createElement('div');
			meta.className = 'rd-comment-popover__comment-meta';
			if (comment.showTimestamp) {
				const time = document.createElement('time');
				time.dateTime = new Date(comment.createdAt).toISOString();
				time.textContent = formatCommentTimestamp(comment.createdAt);
				meta.append(time);
			} else {
				meta.append(document.createElement('span'));
			}
			const deletion = createConfirmDelete('删除', 'rd-button rd-button--ghost-danger rd-button--sm rd-comment-popover__delete-comment', `确认删除评论：${comment.content}`, async () => {
				await this.run(() => this.host.deleteComment(highlight.id, comment.id));
			});
			deletion.confirm.setAttribute('aria-label', `删除评论：${comment.content}`);
			deletion.cancel.className = 'rd-button rd-button--outline rd-button--sm';
			meta.append(deletion.confirm, deletion.cancel);
			item.append(content, meta);
			list.append(item);
		}
		section.append(list);
		return section;
	}

	private renderComposer(highlight: PdfHighlight): HTMLElement {
		const section = document.createElement('section');
		section.className = 'rd-comment-popover__composer';
		const input = document.createElement('textarea');
		input.id = `rd-comment-${safeId(highlight.id)}`;
		// Class hook for the shared control chrome and :focus-visible styling.
		input.className = 'rd-comment-popover__composer-input';
		input.placeholder = '记录你的想法';
		input.setAttribute('aria-label', '新增评论');
		section.append(input);

		const row = document.createElement('div');
		row.className = 'rd-comment-popover__composer-row';
		const hint = document.createElement('span');
		hint.className = 'rd-comment-popover__composer-hint';
		const modifier = document.createElement('kbd');
		modifier.textContent = this.isMac() ? '⌘' : 'Ctrl';
		const plus = document.createElement('span');
		plus.textContent = '+';
		const enter = document.createElement('kbd');
		enter.textContent = 'Enter';
		const suffix = document.createElement('span');
		suffix.textContent = ' 发送';
		hint.append(modifier, plus, enter, suffix);

		const add = createButton('添加评论', 'rd-button rd-button--primary rd-button--sm rd-comment-popover__add-comment', async () => {
			const content = input.value.trim();
			if (!content) return;
			await this.run(() => this.host.addComment(highlight.id, content), [add]);
		});
		add.disabled = true;
		input.addEventListener('input', () => { add.disabled = !input.value.trim(); });
		input.addEventListener('keydown', event => {
			if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') add.click();
		});
		row.append(hint, add);
		section.append(row);
		return section;
	}

	private isMac(): boolean {
		const body = this.container?.ownerDocument?.body;
		return !!body?.classList?.contains?.('mod-mac');
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
