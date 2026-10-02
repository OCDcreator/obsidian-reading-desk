import { bookmarksCheck, readerPositionCheck, shelfStateCheck } from './WorkspaceStateValidation';
import { choice, flag, nonEmptyText, numeric, shape, text, texts, type ValueCheck } from './DataValidationSupport';

const timestamp = numeric(0);
const target = shape({ type: choice('canvas', 'excalidraw', 'markdown'), path: nonEmptyText }, { objectId: nonEmptyText });
const rectangle = shape({ x: numeric(0, 1), y: numeric(0, 1), width: numeric(0, 1), height: numeric(0, 1) });

export const bookCheck = shape({
	id: nonEmptyText, path: nonEmptyText, format: choice('pdf', 'epub'), title: text, author: text,
	fileSize: numeric(0), tags: texts, progress: numeric(0, 1),
	fingerprint: shape({ mtime: timestamp, size: numeric(0) })
}, {
	pageCount: numeric(1, Infinity, true), coverPath: text, categoryId: text, rating: numeric(0, 5), lastReadAt: timestamp,
	metadataError: text, coverRetryable: flag, coverError: text, missing: flag,
	lastReadPosition: readerPositionCheck, bookmarks: bookmarksCheck,
	metadataOverrides: shape({}, { title: text, author: text }), autoMetadata: shape({ title: text, author: text }),
	source: shape({ provider: choice('csl', 'bibtex', 'zotero'), id: nonEmptyText }, { doi: text, isbn: text, citationKey: text }),
	listIds: texts, readingStatus: choice('unread', 'reading', 'finished', 'abandoned')
});

export const categoryCheck = shape({ id: nonEmptyText, name: text, order: numeric(0, Infinity, true) });
export const listCheck = shape({ id: nonEmptyText, name: nonEmptyText });
export const cardCheck = shape({}, { title: text, folded: flag });
export const commentCheck = shape({
	id: nonEmptyText, highlightId: nonEmptyText, content: text, createdAt: timestamp,
	showTimestamp: flag, source: choice('pdf', 'canvas', 'excalidraw', 'markdown')
});

export const highlightCheck: ValueCheck = (value, path, check) => {
	check.fields(value, path, {
		id: nonEmptyText, pdfPath: nonEmptyText, page: numeric(0, Infinity, true), rotation: numeric(-Infinity, Infinity, true),
		rects: (rects, rectPath, validator) => validator.array(rects, rectPath, rectangle),
		text, color: choice('moss', 'amber', 'brick', 'indigo', 'plum'), chapterPath: texts, tags: texts,
		createdAt: timestamp, updatedAt: timestamp
	}, { target, pageLabel: nonEmptyText, sourceFingerprint: shape({ mtime: timestamp, size: numeric(0) }) });
	if (!check.object(value, path)) return;
	if (typeof value.rotation === 'number' && value.rotation % 90 !== 0) check.issue(`${path}.rotation`, '旋转必须为 90 度的整数倍');
	if (Array.isArray(value.rects)) value.rects.forEach((rect, index) => {
		if (typeof rect !== 'object' || rect === null) return;
		const { x, y, width, height } = rect;
		if (typeof x === 'number' && typeof width === 'number' && x + width > 1.000001) check.issue(`${path}.rects[${index}]`, '矩形超出归一化页面宽度');
		if (typeof y === 'number' && typeof height === 'number' && y + height > 1.000001) check.issue(`${path}.rects[${index}]`, '矩形超出归一化页面高度');
	});
};

export const deletedAnnotationCheck: ValueCheck = (value, path, check) => {
	check.fields(value, path, {
		highlight: highlightCheck, comments: (comments, commentsPath, validator) => validator.array(comments, commentsPath, commentCheck),
		deletedAt: timestamp, reason: choice('target-deleted', 'user-deleted')
	}, { excerptCard: cardCheck });
};

export const settingsCheck = shape({}, {
	libraryFolders: texts, importedBookshelf: flag, excerptTemplate: text, shelf: shelfStateCheck,
	storage: shape({}, {
		enabled: flag, imageHostEnabled: flag, provider: choice('oss', 'cos'), endpoint: text, region: text,
		bucket: text, prefix: text, accessKeyId: text, secretAccessKey: text
	}),
	viewer: shape({}, { scrollMode: choice('continuous', 'single'), invertPdf: choice('auto', 'on', 'off'), outlineStyle: choice('tree', 'bullet') })
});
