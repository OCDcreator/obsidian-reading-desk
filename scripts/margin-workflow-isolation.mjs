import { createEmptyData } from '../src/data/defaults.ts';
import { ReadingDeskRepository } from '../src/data/ReadingDeskRepository.ts';
import { LibraryIndex } from '../src/library/LibraryIndex.ts';
import { AnnotationStore } from '../src/annotations/AnnotationStore.ts';
import { TargetService } from '../src/targets/TargetService.ts';
import { ReadingDeskDataManagement } from '../src/portability/ReadingDeskDataManagement.ts';
import { ReadingDeskBackupService } from '../src/portability/ReadingDeskBackupService.ts';
import { RecoverySnapshotService } from '../src/portability/RecoverySnapshotService.ts';
import { presentBackupPreview } from '../src/host/DataPanelPresentation.ts';
import { ImportExportPanel } from '../src/ui/portability/ImportExportPanel.ts';

/** Actual domain services behind a memory-only sink/gateway. No app, vault or filesystem API is passed in. */
export async function createWorkflowIsolation(runId, sourcePath) {
	if (!/^[a-zA-Z0-9_-]+$/.test(runId) || !sourcePath || sourcePath.includes('..')) throw new Error('Invalid isolation identity');
	const clone = value => structuredClone(value), initial = createEmptyData(), familyId = 'qa-anchor-' + runId;
	const now = Date.now(), counters = { saves: 0, overwrites: 0, restores: 0, restoreBackups: 0, imports: [], cleanupCalls: 0, removed: [] };
	initial.books['qa-book-' + runId] = { id: 'qa-book-' + runId, path: sourcePath, format: 'pdf', title: 'Isolated current book ' + runId,
		author: 'Fixture author', tags: [], progress: 0, fileSize: 1, fingerprint: { mtime: 1, size: 1 } };
	initial.highlights[familyId] = { id: familyId, pdfPath: sourcePath, page: 0, rotation: 0, rects: [{ x: .1, y: .1, width: .2, height: .05 }],
		text: 'Current isolated quote', color: 'moss', chapterPath: [], tags: [], createdAt: now, updatedAt: now };
	initial.comments[familyId] = [{ id: 'qa-comment-' + runId, highlightId: familyId, content: 'Isolated family comment', createdAt: now, showTimestamp: true, source: 'pdf' }];
	initial.settings.storage.accessKeyId = 'QA-CREDENTIAL-DO-NOT-DISPLAY';
	initial.settings.storage.secretAccessKey = 'QA-SECRET-DO-NOT-DISPLAY';
	let disk = clone(initial);
	const savedOriginals = [], restoreBackups = [];
	const repository = new ReadingDeskRepository({ load: async () => clone(disk), save: async value => { disk = clone(value); counters.saves++; } },
		{ beforeOverwrite: async value => { savedOriginals.push(clone(value)); counters.overwrites++; } });
	await repository.initialize();
	const library = new LibraryIndex(repository, { extract: async () => { throw new Error('Isolation must not extract real files'); } });
	const annotations = new AnnotationStore(repository);
	const targets = new TargetService({ read: async () => { throw new Error('No target I/O in settings isolation'); }, atomicTransform: async () => { throw new Error('No target I/O in settings isolation'); } });
	// One real fixture path and additional logical memory-gateway candidates, never claimed to exist on disk.
	const logicalFiles = Array.from({ length: 102 }, (_, index) => ({ path: 'ReadingDesk-QA-' + runId + '/attachments/' + index + '.pdf', stat: { mtime: 1, size: 1 } }));
	const management = new ReadingDeskDataManagement(repository, library, annotations, targets, {
		availableFiles: () => clone(logicalFiles), allPaths: () => [sourcePath, ...logicalFiles.map(file => file.path)],
		backupBeforeRestore: async backup => { restoreBackups.push(clone(backup)); counters.restoreBackups++; }, refresh: async () => undefined
	});
	const backupService = new ReadingDeskBackupService(), incoming = clone(initial);
	delete incoming.highlights[familyId]; delete incoming.comments[familyId];
	incoming.deletedAnnotations[familyId] = { highlight: clone(initial.highlights[familyId]), comments: clone(initial.comments[familyId]), deletedAt: now, reason: 'user-deleted' };
	incoming.books['qa-book-' + runId].title = 'Backup title with long words / 恢复差异长标题，用于当前主题的换行检查 ' + runId;
	const backupText = backupService.serializeBackup(incoming), root = 'ReadingDesk-QA-' + runId + '/recovery';
	const files = new Map();
	const add = (name, text, mtime, directory = false) => files.set(root + '/' + name, { path: root + '/' + name, text, size: new TextEncoder().encode(text).length, mtime, directory });
	for (let index = 1; index <= 3; index++) add('2020-01-0' + index + 'T00-00-00-000Z-' + index + '-commit.json', JSON.stringify(initial), index);
	add('manual.json', JSON.stringify(initial), 4); add('before-restore.json', JSON.stringify(initial), 5);
	add('broken.json', '{', 6); add('archive', '', 7, true);
	const gateway = {
		root, list: async () => [...files.values()].map(({ path, size, mtime, directory }) => ({ path, size, mtime, directory })),
		read: async filePath => { const file = files.get(filePath); if (!file || file.directory) throw new Error('Unknown memory snapshot'); return file.text; },
		remove: async filePath => {
			if (!filePath.startsWith(root + '/') || !files.has(filePath) || files.get(filePath).directory) throw new Error('Refuse nonfixture snapshot');
			files.delete(filePath); counters.removed.push(filePath);
		}
	};
	const snapshots = new RecoverySnapshotService(gateway);
	let latestPreview, latestImport, latestCleanup, panel, container;
	const host = {
		importLegacy: () => { throw new Error('Legacy import is outside this fixture'); }, status: () => ({ importedBookshelf: true }), exportMarkdown: () => '', exportJson: () => '{}',
		repositoryStatus: () => repository.status(), exportBackup: () => management.exportBackup(),
		prepareBibliographicImport: (provider, text, mappings) => { latestImport = management.prepareBibliographicImport(provider, text, mappings); return latestImport; },
		applyBibliographicImport: async (plan, keys) => { await management.applyBibliographicImport(plan, keys); counters.imports.push([...keys]); },
		previewBackup: (text, mappings, options) => { latestPreview = presentBackupPreview(management.previewBackup(text, mappings, options), mappings); return latestPreview; },
		restoreBackup: async preview => { await management.restoreBackup(preview.plan); counters.restores++; },
		recoverySnapshots: () => snapshots.inventory(), loadRecoverySnapshot: entry => snapshots.backupText(entry),
		previewSnapshotCleanup: async policy => { latestCleanup = await snapshots.previewCleanup(policy); return latestCleanup; },
		cleanupSnapshots: async plan => { counters.cleanupCalls++; return snapshots.cleanup(plan); }
	};
	return {
		host, repository, snapshots, gateway, backupText, familyId,
		bibliographyText: JSON.stringify(logicalFiles.map((file, index) => ({ id: 'qa-' + index, type: 'book', title: 'Isolated import ' + index, file: file.path }))),
		mount(target) { if (panel) throw new Error('Isolation already mounted'); container = target; panel = new ImportExportPanel(host); panel.render(target); },
		inspect: () => ({ counters: clone(counters), status: repository.status(), books: clone(disk.books), activeFamily: !!disk.highlights[familyId], deletedFamily: !!disk.deletedAnnotations[familyId],
			comments: clone(disk.comments[familyId] ?? []), deletedComments: clone(disk.deletedAnnotations[familyId]?.comments ?? []), snapshotPaths: [...files.keys()],
			preview: latestPreview ? { canApply: latestPreview.canApply, objects: clone(latestPreview.objects), warnings: latestPreview.warnings,
				activeFamily: !!latestPreview.plan.data.highlights[familyId], deletedFamily: !!latestPreview.plan.data.deletedAnnotations[familyId] } : null,
			import: latestImport ? { entries: latestImport.entries.map(entry => ({ key: entry.key, kind: entry.kind, pathConfirmed: entry.pathConfirmed })) } : null,
			cleanupCandidates: latestCleanup?.candidates.map(entry => entry.path) ?? [] }),
		dispose() { panel?.destroy(); container?.remove(); panel = undefined; container = undefined; files.clear(); savedOriginals.length = 0; restoreBackups.length = 0; }
	};
}
