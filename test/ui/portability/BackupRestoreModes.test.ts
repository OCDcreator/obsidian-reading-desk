import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '../../../src/data/defaults';
import { ReadingDeskBackupService, type BackupRestorePreview } from '../../../src/portability/ReadingDeskBackupService';
import type { LibraryBook, ReadingDeskData } from '../../../src/types/contracts';
import { BackupRestorePanel } from '../../../src/ui/portability/BackupRestorePanel';
import type { BackupPanelOptions, BackupPanelPreview } from '../../../src/ui/portability/DataPanelHost';
import { PanelDocument, PanelElement, byLabel, flushPanel } from './PanelTestDom';

beforeEach(() => vi.stubGlobal('document', new PanelDocument()));
afterEach(() => vi.unstubAllGlobals());
const ACK = '我已备份当前数据，并核对恢复差异与路径映射';
function book(id: string, title: string): LibraryBook { return { id, title, author: '', path: `${id}.pdf`, format: 'pdf', tags: [], progress: 0, fileSize: 10, fingerprint: { size: 10, mtime: 1 } }; }
function setup() {
	const service = new ReadingDeskBackupService();
	let data = createEmptyData(); data.books.shared = book('shared', 'Current'); data.books.currentOnly = book('currentOnly', 'Current only');
	const original = structuredClone(data);
	const incoming = createEmptyData(); incoming.books.shared = book('shared', 'Backup'); incoming.books.backupOnly = book('backupOnly', 'Backup only');
	const text = service.serializeBackup(incoming);
	const backup = vi.fn(async () => undefined);
	const replace = vi.fn(async (next: ReadingDeskData) => { data = structuredClone(next); });
	const prepare = vi.fn((content: string, _mappings: Record<string, string>, options?: BackupPanelOptions): BackupPanelPreview => {
		const plan = service.previewRestore(content, data, options);
		return { plan, canApply: plan.canApply, filesIncluded: false, warnings: plan.warnings, paths: [], summary: plan.changes.map(change => `${change.collection}：新增 ${change.added}，更新 ${change.updated}，删除 ${change.removed}`) };
	});
	const restore = vi.fn(async (preview: BackupPanelPreview) => { await service.restore(preview.plan as BackupRestorePreview, { snapshot: () => data, replaceData: replace, backupBeforeRestore: backup }); });
	const panel = new BackupRestorePanel({ previewBackup: prepare, restoreBackup: restore }, vi.fn());
	const root = panel.root as unknown as PanelElement;
	return { root, text, original, prepare, restore, backup, replace, get: () => data };
}
function acknowledge(root: PanelElement): void { const checkbox = byLabel(root, ACK); checkbox.checked = true; checkbox.change(); }
function change(root: PanelElement, label: string, value: string): void { const select = byLabel(root, label); select.value = value; select.change(); }

describe('backup restore mode and conflict selection', () => {
	it('defaults to applicable replace/use-backup for real differences, backs up then replaces only after the second confirmation', async () => {
		const state = setup();
		expect(byLabel(state.root, '恢复模式').value).toBe('replace');
		expect(byLabel(state.root, '恢复冲突处理').value).toBe('use-backup');
		expect(state.root.textContent).toContain('完整替换将覆盖当前插件数据');
		byLabel(state.root, '选择 Reading Desk 完整备份文件').choose(state.text); await flushPanel();
		expect(state.prepare).toHaveBeenLastCalledWith(state.text, {}, { mode: 'replace', conflictPolicy: 'use-backup' });
		expect(state.prepare.mock.results[0].value.canApply).toBe(true);
		expect(state.root.textContent).toContain('books：新增 1，更新 1，删除 1');
		acknowledge(state.root); byLabel(state.root, '确认恢复完整备份').click();
		expect(state.restore).not.toHaveBeenCalled(); expect(state.backup).not.toHaveBeenCalled();
		byLabel(state.root, '再次确认恢复完整备份').click(); await flushPanel();
		expect(state.backup).toHaveBeenCalledOnce(); expect(state.replace).toHaveBeenCalledOnce();
		expect(state.backup.mock.invocationCallOrder[0]).toBeLessThan(state.replace.mock.invocationCallOrder[0]);
		expect(state.get().books.shared.title).toBe('Backup'); expect(state.get().books.currentOnly).toBeUndefined();
		expect(state.root.textContent).toContain('已自动备份恢复前的本机插件数据');
	});

	it.each(['keep-current', 'use-backup'] as const)('blocks merge/error until %s is chosen and rebuilds the preview before applying', async policy => {
		const state = setup();
		byLabel(state.root, '选择 Reading Desk 完整备份文件').choose(state.text); await flushPanel();
		acknowledge(state.root); byLabel(state.root, '确认恢复完整备份').click();
		change(state.root, '恢复模式', 'merge');
		expect(byLabel(state.root, ACK).checked).toBe(false);
		expect(byLabel(state.root, '确认恢复完整备份').disabled).toBe(true);
		await flushPanel();
		expect(byLabel(state.root, '恢复冲突处理').value).toBe('error');
		expect(state.prepare.mock.results[1].value.canApply).toBe(false);
		acknowledge(state.root); byLabel(state.root, '确认恢复完整备份').click(); expect(state.restore).not.toHaveBeenCalled();
		change(state.root, '恢复冲突处理', policy); await flushPanel();
		expect(state.prepare).toHaveBeenLastCalledWith(state.text, {}, { mode: 'merge', conflictPolicy: policy });
		const freshPlan = state.prepare.mock.results[2].value;
		expect(freshPlan.canApply).toBe(true); expect(byLabel(state.root, ACK).checked).toBe(false);
		acknowledge(state.root); byLabel(state.root, '确认恢复完整备份').click();
		expect(state.restore).not.toHaveBeenCalled(); byLabel(state.root, '再次确认恢复完整备份').click(); await flushPanel();
		expect(state.restore.mock.calls[0][0]).toBe(freshPlan);
		expect(state.get().books.shared.title).toBe(policy === 'keep-current' ? 'Current' : 'Backup');
		expect(state.get().books.currentOnly).toBeDefined(); expect(state.get().books.backupOnly).toBeDefined();
	});

	it('cancels confirmation, resets merge policy when returning to replace, and leaves current data untouched', async () => {
		const state = setup();
		byLabel(state.root, '选择 Reading Desk 完整备份文件').choose(state.text); await flushPanel();
		acknowledge(state.root); byLabel(state.root, '确认恢复完整备份').click();
		byLabel(state.root, '取消恢复确认').click(); expect(state.restore).not.toHaveBeenCalled();
		expect(byLabel(state.root, ACK).checked).toBe(false);
		change(state.root, '恢复模式', 'merge'); await flushPanel();
		change(state.root, '恢复冲突处理', 'keep-current'); await flushPanel();
		change(state.root, '恢复模式', 'replace'); await flushPanel();
		expect(byLabel(state.root, '恢复冲突处理').value).toBe('use-backup');
		expect(state.prepare).toHaveBeenLastCalledWith(state.text, {}, { mode: 'replace', conflictPolicy: 'use-backup' });
		expect(state.get()).toEqual(state.original); expect(state.backup).not.toHaveBeenCalled();
	});
});
