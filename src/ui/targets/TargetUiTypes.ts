import type { TargetType } from '../../types/contracts';

export function targetTypeLabel(type: TargetType): string {
	return type === 'canvas' ? 'Canvas' : type === 'excalidraw' ? 'Excalidraw' : 'Markdown';
}
