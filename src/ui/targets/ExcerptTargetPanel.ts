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

const FAILURE_NEXT_STEP = '请重试；若持续失败，请重新打开此 PDF。';

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
	private retry: (() => Promise<void>) | null = null;
	private errorStrip: HTMLParagraphElement | null = null;

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
			this.retry = null;
		} catch (error) {
			this.error = `读取摘录卡片失败：${friendlyError(error, '无法读取已关联的摘录卡片。')}`;
			this.retry = () => this.reload();
		}
		this.paint();
	}

	private paint(loading = ''): void {
		if (!this.container) return;
		this.container.replaceChildren();
		this.container.className = 'rd-excerpt-target-panel';
		const heading = document.createElement('h3');
		heading.textContent = '本页摘录卡片';
		this.container.append(heading);
		if (loading) {
			this.container.append(this.message('rd-loading', loading, 'status'));
			return;
		}
		if (this.cards.length) {
			const list = document.createElement('ol');
			list.className = 'rd-excerpt-target-panel__cards';
			for (const card of this.cards) list.append(this.card(card));
			this.container.append(list);
		}
		if (this.error) {
			// Failures never blank the cards: the alert strip and retry render
			// below the list so context and drafts stay visible.
			this.container.append(this.errorStripNode());
			this.container.append(this.retryButton());
			if (this.errorStrip) this.errorStrip.textContent = `${this.error}${FAILURE_NEXT_STEP}`;
			return;
		}
		if (!this.cards.length) {
			this.container.append(this.message('rd-empty',
				'当前 PDF 还没有 Reading Desk 摘录卡片。选中正文后，用阅读工具栏的色盘或右键菜单创建摘录，卡片就会显示在这里。', 'status'));
		}
	}

	/** The alert node survives repaints and is mutated in place, never replaced. */
	private errorStripNode(): HTMLParagraphElement {
		if (!this.errorStrip) {
			this.errorStrip = document.createElement('p');
			this.errorStrip.className = 'rd-error';
			this.errorStrip.setAttribute('role', 'alert');
		}
		return this.errorStrip;
	}

	private retryButton(): HTMLButtonElement {
		const action = this.retry ?? (() => this.reload());
		const control = button('重试', () => {
			setBusy(control, true);
			void action().finally(() => setBusy(control, false));
		});
		return control;
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
		// A disclosure control: expanded exactly while the excerpt body renders.
		fold.setAttribute('aria-expanded', String(!card.folded));
		controls.append(
			fold,
			button('定位目标', () => void this.host.jumpToExcerpt(card.highlight)),
			button('评论 +', () => void this.host.openComment(card.highlight))
		);
		item.append(controls);
		if (!card.folded) {
			const excerpt = document.createElement('p');
			// Stylesheet hook: pre-wrap plus overflow-wrap live there, so long
			// unbroken tokens wrap instead of overflowing the card.
			excerpt.className = 'rd-excerpt-card__text';
			excerpt.textContent = card.highlight.text;
			item.append(excerpt);
		}
		return item;
	}

	private async update(card: ExcerptCard, patch: { title?: string; folded?: boolean }): Promise<void> {
		try {
			await this.host.updateExcerptCard(card.highlight.id, patch);
		} catch (error) {
			this.error = `保存摘录卡片修改失败：${friendlyError(error, '无法保存摘录卡片的修改。')}`;
			this.retry = () => this.update(card, patch);
			this.paint();
			return;
		}
		this.error = '';
		this.retry = null;
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

/**
 * Host errors carry their own Chinese wording; anything without CJK
 * characters is an internal exception and must not surface verbatim.
 */
function friendlyError(error: unknown, fallback: string): string {
	return error instanceof Error && error.message && /[\u4e00-\u9fff]/.test(error.message) ? error.message : fallback;
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

/** Mirrors the shared busy helper so the panel keeps its own styling hooks. */
function setBusy(button: HTMLButtonElement, busy: boolean): void {
	button.disabled = busy;
	button.setAttribute('aria-busy', String(busy));
}
