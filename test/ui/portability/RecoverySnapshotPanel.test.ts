import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoverySnapshotPanel } from '../../../src/ui/portability/RecoverySnapshotPanel';
import { BackupRestorePanel } from '../../../src/ui/portability/BackupRestorePanel';
import type { RecoveryCleanupPreview, RecoverySnapshotEntry } from '../../../src/portability/RecoverySnapshotService';
import { PanelDocument, PanelElement, byLabel, flushPanel } from './PanelTestDom';

beforeEach(() => vi.stubGlobal('document', new PanelDocument()));
afterEach(() => vi.unstubAllGlobals());
const entry: RecoverySnapshotEntry = { path: 'recovery/old.json', name: 'old.json', bytes: 1024, modifiedAt: 1, automatic: true, valid: true, canRestore: true };
const plan = (): RecoveryCleanupPreview => ({ candidates: [entry], bytes: 1024, protectedCount: 1, policy: { mode: 'count', keep: 1 } });

describe('recovery snapshot management panel', () => {
	it('selects an index entry into the existing restore preview without applying it', async () => {
		const restore = vi.fn(); const preview = vi.fn(() => ({ summary: ['新增 1 条'], paths: [], warnings: [], canApply: true, plan: {} }));
		const backup = new BackupRestorePanel({ previewBackup: preview, restoreBackup: restore }, vi.fn());
		const load = vi.fn(async () => '{"snapshot":true}');
		const panel = new RecoverySnapshotPanel({ recoverySnapshots: () => ({ entries: [entry], bytes: 1024, count: 1, automaticCount: 1 }), loadRecoverySnapshot: load }, text => backup.loadSnapshot(text));
		const root = panel.root as unknown as PanelElement;
		expect(load).not.toHaveBeenCalled();
		byLabel(root, '刷新快照清单').click(); await flushPanel();
		expect(root.textContent).toContain('1 个文件');
		byLabel(root, '预览恢复：old.json').click(); await flushPanel();
		expect(load).toHaveBeenCalledWith(entry); expect(preview).toHaveBeenCalledWith('{"snapshot":true}', {}, { mode: 'replace', conflictPolicy: 'use-backup' });
		expect(restore).not.toHaveBeenCalled();
		expect(byLabel(backup.root as unknown as PanelElement, '确认恢复完整备份').disabled).toBe(true);
	});
	it('requires a fresh cleanup preview, two confirmations and reports partial failures', async () => {
		const planned = plan(); const cleanup = vi.fn(async () => ({ deleted: [], failures: [{ path: entry.path, message: '没有权限' }] }));
		const preview = vi.fn(() => planned);
		const panel = new RecoverySnapshotPanel({ previewSnapshotCleanup: preview, cleanupSnapshots: cleanup, recoverySnapshots: () => ({ entries: [entry], bytes: 1024, count: 1, automaticCount: 1 }) }, vi.fn());
		const root = panel.root as unknown as PanelElement;
		byLabel(root, '预览快照清理').click(); await flushPanel();
		byLabel(root, '确认清理旧自动快照').click(); expect(cleanup).not.toHaveBeenCalled();
		byLabel(root, '保留数量或天数').input('7');
		expect(byLabel(root, '确认清理旧自动快照').disabled).toBe(true);
		byLabel(root, '预览快照清理').click(); await flushPanel();
		expect(preview).toHaveBeenLastCalledWith({ mode: 'count', keep: 7 });
		byLabel(root, '确认清理旧自动快照').click(); byLabel(root, '再次确认删除旧自动快照').click(); await flushPanel();
		expect(cleanup.mock.calls[0][0]).toBe(planned); expect(root.textContent).toContain('没有权限'); expect(root.textContent).toContain('1 项未删除');
		expect(byLabel(root, '确认清理旧自动快照').disabled).toBe(true);
	});
});
