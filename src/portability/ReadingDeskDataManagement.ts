import type { AnnotationStore } from '../annotations/AnnotationStore';
import type { ReadingDeskRepository } from '../data/ReadingDeskRepository';
import { dataSignature } from '../data/DataValidation';
import type { LibraryIndex } from '../library/LibraryIndex';
import type { TargetService } from '../targets/TargetService';
import { EXCERPT_TEMPLATE_PLACEHOLDERS, excerptTemplateValues, previewExcerptTemplate } from '../targets/ExcerptTemplate';
import { createSourceLink } from '../targets/TargetTypes';
import type { PdfHighlight } from '../types/contracts';
import { bibliographicSourceKey, BibliographicImportService, type BibliographicImportPlan, type BibliographicLocalFile, type BibliographicParseResult, type BibliographicProvider } from './BibliographicImportService';
import { ReadingDeskBackupService, type BackupRestoreOptions, type BackupRestorePreview, type ReadingDeskBackup } from './ReadingDeskBackupService';

export interface DataManagementHost {
	availableFiles(): BibliographicLocalFile[];
	allPaths?(): string[];
	backupBeforeRestore(backup: ReadingDeskBackup): Promise<void>;
	refresh(): Promise<void>;
}
interface ImportContext { parsed: BibliographicParseResult; mappings: Record<string, string>; signature: string; applying: boolean; applicableKeys: string[]; }

/** Coordinates validated domain plans. Host filesystem and UI behavior stay injected. */
export class ReadingDeskDataManagement {
	private readonly backups = new ReadingDeskBackupService();
	private readonly bibliography = new BibliographicImportService();
	private readonly imports = new WeakMap<BibliographicImportPlan, ImportContext>();

	constructor(private readonly repository: ReadingDeskRepository, private readonly library: LibraryIndex,
		private readonly annotations: AnnotationStore, private readonly targets: TargetService, private readonly host: DataManagementHost) { }

	exportBackup(): string {
		if (!this.repository.status().initialized) throw new Error('当前原件被保护，不能将空恢复视图导出为完整备份。');
		return this.backups.serializeBackup(this.repository.snapshot());
	}

	previewBackup(text: string, mappings: Record<string, string>, options: Pick<BackupRestoreOptions, 'mode' | 'conflictPolicy' | 'objectDecisions'> = {}): BackupRestorePreview {
		return this.backups.previewRestore(text, this.repository.snapshot(), {
			objectDecisions: options.objectDecisions,
			mode: options.mode ?? 'replace', conflictPolicy: options.conflictPolicy ?? (options.mode === 'merge' ? 'error' : 'use-backup'), pathMappings: Object.entries(mappings).filter(([from, to]) => from !== to).map(([from, to]) => ({ from, to })),
			existingPaths: this.host.allPaths?.() ?? this.host.availableFiles().map(file => file.path), recoverInvalid: true
		});
	}

	async restoreBackup(preview: BackupRestorePreview): Promise<void> {
		await this.backups.restore(preview, {
			snapshot: () => this.repository.snapshot(), status: () => this.repository.status(),
			replaceData: (data, options) => this.repository.replaceData(data, options),
			backupBeforeRestore: backup => this.host.backupBeforeRestore(backup)
		});
		this.library.rebuildPathMap();
		await this.host.refresh();
	}

	prepareBibliographicImport(provider: BibliographicProvider, text: string, mappings: Record<string, string>): BibliographicImportPlan {
		const parsed = this.bibliography.parse(provider, text);
		const plan = this.bibliography.plan(parsed, this.library.list(), { availableFiles: this.host.availableFiles(), pathMappings: mappings });
		this.imports.set(plan, { parsed: structuredClone(parsed), mappings: { ...mappings }, signature: dataSignature(this.repository.snapshot().books), applying: false,
			applicableKeys: plan.entries.filter(entry => entry.pathConfirmed && ['new', 'update'].includes(entry.kind)).map(entry => entry.key) });
		return plan;
	}

	async applyBibliographicImport(preview: BibliographicImportPlan, selectedKeys?: readonly string[]): Promise<void> {
		const context = this.imports.get(preview);
		if (!context || context.applying) throw new Error('导入预览无效或已使用，请重新预览。');
		if (context.signature !== dataSignature(this.repository.snapshot().books)) throw new Error('预览后书库已变化，请重新预览。');
		const selected = new Set(selectedKeys ?? context.applicableKeys);
		if ([...selected].some(key => !context.applicableKeys.includes(key))) throw new Error('只能选择原预览中已确认且可应用的文献。');
		context.applying = true;
		try {
			const fresh = this.bibliography.plan(context.parsed, this.library.list(), { availableFiles: this.host.availableFiles(), pathMappings: context.mappings });
			if (fresh.hasErrors) throw new Error('请先解决文献解析错误。');
			const applicable = new Set(fresh.entries.filter(entry => entry.pathConfirmed && ['new', 'update', 'unchanged'].includes(entry.kind)).map(entry => entry.key));
			if ([...selected].some(key => !applicable.has(key))) throw new Error('所选文献的身份或附件路径已变化，请重新预览。');
			await this.library.applyImportedBooks(fresh.resultBooks.filter(book => !!book.source && selected.has(bibliographicSourceKey(book.source))), { expectedSignature: context.signature });
			this.imports.delete(preview);
			await this.host.refresh();
		} finally { context.applying = false; }
	}

	async retryRepository(): Promise<void> { await this.repository.retry(); await this.host.refresh(); }
	async reloadRepository(): Promise<void> {
		const pending = this.repository.status().pending;
		const snapshot = pending ? this.repository.snapshot() : undefined;
		const expectedSignature = snapshot ? dataSignature(snapshot) : undefined;
		if (snapshot) await this.host.backupBeforeRestore(this.backups.exportBackup(snapshot));
		await this.repository.reload({ discardPending: pending, expectedSignature });
		this.library.rebuildPathMap();
		await this.host.refresh();
	}

	async retryTargetWrite(id: string): Promise<void> {
		const highlight = this.annotations.get(id);
		if (!highlight?.target || !this.annotations.listPendingTargetWrites().some(item => item.id === id)) throw new Error('未找到待恢复目标写入。');
		await this.targets.writeAndSaveExcerpt(highlight.target, highlight, this.annotations, this.annotations.excerptCard(id));
		await this.host.refresh();
	}

	async restoreDeletedAnnotation(id: string): Promise<void> {
		const highlight = await this.annotations.restoreDeleted(id);
		if (highlight.target) await this.targets.writeAndSaveExcerpt(highlight.target, highlight, this.annotations, this.annotations.excerptCard(id));
		await this.host.refresh();
	}

	excerptTemplate(): { template: string; placeholders: readonly string[] } {
		return { template: this.repository.readSettings().excerptTemplate ?? '', placeholders: EXCERPT_TEMPLATE_PLACEHOLDERS };
	}
	previewExcerptTemplate(template: string): ReturnType<typeof previewExcerptTemplate> {
		const now = Date.now();
		const highlight: PdfHighlight = { id: 'template-preview', pdfPath: 'Books/示例.pdf', page: 0, rotation: 0,
			rects: [], text: '这是一段示例摘录。', color: 'moss', chapterPath: ['第一章'], tags: ['研究'], createdAt: now, updatedAt: now };
		return previewExcerptTemplate(template, excerptTemplateValues(highlight, '示例摘录', createSourceLink(highlight)));
	}
	async saveExcerptTemplate(template: string): Promise<void> {
		const preview = this.previewExcerptTemplate(template);
		if (preview.unknownPlaceholders.length) throw new Error(`不支持的占位符：${preview.unknownPlaceholders.join(', ')}`);
		await this.repository.updateSettings({ excerptTemplate: template });
	}
}
