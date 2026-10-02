import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BibliographicImportService } from '../../../src/portability/BibliographicImportService';
import { BibliographicImportPanel } from '../../../src/ui/portability/BibliographicImportPanel';
import { BackupRestorePanel } from '../../../src/ui/portability/BackupRestorePanel';
import { RepositoryRecoveryPanel } from '../../../src/ui/portability/RepositoryRecoveryPanel';
import { PanelDocument, PanelElement, byLabel, flushPanel } from './PanelTestDom';

beforeEach(() => vi.stubGlobal('document', new PanelDocument()));
afterEach(() => vi.unstubAllGlobals());
function root(element: HTMLElement): PanelElement { return element as unknown as PanelElement; }

describe('data panel pagination', () => {
	it('makes every bibliographic row reachable and preserves edited mappings across pages', async () => {
		const service = new BibliographicImportService(); const apply = vi.fn();
		const text = JSON.stringify(Array.from({ length: 201 }, (_, index) => ({ id: `id${index}`, type: 'book', title: `Book ${index}` })));
		const prepare = vi.fn((_provider, content, pathMappings) => service.plan(service.parse('csl', content), [], { availablePaths: ['Library/paper.pdf'], pathMappings }));
		const panel = new BibliographicImportPanel({ prepareBibliographicImport: prepare, applyBibliographicImport: apply });
		const element = root(panel.root);
		byLabel(element, '选择文献导出文件').choose(text); await flushPanel();
		expect(element.querySelectorAll('.rd-data-preview-row')).toHaveLength(100);
		byLabel(element, '文献预览下一页').click();
		byLabel(element, '关联路径：Book 100').input('Library/paper.pdf');
		byLabel(element, '文献预览下一页').click();
		expect(element.querySelectorAll('.rd-data-preview-row')).toHaveLength(1);
		byLabel(element, '文献预览上一页').click();
		expect(byLabel(element, '关联路径：Book 100').value).toBe('Library/paper.pdf');
		byLabel(element, '确认路径并重新预览').click(); await flushPanel();
		expect(prepare).toHaveBeenLastCalledWith('csl', text, { 'csl:id100': 'Library/paper.pdf' });
	});

	it('shows plugin-only backup scope and permits mapping paths on later preview pages', async () => {
		const prepare = vi.fn(() => ({ summary: ['插件数据'], paths: Array.from({ length: 201 }, (_, index) => ({ key: `p${index}`, originalPath: `Library/${index}.pdf` })), warnings: [], canApply: true, plan: {} }));
		const panel = new BackupRestorePanel({ previewBackup: prepare }, vi.fn());
		const element = root(panel.root);
		expect(element.textContent).toContain('不包含 PDF/EPUB、原生目标文件');
		byLabel(element, '选择 Reading Desk 完整备份文件').choose('{}'); await flushPanel();
		byLabel(element, '恢复路径预览下一页').click(); byLabel(element, '恢复路径预览下一页').click();
		byLabel(element, '恢复路径：Library/200.pdf').input('Moved/200.pdf');
		byLabel(element, '重新预览恢复差异').click(); await flushPanel();
		expect(prepare).toHaveBeenLastCalledWith('{}', { p200: 'Moved/200.pdf' }, { mode: 'replace', conflictPolicy: 'use-backup' });
	});

	it('exposes repairs beyond the first page without hiding unresolved diagnostics', async () => {
		const check = vi.fn();
		const panel = new RepositoryRecoveryPanel({ recoveryStatus: () => ({ pendingTargets: [], deletedAnnotations: [], repairs: Array.from({ length: 101 }, (_, index) => ({ id: `Targets/${index}.md`, label: `Repair ${index}` })) }), recheckTarget: check });
		const element = root(panel.root); await flushPanel();
		byLabel(element, '重新检查目标下一页').click();
		byLabel(element, '重新检查目标：Repair 100').click(); await flushPanel();
		expect(check).toHaveBeenCalledWith('Targets/100.md');
	});
});
