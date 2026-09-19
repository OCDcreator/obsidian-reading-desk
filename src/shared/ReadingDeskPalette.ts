import type { HighlightColor } from '../types/contracts';

/**
 * Canvas stores its native colour codes, while Reader surfaces reference the
 * matching Obsidian Canvas CSS variable. This preserves one colour identity
 * across persisted nodes, swatches and transparent PDF overlays.
 */
export const READING_DESK_PALETTE: Record<HighlightColor, { canvasCode: string; cssVariable: string }> = {
	moss: { canvasCode: '4', cssVariable: '--canvas-color-4' },
	amber: { canvasCode: '3', cssVariable: '--canvas-color-3' },
	brick: { canvasCode: '1', cssVariable: '--canvas-color-1' },
	indigo: { canvasCode: '6', cssVariable: '--canvas-color-6' },
	plum: { canvasCode: '5', cssVariable: '--canvas-color-5' }
};
