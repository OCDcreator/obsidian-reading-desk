import type { HighlightColor, PdfComment, PdfHighlight } from '../../types/contracts';

export const HIGHLIGHT_COLORS: ReadonlyArray<{ value: HighlightColor; label: string }> = [
	{ value: 'moss', label: '苔绿' },
	{ value: 'amber', label: '琥珀' },
	{ value: 'brick', label: '砖红' },
	{ value: 'indigo', label: '靛青' },
	{ value: 'plum', label: '梅紫' }
];

export interface CommentPopoverHost {
	comments(highlightId: string): readonly PdfComment[];
	allTags(): readonly string[];
	addComment(highlightId: string, content: string): Promise<void> | void;
	deleteComment(highlightId: string, commentId: string): Promise<void> | void;
	setTags(highlightId: string, tags: string[]): Promise<void> | void;
	recolorHighlight(highlightId: string, color: HighlightColor): Promise<void> | void;
	deleteHighlight(highlightId: string): Promise<void> | void;
	jumpToHighlight(highlight: PdfHighlight): Promise<void> | void;
}

export interface HighlightListHost {
	recolorHighlight(highlightId: string, color: HighlightColor): Promise<void> | void;
	deleteHighlight(highlightId: string): Promise<void> | void;
	jumpToHighlight(highlight: PdfHighlight): Promise<void> | void;
}

export function colorLabel(color: HighlightColor): string {
	return HIGHLIGHT_COLORS.find(option => option.value === color)?.label ?? color;
}

/** WCAG contrast ratio for opaque sRGB foreground/background pairs. */
export function contrastRatio(foreground: readonly number[], background: readonly number[]): number {
	const luminance = (rgb: readonly number[]): number => rgb.slice(0, 3)
		.map(channel => channel / 255)
		.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
		.reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
	const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
	return (lighter + 0.05) / (darker + 0.05);
}

/** Picks the higher-contrast opaque text colour for a Canvas-derived swatch. */
const SWATCH_DARK_FOREGROUND = [12, 14, 18] as const;
const SWATCH_LIGHT_FOREGROUND = [248, 247, 244] as const;

export function swatchForeground(background: readonly number[]): 'rgb(12, 14, 18)' | 'rgb(248, 247, 244)' {
	return contrastRatio(SWATCH_DARK_FOREGROUND, background) >= contrastRatio(SWATCH_LIGHT_FOREGROUND, background)
		? 'rgb(12, 14, 18)'
		: 'rgb(248, 247, 244)';
}

/**
 * Canvas palette variables are theme-provided, so a static foreground is not
 * reliable. Set the winning tinted dark/light WCAG foreground inline with
 * !important after the browser has resolved the actual background colour.
 */
export function applySwatchContrast(root: HTMLElement): void {
	const view = root.ownerDocument?.defaultView;
	if (!view) return;
	for (const swatch of Array.from(root.querySelectorAll<HTMLElement>('.rd-swatch'))) {
		const rgb = parseRgb(view.getComputedStyle(swatch).backgroundColor);
		if (!rgb) continue;
		swatch.style.setProperty('color', swatchForeground(rgb), 'important');
		swatch.style.setProperty('text-shadow', 'none', 'important');
	}
}

/**
 * Recomputes visible swatches after an Obsidian theme class/style change. A
 * theme toggle can alter Canvas CSS variables without rerendering the comment
 * component, so its earlier foreground decision must not be retained.
 */
export function watchSwatchContrast(root: HTMLElement): () => void {
	applySwatchContrast(root);
	const document = root.ownerDocument;
	const view = document?.defaultView;
	const targets = [document?.documentElement, document?.body].filter((node): node is HTMLElement => !!node);
	if (!view || !targets.length || typeof MutationObserver === 'undefined') return () => undefined;
	let frame: number | null = null;
	const refresh = (): void => {
		if (frame !== null) return;
		frame = view.requestAnimationFrame(() => {
			frame = null;
			applySwatchContrast(root);
		});
	};
	const observer = new MutationObserver(refresh);
	for (const target of targets) observer.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
	return () => {
		observer.disconnect();
		if (frame !== null) view.cancelAnimationFrame(frame);
	};
}

function parseRgb(value: string): number[] | null {
	const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function targetLabel(highlight: PdfHighlight): string {
	switch (highlight.target?.type) {
		case 'canvas': return 'Canvas 摘录';
		case 'excalidraw': return 'Excalidraw 摘录';
		case 'markdown': return 'Markdown 摘录';
		default: return '未关联目标';
	}
}

export function formatCommentTimestamp(timestamp: number): string {
	return new Intl.DateTimeFormat('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(timestamp));
}

export function createButton(label: string, className: string, onClick: () => void | Promise<void>): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = className;
	button.textContent = label;
	button.setAttribute('aria-label', label);
	button.addEventListener('click', () => { void onClick(); });
	return button;
}

export function setBusy(button: HTMLButtonElement, busy: boolean): void {
	button.disabled = busy;
	button.setAttribute('aria-busy', String(busy));
}

export function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : '操作未完成，请重试。';
}
