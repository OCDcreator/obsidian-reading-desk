import type { AnnotationStore } from '../annotations/AnnotationStore';
import type { LibraryIndex } from '../library/LibraryIndex';
import { parseReadingDeskLink } from './ReadingDeskLinks';

export interface ReadingDeskLinkRouteHost {
	annotations: Pick<AnnotationStore, 'get'>;
	library: Pick<LibraryIndex, 'list'>;
	fileExists(path: string): boolean;
	openHighlight(path: string, highlightId: string): Promise<void>;
	openPage(path: string, page: number): Promise<void>;
	notice(message: string): void;
}

/** Resolves protocol data against current stores, then performs one host navigation. */
export async function routeReadingDeskLink(params: Record<string, string>, host: ReadingDeskLinkRouteHost): Promise<boolean> {
	const parsed = parseReadingDeskLink(params);
	if ('message' in parsed) return fail(host, parsed.message);
	const target = parsed.target;
	if (target.kind === 'highlight') {
		const stored = host.annotations.get(target.highlightId);
		if (!stored) return fail(host, '未找到这条 Reading Desk 高亮；它可能已被删除。');
		if (!host.fileExists(stored.pdfPath)) return fail(host, '未找到高亮对应的 PDF；文件可能已被移动或删除。');
		await host.openHighlight(stored.pdfPath, stored.id);
		return true;
	}
	const indexed = target.bookId ? host.library.list().find(book => book.id === target.bookId) : undefined;
	const path = indexed?.path ?? target.file;
	if (!path || !host.fileExists(path)) return fail(host, '未找到页链接对应的 PDF；文件可能已被移动或删除。');
	await host.openPage(path, target.page);
	return true;
}

function fail(host: ReadingDeskLinkRouteHost, message: string): false {
	host.notice(message);
	return false;
}
