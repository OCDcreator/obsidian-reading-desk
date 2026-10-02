import type { PdfHighlight, ReadingDeskData } from '../types/contracts';

/** Host rename/relink keeps live, recoverable and queued annotations on the same source identity. */
export function remapAnnotationPaths(data: Pick<ReadingDeskData, 'highlights' | 'pendingTargetWrites' | 'deletedAnnotations'>, oldPath: string, newPath: string): string[] {
	const changed = new Set<string>();
	const remap = (highlight: PdfHighlight, active: boolean) => {
		const source = mappedPath(highlight.pdfPath, oldPath, newPath);
		const target = highlight.target && mappedPath(highlight.target.path, oldPath, newPath);
		if (source === highlight.pdfPath && (!highlight.target || target === highlight.target.path)) return;
		highlight.pdfPath = source;
		if (highlight.target && target) highlight.target.path = target;
		highlight.updatedAt = Date.now();
		if (active) changed.add(highlight.id);
	};
	for (const highlight of Object.values(data.highlights)) remap(highlight, true);
	for (const highlight of Object.values(data.pendingTargetWrites ?? {})) remap(highlight, true);
	for (const record of Object.values(data.deletedAnnotations ?? {})) remap(record.highlight, false);
	return [...changed];
}

export function mappedPath(path: string, oldPath: string, newPath: string): string {
	return path === oldPath ? newPath : path.startsWith(`${oldPath}/`) ? `${newPath}${path.slice(oldPath.length)}` : path;
}
