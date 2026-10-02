import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BibliographicImportService } from '../../../src/portability/BibliographicImportService';
import { BibliographicImportPanel } from '../../../src/ui/portability/BibliographicImportPanel';
import { BackupRestorePanel } from '../../../src/ui/portability/BackupRestorePanel';
import { RepositoryRecoveryPanel } from '../../../src/ui/portability/RepositoryRecoveryPanel';
import { ExcerptTemplatePanel } from '../../../src/ui/portability/ExcerptTemplatePanel';
import { ImportExportPanel, type ImportExportPanelHost } from '../../../src/ui/portability/ImportExportPanel';
import type { BackupPanelPreview } from '../../../src/ui/portability/DataPanelHost';
import { previewExcerptTemplate } from '../../../src/targets/ExcerptTemplate';
import { PanelDocument, PanelElement, byLabel, flushPanel } from './PanelTestDom';

let document: PanelDocument;
beforeEach(() => { document = new PanelDocument(); vi.stubGlobal('document', document); });
afterEach(() => vi.unstubAllGlobals());
function root(element: HTMLElement): PanelElement { return element as unknown as PanelElement; }
function legacyHost(): ImportExportPanelHost {
	return { status: () => ({ importedBookshelf: false }), importLegacy: vi.fn(async () => ({ importedBookCount: 1, skippedBookCount: 0, importedCategoryCount: 0, alreadyImported: false })), exportMarkdown: () => '# Shelf', exportJson: () => '{"books":[]}' };
}

const sourceText = '[{"id":"one","type":"article","title":"Paper","attachments":[{"path":"/exports/paper.pdf"}]}]';

describe('local bibliographic import panel', () => {
	it('selects a file, previews candidates, explicitly confirms a mapping and passes the original plan', async () => {
		const service = new BibliographicImportService();
		const prepare = vi.fn((_provider, text, mappings) => service.plan(service.parse('csl', text), [], { availablePaths: ['Library/paper.pdf'], pathMappings: mappings }));
		const apply = vi.fn();
		const panel = new BibliographicImportPanel({ prepareBibliographicImport: prepare, applyBibliographicImport: apply });
		const element = root(panel.root);
		byLabel(element, '选择文献导出文件').choose(sourceText); await flushPanel();
		expect(prepare).toHaveBeenCalledWith('csl', sourceText, {});
		expect(byLabel(element, '确认导入文献').disabled).toBe(true);
		byLabel(element, '确认关联：Paper').click(); await flushPanel();
		expect(prepare).toHaveBeenLastCalledWith('csl', sourceText, { 'csl:one': 'Library/paper.pdf' });
		const planned = prepare.mock.results[1].value;
		byLabel(element, '确认导入文献').click(); await flushPanel();
		expect(apply).toHaveBeenCalledWith(planned);
		expect(apply.mock.calls[0][0]).toBe(planned);
		expect(byLabel(element, '确认导入文献').disabled).toBe(true);
	});

	it('invalidates the previous preview after a path edit and blocks invalid file application', async () => {
		const service = new BibliographicImportService();
		const apply = vi.fn();
		const panel = new BibliographicImportPanel({ prepareBibliographicImport: (_provider, text, mappings) => service.plan(service.parse('csl', text), [], { availablePaths: ['Library/paper.pdf'], pathMappings: mappings }), applyBibliographicImport: apply });
		const element = root(panel.root);
		byLabel(element, '选择文献导出文件').choose(sourceText); await flushPanel();
		byLabel(element, '确认关联：Paper').click(); await flushPanel();
		byLabel(element, '关联路径：Paper').input('../bad.pdf');
		byLabel(element, '确认导入文献').click(); expect(apply).not.toHaveBeenCalled();
		byLabel(element, '确认路径并重新预览').click(); await flushPanel();
		expect(element.textContent).toContain('冲突 1');
		expect(byLabel(element, '确认导入文献').disabled).toBe(true);
		byLabel(element, '选择文献导出文件').choose('{broken'); await flushPanel();
		expect(element.textContent).toContain('JSON 语法无效');
		byLabel(element, '确认导入文献').click(); expect(apply).not.toHaveBeenCalled();
	});

	it('does not evaluate markup or render stale async content after disposal', async () => {
		const service = new BibliographicImportService();
		const prepare = vi.fn(() => new Promise<ReturnType<typeof service.plan>>(resolve => {
			resolve(service.plan(service.parse('csl', '[{"id":"one","type":"book","title":"<script>hack()</script>"}]'), []));
		}));
		const panel = new BibliographicImportPanel({ prepareBibliographicImport: prepare });
		byLabel(root(panel.root), '选择文献导出文件').choose(sourceText);
		panel.destroy(); await flushPanel();
		expect(prepare).not.toHaveBeenCalled();
		expect(root(panel.root).querySelector('script')).toBeNull();
	});
});

describe('full backup restore panel', () => {
	function preview(): BackupPanelPreview { return { summary: ['新增书目 1，更新标注 2'], paths: [{ key: 'Library/paper.pdf', originalPath: 'Library/paper.pdf' }], warnings: ['完整备份不复制 PDF 文件'], canApply: true, plan: { token: 'original' } }; }

	it('exports a complete backup and requires a preview plus backup acknowledgement before restore', async () => {
		const planned = preview();
		const download = vi.fn(); const restore = vi.fn();
		const panel = new BackupRestorePanel({ exportBackup: () => '{"schemaVersion":1}', previewBackup: () => planned, restoreBackup: restore }, download);
		const element = root(panel.root);
		byLabel(element, '导出完整备份').click(); await flushPanel();
		expect(download.mock.calls[0][1]).toMatch(/^reading-desk-完整备份-\d{4}-\d{2}-\d{2}\.json$/);
		byLabel(element, '选择 Reading Desk 完整备份文件').choose('{"backup":true}'); await flushPanel();
		expect(element.textContent).toContain('新增书目 1，更新标注 2');
		byLabel(element, '确认恢复完整备份').click(); expect(restore).not.toHaveBeenCalled();
		const acknowledgement = byLabel(element, '我已备份当前数据，并核对恢复差异与路径映射');
		acknowledgement.checked = true; acknowledgement.change();
		byLabel(element, '确认恢复完整备份').click(); expect(restore).not.toHaveBeenCalled();
		byLabel(element, '再次确认恢复完整备份').click(); await flushPanel();
		expect(restore.mock.calls[0][0]).toBe(planned);
		expect(restore.mock.calls[0][0].plan).toBe(planned.plan);
		expect(byLabel(element, '确认恢复完整备份').disabled).toBe(true);
	});

	it('requires a refreshed preview after editing mappings and blocks a rejected plan', async () => {
		const restore = vi.fn(); const prepare = vi.fn(() => preview());
		const panel = new BackupRestorePanel({ previewBackup: prepare, restoreBackup: restore }, vi.fn());
		const element = root(panel.root);
		byLabel(element, '选择 Reading Desk 完整备份文件').choose('{}'); await flushPanel();
		const acknowledgement = byLabel(element, '我已备份当前数据，并核对恢复差异与路径映射');
		acknowledgement.checked = true; acknowledgement.change();
		byLabel(element, '恢复路径：Library/paper.pdf').input('Moved/paper.pdf');
		expect(acknowledgement.checked).toBe(false);
		byLabel(element, '确认恢复完整备份').click(); expect(restore).not.toHaveBeenCalled();
		prepare.mockImplementation(() => ({ ...preview(), canApply: false, warnings: ['冲突'] }));
		byLabel(element, '重新预览恢复差异').click(); await flushPanel();
		expect(prepare).toHaveBeenLastCalledWith('{}', { 'Library/paper.pdf': 'Moved/paper.pdf' }, { mode: 'replace', conflictPolicy: 'use-backup' });
		acknowledgement.checked = true; acknowledgement.change();
		expect(byLabel(element, '确认恢复完整备份').disabled).toBe(true);
	});

	it('disables operations during a restore and reports backup failures without claiming success', async () => {
		let rejectRestore: (error: Error) => void = () => undefined;
		const restore = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectRestore = reject; }));
		const panel = new BackupRestorePanel({ previewBackup: () => preview(), restoreBackup: restore }, vi.fn());
		const element = root(panel.root);
		byLabel(element, '选择 Reading Desk 完整备份文件').choose('{}'); await flushPanel();
		const acknowledgement = byLabel(element, '我已备份当前数据，并核对恢复差异与路径映射');
		acknowledgement.checked = true; acknowledgement.change();
		byLabel(element, '确认恢复完整备份').click();
		byLabel(element, '再次确认恢复完整备份').click();
		expect(byLabel(element, '确认恢复完整备份').disabled).toBe(true);
		rejectRestore(new Error('无法保存恢复前备份')); await flushPanel();
		expect(element.textContent).toContain('无法保存恢复前备份');
		expect(element.textContent).not.toContain('完整备份恢复完成');
	});
});

describe('repository and recovery panel', () => {
	it('shows unsaved diagnostics, retries, requires a second reload click, and routes all recovery actions', async () => {
		const retry = vi.fn(); const reload = vi.fn(); const target = vi.fn(); const restore = vi.fn(); const repair = vi.fn();
		const panel = new RepositoryRecoveryPanel({
			repositoryStatus: () => ({ phase: 'pending', pending: true, initialized: true, revision: 3, diagnostics: [], error: { code: 'save-failed', message: '磁盘写入失败' } }),
			retryRepository: retry, reloadRepository: reload,
			recoveryStatus: () => ({ pendingTargets: [{ id: 'write', label: '摘录待写' }], deletedAnnotations: [{ id: 'deleted', label: '已删引文' }], repairs: [{ id: 'Targets/damaged.md', label: '损坏目标', detail: 'JSON 标记不完整' }] }),
			retryTargetWrite: target, restoreDeletedAnnotation: restore, recheckTarget: repair
		});
		const element = root(panel.root); await flushPanel();
		expect(element.textContent).toContain('磁盘写入失败');
		byLabel(element, '重试保存当前数据').click(); await flushPanel(); expect(retry).toHaveBeenCalledOnce();
		byLabel(element, '重载外部数据').click(); expect(reload).not.toHaveBeenCalled();
		expect(element.textContent).toContain('可能放弃当前未保存变更');
		byLabel(element, '取消重载确认').click();
		byLabel(element, '重载外部数据').click(); byLabel(element, '重载外部数据').click(); await flushPanel();
		expect(reload).toHaveBeenCalledOnce();
		byLabel(element, '重试目标写入：摘录待写').click(); await flushPanel(); expect(target).toHaveBeenCalledWith('write');
		byLabel(element, '恢复已删除标注：已删引文').click(); await flushPanel(); expect(restore).toHaveBeenCalledWith('deleted');
		byLabel(element, '重新检查目标：损坏目标').click(); await flushPanel(); expect(repair).toHaveBeenCalledWith('Targets/damaged.md');
	});
});

describe('fixed placeholder template panel', () => {
	it('uses renderer preview, preserves script-looking text and blocks unknown or unpreviewed templates', async () => {
		const save = vi.fn();
		const panel = new ExcerptTemplatePanel({ excerptTemplate: () => ({ template: '{{text}}', placeholders: ['text', 'page'] }), previewExcerptTemplate: template => previewExcerptTemplate(template, { title: 'Title', text: '<b>Quoted</b>', page: '1', pdfPath: 'a.pdf', sourceLink: 'obsidian://reading-desk', color: '#ff0', chapterPath: '', tags: '' }), saveExcerptTemplate: save });
		const element = root(panel.root); await flushPanel();
		const input = byLabel(element, '摘录模板');
		input.input('{{unknown}}'); byLabel(element, '预览摘录模板').click(); await flushPanel();
		expect(byLabel(element, '保存摘录模板').disabled).toBe(true);
		input.input('{{text}} ${alert(1)}'); byLabel(element, '预览摘录模板').click(); await flushPanel();
		expect(element.querySelector('pre')?.textContent).toBe('<b>Quoted</b> ${alert(1)}');
		expect(element.querySelector('b')).toBeNull();
		byLabel(element, '保存摘录模板').click(); await flushPanel();
		expect(save).toHaveBeenCalledWith('{{text}} ${alert(1)}');
		input.input('Changed'); expect(byLabel(element, '保存摘录模板').disabled).toBe(true);
	});
});

describe('legacy host compatibility', () => {
	it('keeps Bookshelf import and shelf export with only the old host API', async () => {
		const container = document.createElement('div'); const host = legacyHost();
		const panel = new ImportExportPanel(host); panel.render(container as unknown as HTMLElement); await flushPanel();
		expect(container.querySelector('.rd-backup-panel')).toBeNull();
		byLabel(container, '导入旧 Bookshelf 数据').click();
		expect(host.importLegacy).not.toHaveBeenCalled();
		byLabel(container, '确认导入旧 Bookshelf 数据').click(); await flushPanel();
		expect(host.importLegacy).toHaveBeenCalledOnce();
		expect(byLabel(container, '导出书架 JSON')).toBeDefined();
		panel.destroy(); expect(container.children).toHaveLength(0);
	});

	it('renders optional sections only when their hosts exist and drops stale status results', async () => {
		let resolveStatus: (value: { importedBookshelf: boolean }) => void = () => undefined;
		const host = { ...legacyHost(), status: () => new Promise<{ importedBookshelf: boolean }>(resolve => { resolveStatus = resolve; }), exportBackup: () => '{}' };
		const container = document.createElement('div'); const panel = new ImportExportPanel(host);
		panel.render(container as unknown as HTMLElement);
		expect(container.querySelector('.rd-backup-panel')).not.toBeNull();
		panel.destroy(); resolveStatus({ importedBookshelf: true }); await flushPanel();
		expect(container.children).toHaveLength(0);
	});
});
