import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BibliographicImportPanel } from '../../../src/ui/portability/BibliographicImportPanel';
import { BibliographicImportService } from '../../../src/portability/BibliographicImportService';
import { BackupRestorePanel } from '../../../src/ui/portability/BackupRestorePanel';
import { ReadingDeskBackupService } from '../../../src/portability/ReadingDeskBackupService';
import { presentBackupPreview } from '../../../src/host/DataPanelPresentation';
import { createEmptyData } from '../../../src/data/defaults';
import { highlight } from '../../data/DataRecoveryFixtures';
import { PanelDocument, PanelElement, byLabel, flushPanel } from './PanelTestDom';

beforeEach(() => vi.stubGlobal('document', new PanelDocument()));
afterEach(() => vi.unstubAllGlobals());

describe('individual import and restore decisions', () => {
	it('only bulk confirms unique matched vault attachments and sends explicit selected keys', async () => {
		const service = new BibliographicImportService(); const apply = vi.fn();
		const prepare = vi.fn((_provider, text, mappings) => service.plan(service.parse('csl', text), [], { availablePaths: ['Books/one.pdf', 'Books/two.pdf', 'A/shared.pdf', 'B/shared.pdf'], pathMappings: mappings }));
		const panel = new BibliographicImportPanel({ prepareBibliographicImport: prepare, applyBibliographicImport: apply }); const root = panel.root as unknown as PanelElement;
		byLabel(root, '选择文献导出文件').choose(JSON.stringify([{ id: 'one', type: 'book', title: 'One', file: '/external/one.pdf' }, { id: 'two', type: 'book', title: 'Two', file: 'two.pdf' }, { id: 'many', type: 'book', title: 'Many', file: 'shared.pdf' }, { id: 'none', type: 'book', title: 'None' }])); await flushPanel();
		byLabel(root, '批量确认唯一候选附件').click(); await flushPanel();
		expect(prepare.mock.calls[1][2]).toEqual({ 'csl:one': 'Books/one.pdf', 'csl:two': 'Books/two.pdf' });
		expect(byLabel(root, '选择导入：Many').disabled).toBe(true); expect(byLabel(root, '选择导入：None').disabled).toBe(true);
		const one = byLabel(root, '选择导入：One'); one.checked = false; one.change();
		expect(root.textContent).toContain('可应用 1 条；跳过 3 条');
		byLabel(root, '确认导入文献').click(); await flushPanel();
		expect(apply.mock.calls[0][1]).toEqual(['csl:two']);
	});
	it('keeps selection across preview pagination and supports explicit select/clear all', async () => {
		const service = new BibliographicImportService(); const apply = vi.fn();
		const paths = Array.from({ length: 102 }, (_, i) => `Books/${i}.pdf`);
		const panel = new BibliographicImportPanel({ prepareBibliographicImport: (_provider, text, mappings) => service.plan(service.parse('csl', text), [], { availablePaths: paths, pathMappings: mappings }), applyBibliographicImport: apply }); const root = panel.root as unknown as PanelElement;
		byLabel(root, '选择文献导出文件').choose(JSON.stringify(paths.map((file, i) => ({ id: String(i), type: 'book', title: `Book ${i}`, file })))); await flushPanel();
		byLabel(root, '批量确认唯一候选附件').click(); await flushPanel();
		byLabel(root, '取消全部文献选择').click(); expect(byLabel(root, '确认导入文献').disabled).toBe(true);
		byLabel(root, '选择全部可应用文献').click();
		const first = byLabel(root, '选择导入：Book 0'); first.checked = false; first.change();
		byLabel(root, '文献预览下一页').click(); const last = byLabel(root, '选择导入：Book 101'); last.checked = false; last.change();
		byLabel(root, '文献预览上一页').click(); expect(byLabel(root, '选择导入：Book 0').checked).toBe(false);
		byLabel(root, '确认导入文献').click(); await flushPanel(); expect(apply.mock.calls[0][1]).toHaveLength(100);
	});
	it('makes active/deleted choices explicit, invalidates confirmation, then restores the selected family', async () => {
		const service = new ReadingDeskBackupService(); let current = createEmptyData(); current.highlights.h = highlight();
		const backup = createEmptyData(); backup.deletedAnnotations = { h: { highlight: highlight(), comments: [], deletedAt: 1, reason: 'user-deleted' } };
		const prepare = vi.fn((text, mappings, options) => presentBackupPreview(service.previewRestore(text, current, options), mappings));
		const restore = vi.fn(async preview => { await service.restore(preview.plan, { snapshot: () => current, backupBeforeRestore: async () => undefined, replaceData: async value => { current = value; } }); });
		const panel = new BackupRestorePanel({ previewBackup: prepare, restoreBackup: restore }, vi.fn()); const root = panel.root as unknown as PanelElement;
		byLabel(root, '选择 Reading Desk 完整备份文件').choose(service.serializeBackup(backup)); await flushPanel();
		expect(byLabel(root, '确认恢复完整备份').disabled).toBe(true);
		const decision = byLabel(root, '恢复决策：annotations:h'); decision.value = 'keep-current'; decision.change();
		byLabel(root, '重新预览恢复差异').click(); await flushPanel();
		const acknowledgement = byLabel(root, '我已备份当前数据，并核对恢复差异与路径映射'); acknowledgement.checked = true; acknowledgement.change();
		expect(byLabel(root, '确认恢复完整备份').disabled).toBe(false);
		byLabel(root, '确认恢复完整备份').click();
		const changed = byLabel(root, '恢复决策：annotations:h'); changed.value = 'use-backup'; changed.change();
		expect(acknowledgement.checked).toBe(false); expect(restore).not.toHaveBeenCalled();
		byLabel(root, '重新预览恢复差异').click(); await flushPanel(); acknowledgement.checked = true; acknowledgement.change();
		byLabel(root, '确认恢复完整备份').click(); byLabel(root, '再次确认恢复完整备份').click(); await flushPanel();
		expect(restore).toHaveBeenCalledOnce(); expect(current.highlights.h).toBeUndefined(); expect(current.deletedAnnotations?.h).toBeDefined();
	});
});
