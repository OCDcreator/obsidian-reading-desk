import type { BackupRestorePreview } from '../portability/ReadingDeskBackupService';
import type { BackupPanelPreview } from '../ui/portability/DataPanelHost';

/** Presents references and counts without exposing credentials or treating presentation as a restore plan. */
export function presentBackupPreview(plan: BackupRestorePreview, mappings: Record<string, string>): BackupPanelPreview {
	const references = new Map<string, string>();
	const add = (path: string | undefined, kind: string) => { if (path) references.set(path, references.get(path) ?? kind); };
	for (const book of Object.values(plan.data.books)) { add(book.path, '源文件'); add(book.coverPath, '封面'); }
	for (const highlight of [...Object.values(plan.data.highlights), ...Object.values(plan.data.pendingTargetWrites ?? {}), ...Object.values(plan.data.deletedAnnotations ?? {}).map(item => item.highlight)]) {
		add(highlight.pdfPath, '源文件'); add(highlight.target?.path, '目标笔记');
	}
	for (const folder of plan.data.settings.libraryFolders) add(folder, '书库目录');
	const pathChanges = new Map(plan.pathChanges.map(change => [change.to, change.from]));
	return {
		summary: plan.changes.map(change => `${change.collection}：新增 ${change.added}，更新 ${change.updated}，移除 ${change.removed}，不变 ${change.unchanged}`),
		paths: [...references].map(([path, kind]) => {
			const original = pathChanges.get(path) ?? path;
			return { key: original, originalPath: original, mappedPath: mappings[original] ?? path, kind };
		}),
		warnings: [...plan.warnings, ...plan.issues.filter(issue => issue.severity === 'error').map(issue => issue.message)],
		canApply: plan.canApply, plan
	};
}
