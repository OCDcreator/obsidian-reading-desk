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
	copyHighlightLink(highlight: PdfHighlight): Promise<void> | void;
	setScope(scope: 'book' | 'page'): Promise<void> | void;
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

/**
 * Single source of truth for the tinted swatch foregrounds. The stylesheet's
 * swatch foreground fallback must mirror SWATCH_DARK_FOREGROUND (the near-black
 * tint); keep the two in sync when either changes. The returned "rgb(...)"
 * strings are built from these constants so each value appears exactly once.
 */
const SWATCH_DARK_FOREGROUND = [12, 14, 18] as const;
const SWATCH_LIGHT_FOREGROUND = [248, 247, 244] as const;

function foregroundText(rgb: readonly number[]): string {
	return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Picks the higher-contrast opaque text colour for a Canvas-derived swatch. */
export function swatchForeground(background: readonly number[]): string {
	return contrastRatio(SWATCH_DARK_FOREGROUND, background) >= contrastRatio(SWATCH_LIGHT_FOREGROUND, background)
		? foregroundText(SWATCH_DARK_FOREGROUND)
		: foregroundText(SWATCH_LIGHT_FOREGROUND);
}

const SRGB_CHANNEL_SCALE = 255;
const OPAQUE_ALPHA = 0.99;

/**
 * Canvas palette variables are theme-provided, so a static foreground is not
 * reliable. Set the winning tinted dark/light WCAG foreground inline with
 * !important after the browser has resolved the actual background colour.
 * Backgrounds that cannot be parsed (oklch, color-mix, translucency) fall back
 * to the nearest resolvable ancestor or the host theme, never to a stylesheet
 * default that may be unreadable.
 */
export function applySwatchContrast(root: HTMLElement): void {
	const view = root.ownerDocument?.defaultView;
	if (!view) return;
	for (const swatch of Array.from(root.querySelectorAll<HTMLElement>('.rd-swatch'))) {
		swatch.style.setProperty('color', resolveSwatchForeground(view, swatch), 'important');
		swatch.style.setProperty('text-shadow', 'none', 'important');
	}
}

/** Walks from the swatch outward until an opaque, parseable background is found. */
function resolveSwatchForeground(view: Window, swatch: HTMLElement): string {
	for (let node: HTMLElement | null = swatch; node; node = node.parentElement) {
		const background = parseOpaqueBackground(view.getComputedStyle(node).backgroundColor);
		if (background) return swatchForeground(background);
	}
	return swatchForeground(themeBackground(view));
}

/** Approximates the theme surface so the fallback keeps real contrast. */
function themeBackground(view: Window): readonly number[] {
	const theme = (view.document.body ?? view.document.documentElement).classList;
	if (theme.contains('theme-dark')) return SWATCH_DARK_FOREGROUND;
	if (theme.contains('theme-light')) return SWATCH_LIGHT_FOREGROUND;
	return view.matchMedia('(prefers-color-scheme: dark)').matches
		? SWATCH_DARK_FOREGROUND
		: SWATCH_LIGHT_FOREGROUND;
}

/**
 * Parses the computed colour forms Chromium emits: legacy comma rgb()/rgba(),
 * space-separated rgb()/rgba() with slash alpha, and color(srgb ...) sources.
 * Returns 0-255 sRGB channels, or null for anything else (oklch, percentages,
 * transparent) so the caller can fall back to an ancestor or theme colour.
 */
function parseOpaqueBackground(value: string): number[] | null {
	const text = value.trim().toLowerCase();
	const comma = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/);
	const spaced = text.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/);
	const srgb = text.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/);
	const match = comma ?? spaced ?? srgb;
	if (!match) return null;
	const alpha = match[4] ? Number(match[4]) : 1;
	if (alpha < OPAQUE_ALPHA) return null;
	const scale = match === srgb ? SRGB_CHANNEL_SCALE : 1;
	return [Number(match[1]) * scale, Number(match[2]) * scale, Number(match[3]) * scale];
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

export interface ConfirmDeleteControls {
	confirm: HTMLButtonElement;
	cancel: HTMLButtonElement;
}

/**
 * Destructive actions render as a two-step inline confirmation: the first
 * click swaps the control to its armed label and reveals an inline 取消删除，
 * and only the second click fires the operation. Both controls report busy
 * state and stay disabled while the deletion is in flight. Any re-render
 * naturally disarms the pair because it rebuilds fresh controls.
 */
export function createConfirmDelete(
	label: string,
	className: string,
	armedLabel: string,
	onConfirm: () => Promise<void> | void
): ConfirmDeleteControls {
	const cancel = createButton('取消删除', 'rd-button', () => disarm());
	cancel.hidden = true;
	const confirm = createButton(label, className, async () => {
		if (confirm.dataset.armed !== 'true') {
			confirm.dataset.armed = 'true';
			confirm.textContent = armedLabel;
			confirm.setAttribute('aria-label', armedLabel);
			cancel.hidden = false;
			return;
		}
		setBusy(confirm, true);
		setBusy(cancel, true);
		try {
			await onConfirm();
		} finally {
			setBusy(confirm, false);
			setBusy(cancel, false);
		}
	});
	function disarm(): void {
		confirm.dataset.armed = 'false';
		confirm.textContent = label;
		confirm.setAttribute('aria-label', label);
		cancel.hidden = true;
	}
	return { confirm, cancel };
}

/**
 * Marks in-flight controls: disabled plus aria-busy. Stylesheets can hook
 * `:disabled` and `[aria-busy="true"]` for the visible busy treatment.
 */
export function setBusy(button: HTMLButtonElement, busy: boolean): void {
	button.disabled = busy;
	button.setAttribute('aria-busy', String(busy));
}

const GENERIC_FAILURE_MESSAGE = '操作未完成，请稍后重试。';

/**
 * Host operations carry their own Chinese wording; anything without CJK
 * characters is an internal exception (library, browser, or stack text) and
 * must never reach the interface verbatim.
 */
export function errorMessage(error: unknown): string {
	if (!(error instanceof Error) || !error.message) return GENERIC_FAILURE_MESSAGE;
	return /[\u4e00-\u9fff]/.test(error.message) ? error.message : GENERIC_FAILURE_MESSAGE;
}
