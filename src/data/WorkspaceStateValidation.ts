import { choice, flag, nonEmptyText, numeric, shape, text, type ValueCheck } from './DataValidationSupport';

export const readerPositionCheck: ValueCheck = (value, path, validator) => {
	validator.fields(value, path, {
		page: numeric(0, Infinity, true), x: numeric(-10000, 10000), y: numeric(-10000, 10000),
		rotation: numeric(0, 270, true), scale: numeric(0.5, 3),
		fitMode: choice('manual', 'width', 'height', 'page'), updatedAt: numeric(0)
	});
	if (validator.object(value, path) && typeof value.rotation === 'number' && value.rotation % 90 !== 0) {
		validator.issue(`${path}.rotation`, '阅读位置旋转必须为 0、90、180 或 270');
	}
};
const bookmarkCheck = shape({ id: nonEmptyText, name: nonEmptyText, position: readerPositionCheck, createdAt: numeric(0), updatedAt: numeric(0) });
export const bookmarksCheck: ValueCheck = (value, path, validator) => {
	validator.array(value, path, bookmarkCheck);
	if (!Array.isArray(value)) return;
	const ids = new Set<string>();
	for (const bookmark of value) {
		if (typeof bookmark?.id !== 'string') continue;
		if (ids.has(bookmark.id)) validator.issue(path, '书签 ID 重复');
		ids.add(bookmark.id);
	}
};
export const shelfStateCheck = shape({
	mode: choice('cards', 'table', 'annotations'), page: numeric(1, Infinity, true),
	query: shape({ query: text, sort: choice('title', 'author', 'recent', 'rating', 'progress') }, {
		categoryId: text, format: choice('pdf', 'epub'), tag: text, minRating: numeric(0, 5),
		readingStatus: choice('unread', 'reading', 'finished', 'abandoned'), listId: text, missingOnly: flag
	})
});
