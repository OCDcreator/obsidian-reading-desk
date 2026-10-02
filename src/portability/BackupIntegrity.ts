import type { PdfComment, ReadingDeskData } from '../types/contracts';
import type { BackupIssue } from './BackupTypes';

/** Referential checks are stricter for restore than for legacy loading; original data is always retained. */
export function checkBackupIntegrity(data: ReadingDeskData): BackupIssue[] {
	const issues: BackupIssue[] = [];
	const error = (code: BackupIssue['code'], path: string, message: string): void => { issues.push({ code, path, message, severity: 'error' }); };
	const categories = uniqueIds(data.categories, 'categories', error);
	const lists = uniqueIds(data.lists ?? [], 'lists', error);
	const paths = new Set<string>();
	for (const [id, book] of Object.entries(data.books)) {
		if (paths.has(book.path)) error('duplicate-path', `books.${id}.path`, `重复的图书路径：${book.path}`);
		paths.add(book.path);
		if (book.categoryId && !categories.has(book.categoryId)) error('reference', `books.${id}.categoryId`, '引用了不存在的分类');
		for (const listId of book.listIds ?? []) if (!lists.has(listId)) error('reference', `books.${id}.listIds`, `引用了不存在的列表：${listId}`);
		if (new Set(book.listIds ?? []).size !== (book.listIds ?? []).length) error('duplicate-id', `books.${id}.listIds`, '同一列表被重复引用');
	}
	const comments = new Set<string>();
	const checkComments = (values: PdfComment[], id: string, path: string): void => {
		for (const comment of values) {
			if (comments.has(comment.id)) error('duplicate-id', path, `重复评论 ID：${comment.id}`);
			comments.add(comment.id);
			if (comment.highlightId !== id) error('reference', path, `评论 ${comment.id} 与所属高亮不一致`);
		}
	};
	for (const [id, values] of Object.entries(data.comments)) {
		if (!data.highlights[id] && !data.pendingTargetWrites?.[id]) error('reference', `comments.${id}`, '评论引用了不存在的高亮');
		checkComments(values, id, `comments.${id}`);
	}
	for (const id of Object.keys(data.excerptCards)) {
		if (!data.highlights[id] && !data.pendingTargetWrites?.[id]) error('reference', `excerptCards.${id}`, '摘录状态引用了不存在的高亮');
	}
	for (const [id, value] of Object.entries(data.deletedAnnotations ?? {})) {
		if (value.highlight.id !== id) error('reference', `deletedAnnotations.${id}`, '删除记录键与高亮 ID 不一致');
		if (data.highlights[id]) error('conflict', `deletedAnnotations.${id}`, '同一高亮同时处于有效与删除状态');
		checkComments(value.comments, id, `deletedAnnotations.${id}.comments`);
	}
	const targets = new Map<string, string>();
	for (const [id, highlight] of Object.entries(data.highlights)) {
		if (!paths.has(highlight.pdfPath)) issues.push({ code: 'reference', path: `highlights.${id}.pdfPath`, message: '该 PDF 尚未加入书库；保留标注引用', severity: 'warning' });
		if (highlight.target?.objectId) {
			const key = `${highlight.target.type}:${highlight.target.path}:${highlight.target.objectId}`;
			if (targets.has(key)) error('conflict', `highlights.${id}.target`, `多个高亮引用同一目标对象：${targets.get(key)}`);
			targets.set(key, id);
		}
	}
	return issues;
}

function uniqueIds(values: { id: string }[], path: string, error: (code: BackupIssue['code'], path: string, message: string) => void): Set<string> {
	const ids = new Set<string>();
	for (const value of values) {
		if (ids.has(value.id)) error('duplicate-id', path, `重复 ID：${value.id}`);
		ids.add(value.id);
	}
	return ids;
}
