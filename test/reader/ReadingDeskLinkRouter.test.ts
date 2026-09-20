import { describe, expect, it } from 'vitest';
import { AnnotationStore } from '../../src/annotations/AnnotationStore';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import { boundVisiblePage } from '../../src/reader/ReaderPageNavigation';
import { routeReadingDeskLink, type ReadingDeskLinkRouteHost } from '../../src/reader/ReadingDeskLinkRouter';
import type { LibraryBook, PdfComment, PdfHighlight } from '../../src/types/contracts';

function setup() {
	const highlight: PdfHighlight = { id: 'h-1', pdfPath: 'renamed/current.pdf', page: 1, rotation: 0, rects: [{ x: 0, y: 0, width: 0.2, height: 0.1 }], text: '原文', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1 };
	const highlights = { [highlight.id]: highlight };
	const comments: Record<string, PdfComment[]> = {};
	const annotations = new AnnotationStore({ readHighlights: () => highlights, readComments: () => comments, commit: async change => change() });
	const book: LibraryBook = { id: 'book-1', path: 'renamed/current.pdf', format: 'pdf', title: '书', author: '', fileSize: 1, fingerprint: { mtime: 1, size: 1 }, tags: [], progress: 0 };
	const library = new LibraryIndex({ readBooks: () => ({ [book.id]: book }), readCategories: () => [], commit: async change => change() }, { extract: async () => ({ title: '', author: '' }) });
	const calls: string[] = [];
	const notices: string[] = [];
	const host: ReadingDeskLinkRouteHost = {
		annotations, library, fileExists: path => path === book.path,
		openHighlight: async (path, id) => { calls.push(`highlight:${path}:${id}`); },
		openPage: async (path, page) => { calls.push(`page:${path}:${page}`); },
		notice: message => { notices.push(message); }
	};
	return { highlights, host, calls, notices };
}

describe('ReadingDeskLinkRouter integration', () => {
	it('uses current AnnotationStore and LibraryIndex paths over stale URI fallbacks', async () => {
		const { host, calls } = setup();
		expect(await routeReadingDeskLink({ highlight: 'h-1', file: 'stale.pdf' }, host)).toBe(true);
		expect(await routeReadingDeskLink({ page: '7', book: 'book-1', file: 'stale.pdf' }, host)).toBe(true);
		expect(calls).toEqual(['highlight:renamed/current.pdf:h-1', 'page:renamed/current.pdf:7']);
	});

	it('announces deleted highlights and missing files without opening a Reader', async () => {
		const { host, highlights, calls, notices } = setup();
		delete highlights['h-1'];
		await routeReadingDeskLink({ highlight: 'h-1', file: 'stale.pdf' }, host);
		await routeReadingDeskLink({ page: '2', file: 'missing.pdf' }, host);
		expect(calls).toEqual([]);
		expect(notices).toEqual(['未找到这条 Reading Desk 高亮；它可能已被删除。', '未找到页链接对应的 PDF；文件可能已被移动或删除。']);
	});

	it('passes the requested page to Reader and its real clamp seam emits the overflow Notice', async () => {
		const { host, calls, notices } = setup();
		host.openPage = async (path, requested) => {
			calls.push(`requested:${path}:${requested}`);
			const bounded = boundVisiblePage(requested, 12);
			calls.push(`rendered:${bounded.page}`);
			if (bounded.notice) host.notice(bounded.notice);
		};
		await routeReadingDeskLink({ page: '99', book: 'book-1' }, host);
		expect(calls).toEqual(['requested:renamed/current.pdf:99', 'rendered:12']);
		expect(notices).toEqual(['页码超出范围，已改为第 12 页。']);
		expect(boundVisiblePage(2, 12)).toEqual({ page: 2 });
	});
});
