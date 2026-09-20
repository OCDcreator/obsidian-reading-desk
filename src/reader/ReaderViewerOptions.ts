export type InvertSetting = 'auto' | 'on' | 'off';

/** Resolves the effective PDF paper inversion from the setting and live host theme. */
export function effectiveInvert(setting: InvertSetting, themeDark: boolean): boolean {
	if (setting === 'on') return true;
	if (setting === 'off') return false;
	return themeDark;
}

export const INVERT_LABELS: Array<[InvertSetting, string]> = [
	['auto', '夜间反相：跟随主题'],
	['on', '夜间反相：开'],
	['off', '夜间反相：关']
];

export const SCROLL_MODE_LABELS: Array<[('continuous' | 'single'), string]> = [
	['continuous', '滚动模式：连续滚动'],
	['single', '滚动模式：单页']
];
