import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '../../../src/data/defaults';
import { presentBackupPreview } from '../../../src/host/DataPanelPresentation';
import { ReadingDeskBackupService } from '../../../src/portability/ReadingDeskBackupService';
import { BackupRestorePanel } from '../../../src/ui/portability/BackupRestorePanel';
import type { ReadingDeskData } from '../../../src/types/contracts';
import { highlight } from '../../data/DataRecoveryFixtures';
import { PanelDocument, PanelElement, byLabel, flushPanel } from './PanelTestDom';

beforeEach(() => vi.stubGlobal('document', new PanelDocument()));
afterEach(() => vi.unstubAllGlobals());

describe('own backup through the restore file input', () => {
	it('restores a UTF-8 backup larger than the bibliographic 10 MiB limit', async () => {
		const service = new ReadingDeskBackupService();
		const source = createEmptyData();
		source.books.b = { id: 'b', path: 'Books/first.pdf', title: 'Book', author: '', format: 'pdf', tags: [], progress: 0, fileSize: 1, fingerprint: { mtime: 1, size: 1 } };
		for (let index = 0; index < 2500; index++) source.highlights[`h${index}`] = { ...highlight(`h${index}`), text: '摘录文字'.repeat(400) };
		source.comments.h0 = [{ id: 'comment', highlightId: 'h0', content: 'Keep comment', createdAt: 1, showTimestamp: true, source: 'pdf' }];
		source.deletedAnnotations = { deleted: { highlight: highlight('deleted'), comments: [], deletedAt: 2, reason: 'user-deleted' } };
		let current: ReadingDeskData = createEmptyData();
		let backupCount = 0;
		const download = vi.fn();
		const panel = new BackupRestorePanel({
			exportBackup: () => service.serializeBackup(source),
			previewBackup: (text, mappings, options) => presentBackupPreview(service.previewRestore(text, current, options), mappings),
			restoreBackup: async preview => { await service.restore(preview.plan as ReturnType<typeof service.previewRestore>, {
				snapshot: () => current, backupBeforeRestore: async () => { backupCount++; }, replaceData: async value => { current = value; }
			}); }
		}, download);
		const root = panel.root as unknown as PanelElement;
		byLabel(root, '导出完整备份').click(); await flushPanel();
		const exported = download.mock.calls[0][0] as string;
		const bytes = new TextEncoder().encode(exported).length;
		expect(bytes).toBeGreaterThan(10 * 1024 * 1024);
		const picker = byLabel(root, '选择 Reading Desk 完整备份文件');
		picker.files = [{ size: bytes, text: async () => exported }]; picker.change(); await flushPanel();
		expect(root.textContent).not.toContain('文件超过 10 MiB');
		const acknowledgement = byLabel(root, '我已备份当前数据，并核对恢复差异与路径映射');
		acknowledgement.checked = true; acknowledgement.change();
		expect(byLabel(root, '确认恢复完整备份').disabled).toBe(false);
		byLabel(root, '确认恢复完整备份').click(); byLabel(root, '再次确认恢复完整备份').click(); await flushPanel();
		expect(backupCount).toBe(1);
		expect(current.highlights).toEqual(source.highlights);
		expect(current.comments).toEqual(source.comments);
		expect(current.deletedAnnotations).toEqual(source.deletedAnnotations);
	});
});
