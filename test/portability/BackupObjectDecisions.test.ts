import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../../src/data/defaults';
import { ReadingDeskBackupService } from '../../src/portability/ReadingDeskBackupService';
import { completeData, highlight } from '../data/DataRecoveryFixtures';

describe('backup decisions at object and annotation-family boundaries', () => {
	it.each(['keep-current', 'use-backup'] as const)('resolves an active/deleted collision as one complete family using %s', choice => {
		const service = new ReadingDeskBackupService(); const current = completeData(); const backup = structuredClone(current);
		backup.deletedAnnotations = { ...backup.deletedAnnotations, h: { highlight: backup.highlights.h, comments: backup.comments.h, excerptCard: backup.excerptCards.h, deletedAt: 10, reason: 'user-deleted' } };
		delete backup.highlights.h; delete backup.comments.h; delete backup.excerptCards.h;
		const blocked = service.previewRestore(service.exportBackup(backup), current, { mode: 'merge', conflictPolicy: 'use-backup' });
		expect(blocked.canApply).toBe(false); expect(blocked.objects.find(item => item.key === 'annotations:h')?.resolution).toBe('error');
		const preview = service.previewRestore(service.exportBackup(backup), current, { mode: 'merge', objectDecisions: { 'annotations:h': choice } });
		expect(preview.canApply).toBe(true);
		if (choice === 'keep-current') {
			expect(preview.data.highlights.h).toEqual(current.highlights.h); expect(preview.data.comments.h).toEqual(current.comments.h); expect(preview.data.excerptCards.h).toEqual(current.excerptCards.h); expect(preview.data.deletedAnnotations?.h).toBeUndefined();
		} else {
			expect(preview.data.highlights.h).toBeUndefined(); expect(preview.data.comments.h).toBeUndefined(); expect(preview.data.excerptCards.h).toBeUndefined(); expect(preview.data.deletedAnnotations?.h.comments).toEqual(current.comments.h);
		}
	});
	it('keeps pending, comments and cards with the selected source instead of mixing snapshots', () => {
		const service = new ReadingDeskBackupService(); const current = createEmptyData(); const backup = createEmptyData();
		current.highlights.h = highlight(); current.pendingTargetWrites = { h: highlight() }; current.comments.h = [{ id: 'c', highlightId: 'h', content: 'current comment', createdAt: 1, showTimestamp: true, source: 'pdf' }]; current.excerptCards.h = { title: 'current card' };
		backup.highlights.h = { ...highlight(), color: 'brick' };
		const plan = service.previewRestore(service.exportBackup(backup), current, { mode: 'merge', objectDecisions: { 'annotations:h': 'use-backup' } });
		expect(plan.canApply).toBe(true); expect(plan.data.highlights.h.color).toBe('brick'); expect(plan.data.pendingTargetWrites?.h).toBeUndefined(); expect(plan.data.comments.h).toBeUndefined(); expect(plan.data.excerptCards.h).toBeUndefined();
	});
	it('supports independently keeping one book and using another while hiding credentials in differences', () => {
		const service = new ReadingDeskBackupService(); const current = completeData(); const backup = structuredClone(current);
		current.books.other = { ...current.books.b, id: 'other', path: 'Books/other.pdf' }; backup.books.other = { ...current.books.other, title: 'Other backup' }; backup.books.b.title = 'Backup title';
		backup.settings.storage.secretAccessKey = 'backup-secret';
		const plan = service.previewRestore(service.exportBackup(backup, { includeCredentials: true }), current, { mode: 'merge', conflictPolicy: 'use-backup', objectDecisions: { 'books:b': 'keep-current' } });
		expect(plan.canApply).toBe(true); expect(plan.data.books.b.title).toBe('Manual title'); expect(plan.data.books.other.title).toBe('Other backup');
		expect(JSON.stringify(plan.objects)).not.toContain('backup-secret'); expect(JSON.stringify(plan.objects)).not.toContain('private-secret');
	});
	it('rejects unknown decisions and retains the immutable restore plan and freshness check', async () => {
		const service = new ReadingDeskBackupService(); const current = completeData(); const backup = structuredClone(current); backup.books.b.title = 'Backup';
		expect(() => service.previewRestore(service.exportBackup(backup), current, { objectDecisions: { 'books:absent': 'use-backup' } })).toThrow('不在当前差异');
		const plan = service.previewRestore(service.exportBackup(backup), current, { objectDecisions: { 'books:b': 'keep-current' } });
		plan.objects[0].resolution = 'use-backup'; plan.data.books.b.title = 'Mutated';
		let result = current;
		await service.restore(plan, { snapshot: () => current, backupBeforeRestore: async () => undefined, replaceData: async data => { result = data; } });
		expect(result.books.b.title).toBe('Manual title');
		const stale = service.previewRestore(service.exportBackup(backup), current, { objectDecisions: { 'books:b': 'use-backup' } }); current.books.b.title = 'New edit';
		await expect(service.restore(stale, { snapshot: () => current, backupBeforeRestore: async () => undefined, replaceData: async () => undefined })).rejects.toThrow('已变化');
	});
});
