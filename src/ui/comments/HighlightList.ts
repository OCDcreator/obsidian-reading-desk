import type { PdfHighlight } from '../../types/contracts';
import {
	colorLabel,
	watchSwatchContrast,
	createButton,
	errorMessage,
	HIGHLIGHT_COLORS,
	HighlightListHost,
	targetLabel
} from './CommentUiTypes';

export interface HighlightListState {
	highlights: readonly PdfHighlight[];
	loading?: boolean;
	error?: string;
}

/** A reusable, host-driven highlighter drawer with explicit empty/loading/error states. */
export class HighlightList {
	private container: HTMLElement | null = null;
	private state: HighlightListState = { highlights: [] };
	private actionError = '';
	private stopSwatchWatcher: (() => void) | null = null;

	constructor(private readonly host: HighlightListHost) { }

	render(container: HTMLElement, state: HighlightListState): void {
		this.container = container;
		this.state = { ...state, highlights: [...state.highlights] };
		this.actionError = '';
		this.renderCurrent();
	}

	private renderCurrent(): void {
		if (!this.container) return;
		this.stopSwatchWatcher?.();
		this.stopSwatchWatcher = null;
		const root = document.createElement('section');
		root.className = 'rd-highlight-list';
		root.setAttribute('aria-label', '高亮列表');
		const heading = document.createElement('h3');
		heading.textContent = '高亮列表';
		root.append(heading);
		if (this.state.loading) {
			const loading = document.createElement('p');
			loading.className = 'rd-loading';
			loading.setAttribute('role', 'status');
			loading.textContent = '正在加载高亮…';
			root.append(loading);
		} else if (this.state.error) {
			root.append(this.renderMessage('rd-error', `高亮加载失败：${this.state.error}`, 'alert'));
		} else if (!this.state.highlights.length) {
			root.append(this.renderMessage('rd-empty', '本书还没有高亮。', 'status'));
		} else {
			const list = document.createElement('ol');
			list.className = 'rd-highlight-list__items';
			for (const highlight of this.state.highlights) list.append(this.renderRow(highlight));
			root.append(list);
		}
		if (this.actionError) root.append(this.renderMessage('rd-error', `操作失败：${this.actionError}`, 'alert'));
		this.container.replaceChildren(root);
		this.stopSwatchWatcher = watchSwatchContrast(root);
	}

	private renderRow(highlight: PdfHighlight): HTMLElement {
		const row = document.createElement('li');
		row.className = 'rd-highlight-row';
		const color = document.createElement('span');
		color.className = `rd-color-dot rd-color-${highlight.color}`;
		color.setAttribute('role', 'img');
		color.setAttribute('aria-label', `颜色：${colorLabel(highlight.color)}`);
		row.append(color);
		const target = document.createElement('span');
		target.className = 'rd-highlight-row__target';
		target.textContent = targetLabel(highlight);
		row.append(target);
		const jump = createButton(highlight.text || '未命名高亮', 'rd-link rd-highlight-row__jump', async () => {
			await this.run(() => this.host.jumpToHighlight(highlight));
		});
		jump.setAttribute('aria-label', `跳转到高亮：${highlight.text || '未命名高亮'}`);
		row.append(jump);
		const tags = document.createElement('span');
		tags.className = 'rd-highlight-row__tags';
		for (const tag of highlight.tags) {
			const tagEl = document.createElement('span');
			tagEl.className = 'rd-tag';
			tagEl.textContent = tag;
			tags.append(tagEl);
		}
		row.append(tags);
		const swatches = document.createElement('div');
		swatches.className = 'rd-swatch-group';
		swatches.setAttribute('aria-label', '更改高亮颜色');
		for (const option of HIGHLIGHT_COLORS) {
			const button = createButton(`选择${option.label}高亮色`, `rd-swatch rd-swatch--${option.value}`, async () => {
				await this.run(() => this.host.recolorHighlight(highlight.id, option.value));
			});
			button.setAttribute('aria-pressed', String(option.value === highlight.color));
			swatches.append(button);
		}
		row.append(swatches);
		row.append(createButton('删除此高亮', 'rd-button rd-highlight-row__delete', async () => {
			await this.run(() => this.host.deleteHighlight(highlight.id));
		}));
		return row;
	}

	private renderMessage(className: string, text: string, role: string): HTMLElement {
		const message = document.createElement('p');
		message.className = className;
		message.setAttribute('role', role);
		message.textContent = text;
		return message;
	}

	private async run(operation: () => Promise<void> | void): Promise<void> {
		try {
			this.actionError = '';
			await operation();
			this.renderCurrent();
		} catch (error) {
			this.actionError = errorMessage(error);
			this.renderCurrent();
		}
	}
}
