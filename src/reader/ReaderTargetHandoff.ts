import type { AnnotationTarget } from '../types/contracts';

export interface NativeTargetOpener { openTargetInSplit(path: string, objectId?: string): Promise<void>; }
export type CanvasRevealResult = 'not-canvas' | 'opened' | 'open-failed';

/** Canvas excerpts immediately reveal their native node; other target workflows stay unchanged. */
export async function revealCreatedCanvasTarget(target: AnnotationTarget, opener: NativeTargetOpener): Promise<CanvasRevealResult> {
	if (target.type !== 'canvas') return 'not-canvas';
	try {
		await opener.openTargetInSplit(target.path, target.objectId);
		return 'opened';
	} catch (error) {
		console.error('[Reading Desk] Canvas 摘录已创建，但原生目标打开失败', error);
		return 'open-failed';
	}
}
