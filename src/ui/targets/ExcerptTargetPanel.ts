import type { PdfHighlight } from '../../types/contracts';

export interface ExcerptCard {
	highlight: PdfHighlight;
	title?: string;
	folded?: boolean;
}

export interface ExcerptTargetPanelHost {
	readExcerptCards(pdfPath: string): Promise<ExcerptCard[]>;
	updateExcerptCard(highlightId: string, patch: { title?: string; folded?: boolean }): Promise<void>;
	jumpToExcerpt(highlight: PdfHighlight): Promise<void>;
	openComment(highlight: PdfHighlight): Promise<void>;
}

/**
 * Reader-owned, target-agnostic representation of only Reading Desk excerpts.
 * It does not enumerate or mutate ordinary Canvas nodes, so those nodes never
 * gain a Reading Desk title bar or collapse behavior.
 */
export class ExcerptTargetPanel {
	private container: HTMLElement | null = null;
	private pdfPath = '';
	private cards: ExcerptCard[] = [];
	private error = '';

	constructor(private readonly host: ExcerptTargetPanelHost) { }

	async render(container: HTMLElement, pdfPath: string): Promise<void> {
		this.container = container;
		this.pdfPath = pdfPath;
		await this.reload();
	}

	private async reload(): Promise<void> {
		this.paint('正在读取已关联摘录…');
		try {
			this.cards = await this.host.readExcerptCards(this.pdfPath);
			this.error = '';
			this.paint();
		} catch (error) {
			this.error = error instanceof Error ? error.message : '无法读取摘录目标。';
			this.paint();
		}
	}

	private paint(loading = ''): void {
		if (!this.container) return;
		this.container.replaceChildren();
		this.container.className = 'rd-excerpt-target-panel';
		const heading = document.createElement('h4');
		heading.textContent = '本页摘录卡片';
		this.container.append(heading);
		if (loading) {
			this.container.append(this.message('rd-loading', loading, 'status'));
			return;
		}
		if (this.error) {
			this.container.append(this.message('rd-error', `读取失败：${this.error}`, 'alert'));
			return;
		}
		if (!this.cards.length) {
			this.container.append(this.message('rd-empty', '当前 PDF 还没有 Reading Desk 摘录卡片。', 'status'));
			return;
		}
		const list = document.createElement('ol');
		list.className = 'rd-excerpt-target-panel__cards';
		for (const card of this.cards) list.append(this.card(card));
		this.container.append(list);
	}

	private card(card: ExcerptCard): HTMLElement {
		const item = document.createElement('li');
		item.className = 'rd-excerpt-card';
		item.dataset.highlightId = card.highlight.id;
		const title = document.createElement('input');
		title.type = 'text';
		title.className = 'rd-excerpt-card__title';
		title.value = card.title ?? defaultTitle(card.highlight);
		title.setAttribute('aria-label', '编辑摘录卡片标题');
		title.addEventListener('blur', () => void this.update(card, { title: title.value.trim() || defaultTitle(card.highlight) }));
		title.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				title.blur();
			}
		});
		item.append(title);
		const controls = document.createElement('div');
		controls.className = 'rd-excerpt-card__controls';
		const fold = button(card.folded ? '展开卡片' : '折叠卡片', () => void this.update(card, { folded: !card.folded }));
		fold.setAttribute('aria-pressed', String(!!card.folded));
		controls.append(
			fold,
			button('定位目标', () => void this.host.jumpToExcerpt(card.highlight)),
			button('评论 +', () => void this.host.openComment(card.highlight))
		);
		item.append(controls);
		if (!card.folded) {
			const excerpt = document.createElement('p');
			excerpt.className = 'rd-excerpt-card__text';
			excerpt.textContent = card.highlight.text;
			item.append(excerpt);
		}
		return item;
	}

	private async update(card: ExcerptCard, patch: { title?: string; folded?: boolean }): Promise<void> {
		await this.host.updateExcerptCard(card.highlight.id, patch);
		Object.assign(card, patch);
		this.paint();
	}

	private message(className: string, text: string, role: string): HTMLElement {
		const message = document.createElement('p');
		message.className = className;
		message.setAttribute('role', role);
		message.textContent = text;
		return message;
	}
}

function defaultTitle(highlight: PdfHighlight): string {
	const text = highlight.text.replace(/\s+/g, ' ').trim();
	return text.length > 40 ? `${text.slice(0, 40)}…` : text || `第 ${highlight.page + 1} 页摘录`;
}

function button(label: string, action: () => void): HTMLButtonElement {
	const control = document.createElement('button');
	control.type = 'button';
	control.className = 'rd-button';
	control.textContent = label;
	control.setAttribute('aria-label', label);
	control.addEventListener('click', action);
	return control;
}
