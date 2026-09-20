/**
 * 「页边锚点 / Margin Anchor」 — Reading Desk 的原创入口图标。
 *
 * 图形语义：页面轮廓 = PDF 原文；左侧竖线 = Margin 页边；圆点 = 可回跳的原文锚点；
 * 三条短线 = 摘录与批注；折角 = Vault 中的真实文件。
 *
 * 配色遵循宿主优先原则：页面/折角/摘录走 currentColor 跟随宿主 ink；页边线用
 * interactive-accent；锚点用 Canvas brick 语义色。两个版本的几何完全一致，夜间版
 * 描边略细（7 vs 8），补偿亮线在深色背景上的视觉膨胀。
 */

const PAGE_FALLBACK = 'oklch(0.62 0.13 235)';
const BRICK_FALLBACK = 'oklch(0.62 0.15 30)';

/** 日间版：线条稍粗，深色图形在浅背景上保持力度。 */
export const READING_DESK_MARGIN_ANCHOR_DAY = `
  <path d="M24 13H62L78 29V87H24Z"
    fill="none" stroke="currentColor" stroke-width="8"
    stroke-linejoin="round"/>
  <path d="M62 13V29H78"
    fill="none" stroke="currentColor" stroke-width="8"
    stroke-linejoin="round"/>
  <path d="M39 30V72"
    fill="none" stroke="var(--interactive-accent, ${PAGE_FALLBACK})" stroke-width="8"
    stroke-linecap="round"/>
  <circle cx="39" cy="51" r="5"
    fill="var(--canvas-color-1, ${BRICK_FALLBACK})"/>
  <path d="M50 37H66M50 51H70M50 65H62"
    fill="none" stroke="currentColor" stroke-width="8"
    stroke-linecap="round" opacity="0.55"/>
`;

/** 夜间版：同一识别轮廓，减轻线条与锚点，避免亮线膨胀。 */
export const READING_DESK_MARGIN_ANCHOR_NIGHT = `
  <path d="M24 13H62L78 29V87H24Z"
    fill="none" stroke="currentColor" stroke-width="7"
    stroke-linejoin="round"/>
  <path d="M62 13V29H78"
    fill="none" stroke="currentColor" stroke-width="7"
    stroke-linejoin="round"/>
  <path d="M39 29V73"
    fill="none" stroke="var(--interactive-accent, ${PAGE_FALLBACK})" stroke-width="7"
    stroke-linecap="round"/>
  <circle cx="39" cy="51" r="4.5"
    fill="var(--canvas-color-1, ${BRICK_FALLBACK})"/>
  <path d="M50 37H67M50 51H71M50 65H63"
    fill="none" stroke="currentColor" stroke-width="7"
    stroke-linecap="round" opacity="0.55"/>
`;

/** Resolves the icon id for the current host theme. */
export function marginAnchorIconId(themeDark: boolean): string {
	return themeDark ? 'reading-desk-margin-night' : 'reading-desk-margin-day';
}

/** True when the host document currently runs a dark theme. */
export function hostThemeDark(doc: Document): boolean {
	return doc.body.classList.contains('theme-dark') || doc.documentElement.classList.contains('theme-dark');
}
