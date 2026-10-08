import { setIcon } from 'obsidian';

export interface TagComboboxOptions {
	inputId: string;
	inputLabel: string;
	placeholder: string;
	/** Every known tag; tags already on the highlight are removed via exclude. */
	allTags: () => readonly string[];
	exclude: () => readonly string[];
	onPick: (tag: string) => void;
}

/**
 * Subsequence fuzzy match: every query character must appear in order. Lower
 * scores sort first; -1 means no match. CJK substrings match naturally because
 * a contiguous run is also a subsequence.
 */
export function fuzzyScore(query: string, text: string): number {
	if (!query) return 0;
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	let qi = 0;
	let first = -1;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			if (first < 0) first = ti;
			qi++;
		}
	}
	return qi === q.length ? first * 2 + t.length : -1;
}

/**
 * Combobox (input + listbox) for tag entry. Typing fuzzy-matches existing tags,
 * ArrowUp/ArrowDown moves the highlight, Enter picks the highlighted option or
 * submits the typed text as a new tag, and Escape closes the menu without
 * closing the enclosing dialog. The visual contract (quiet overlay, accent
 * tint highlight) mirrors the opencodian settings dropdown.
 *
 * The class never reads or writes vault state; picks flow through onPick.
 */
export class TagCombobox {
	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly menu: HTMLElement;
	private optionEls: HTMLElement[] = [];
	private matches: string[] = [];
	private creatable: string | null = null;
	private open = false;
	private highlight = -1;
	private composing = false;
	private removeDocumentListener: (() => void) | null = null;

	constructor(private readonly options: TagComboboxOptions) {
		this.element = document.createElement('div');
		this.element.className = 'rd-combo';

		this.input = document.createElement('input');
		this.input.id = options.inputId;
		this.input.type = 'text';
		this.input.className = 'rd-combo__input';
		this.input.placeholder = options.placeholder;
		this.input.setAttribute('aria-label', options.inputLabel);
		this.input.setAttribute('role', 'combobox');
		this.input.setAttribute('aria-autocomplete', 'list');
		this.input.setAttribute('aria-expanded', 'false');
		this.input.setAttribute('aria-controls', `${options.inputId}-menu`);
		this.input.setAttribute('autocomplete', 'off');
		this.input.setAttribute('spellcheck', 'false');

		this.menu = document.createElement('div');
		this.menu.className = 'rd-combo__menu';
		this.menu.id = `${options.inputId}-menu`;
		this.menu.setAttribute('role', 'listbox');
		this.menu.setAttribute('aria-label', '已有标签');
		this.menu.hidden = true;

		this.element.append(this.input, this.menu);
		this.wire();
	}

	/** Current draft text, for the sibling add button. */
	currentValue(): string {
		return this.input.value;
	}

	/** Reopens the menu after a host-driven re-render replaced the DOM. */
	focusAndOpen(): void {
		this.input.focus?.();
		this.openMenu();
	}

	dispose(): void {
		this.removeDocumentListener?.();
		this.removeDocumentListener = null;
	}

	private wire(): void {
		this.input.addEventListener('input', () => {
			if (!this.composing) this.openMenu();
		});
		this.input.addEventListener('focusin', () => this.openMenu());
		this.input.addEventListener('focusout', event => {
			const next = (event as FocusEvent).relatedTarget as Node | null;
			if (!next || !this.element.contains?.(next)) this.closeMenu();
		});
		this.input.addEventListener('compositionstart', () => {
			this.composing = true;
		});
		this.input.addEventListener('compositionend', () => {
			this.composing = false;
			this.openMenu();
		});
		this.input.addEventListener('keydown', event => this.onKeydown(event));
		// pointerdown default would move focus into the menu; the click applies the pick.
		this.menu.addEventListener('pointerdown', event => event.preventDefault());
		// focusout is unreliable when the window lacks OS focus; pointer is the hard boundary.
		const doc = this.input.ownerDocument;
		if (doc?.addEventListener) {
			const listener = (event: Event) => {
				const target = event.target as Node | null;
				if (target && this.element.contains?.(target)) return;
				this.closeMenu();
			};
			doc.addEventListener('pointerdown', listener);
			this.removeDocumentListener = () => doc.removeEventListener('pointerdown', listener);
		}
	}

	private onKeydown(event: KeyboardEvent): void {
		if (this.composing || event.isComposing) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!this.open) {
				this.openMenu();
				return;
			}
			if (!this.optionEls.length) return;
			this.highlight = event.key === 'ArrowDown'
				? Math.min(this.highlight + 1, this.optionEls.length - 1)
				: Math.max(this.highlight - 1, -1);
			this.applyHighlight(true);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (this.open && this.highlight >= 0) this.pick(this.highlight);
			else this.submit(this.input.value);
			return;
		}
		if (event.key === 'Escape' && this.open) {
			event.stopPropagation?.();
			this.closeMenu();
		}
	}

	private submit(text: string): void {
		const tag = text.trim();
		if (!tag || this.options.exclude().includes(tag)) return;
		this.options.onPick(tag);
	}

	private pick(index: number): void {
		const value = index < this.matches.length ? this.matches[index] : this.creatable;
		if (value) this.options.onPick(value);
	}

	private openMenu(): void {
		this.open = true;
		this.highlight = -1;
		this.renderMenu();
	}

	private closeMenu(): void {
		this.open = false;
		this.highlight = -1;
		this.menu.hidden = true;
		this.input.setAttribute('aria-expanded', 'false');
		this.input.removeAttribute('aria-activedescendant');
	}

	private renderMenu(): void {
		const query = this.input.value.trim();
		const excluded = this.options.exclude();
		const pool = this.options.allTags().filter(tag => !excluded.includes(tag));
		this.matches = pool
			.map(tag => ({ tag, score: fuzzyScore(query, tag) }))
			.filter(entry => entry.score >= 0)
			.sort((left, right) => left.score - right.score)
			.map(entry => entry.tag);
		const exact = pool.some(tag => tag.toLowerCase() === query.toLowerCase());
		this.creatable = query && !exact ? query : null;

		const nodes: HTMLElement[] = [];
		this.optionEls = [];
		if (this.matches.length) {
			const group = document.createElement('div');
			group.className = 'rd-combo__group';
			group.textContent = '已有标签';
			nodes.push(group);
			this.matches.forEach((tag, index) => nodes.push(this.renderOption(tag, index, false)));
		}
		if (this.creatable) {
			nodes.push(this.renderOption(`创建新标签 “${this.creatable}”`, this.matches.length, true));
		}
		if (!nodes.length && !query && !pool.length) {
			const empty = document.createElement('div');
			empty.className = 'rd-combo__empty';
			empty.textContent = '所有标签都已添加。';
			nodes.push(empty);
		}
		this.menu.replaceChildren(...nodes);
		const show = this.open && nodes.length > 0;
		this.menu.hidden = !show;
		this.input.setAttribute('aria-expanded', String(show));
		this.applyHighlight(false);
	}

	private renderOption(label: string, index: number, isCreate: boolean): HTMLElement {
		const option = document.createElement('button');
		option.type = 'button';
		option.className = isCreate ? 'rd-combo__option rd-combo__option--create' : 'rd-combo__option';
		option.id = `${this.menu.id}-opt-${index}`;
		option.setAttribute('role', 'option');
		option.setAttribute('aria-selected', 'false');
		if (isCreate) {
			setIcon(option, 'plus');
			const text = document.createElement('span');
			text.textContent = label;
			option.append(text);
		} else {
			option.textContent = label;
		}
		option.addEventListener('click', () => this.pick(index));
		option.addEventListener('mouseover', () => {
			this.highlight = index;
			this.applyHighlight(false);
		});
		this.optionEls.push(option);
		return option;
	}

	private applyHighlight(scroll: boolean): void {
		this.optionEls.forEach((option, index) => {
			const on = index === this.highlight;
			option.classList?.toggle('is-highlighted', on);
			option.setAttribute('aria-selected', String(on));
		});
		const active = this.highlight >= 0 ? this.optionEls[this.highlight] : null;
		if (active) {
			this.input.setAttribute('aria-activedescendant', active.id);
			if (scroll) active.scrollIntoView?.({ block: 'nearest' });
		} else {
			this.input.removeAttribute('aria-activedescendant');
		}
	}
}
