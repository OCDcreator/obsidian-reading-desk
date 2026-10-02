import { createEmptyData } from '../../src/data/defaults';
import type { PdfHighlight, ReadingDeskData } from '../../src/types/contracts';

export function highlight(id = 'h'): PdfHighlight {
	return {
		id, pdfPath: 'Books/first.pdf', page: 0, rotation: 0,
		rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }], text: '第 1 页', color: 'moss',
		chapterPath: ['第一章'], tags: ['note'], target: { type: 'markdown', path: 'Notes/first.md' },
		createdAt: 1, updatedAt: 2
	};
}

export function completeData(): ReadingDeskData {
	const data = createEmptyData();
	data.books.b = {
		id: 'b', path: 'Books/first.pdf', format: 'pdf', title: 'Manual title', author: '', tags: ['tag'],
		fileSize: 100, progress: 0.3, fingerprint: { mtime: 1, size: 100 }, coverPath: 'Covers/first.png',
		categoryId: 'c', listIds: ['l'], readingStatus: 'reading', metadataOverrides: { title: 'Manual title', author: '' },
		autoMetadata: { title: 'Automatic title', author: 'Someone' }, source: { provider: 'zotero', id: 'Z1', doi: '10.test/1' }
	};
	data.categories = [{ id: 'c', name: 'Category', order: 0 }];
	data.lists = [{ id: 'l', name: 'List' }];
	data.highlights.h = highlight();
	data.comments.h = [{ id: 'comment', highlightId: 'h', content: '手写评论', createdAt: 2, showTimestamp: true, source: 'pdf' }];
	data.excerptCards.h = { title: 'Manual excerpt title', folded: true };
	data.deletedAnnotations = { deleted: {
		highlight: highlight('deleted'), comments: [{ id: 'deleted-comment', highlightId: 'deleted', content: '可恢复评论', createdAt: 2, showTimestamp: false, source: 'markdown' }],
		excerptCard: { folded: true }, deletedAt: 3, reason: 'target-deleted'
	} };
	data.pendingTargetWrites = { intent: highlight('intent') };
	data.settings.libraryFolders = ['Books'];
	data.settings.excerptTemplate = '{{text}}';
	data.settings.storage.accessKeyId = 'private-access';
	data.settings.storage.secretAccessKey = 'private-secret';
	return data;
}
