import type { BibliographicImportPlan, BibliographicProvider } from '../../portability/BibliographicImportService';
import type { RepositoryStatus } from '../../data/RepositoryStatus';
import type { ExcerptTemplatePreview } from '../../targets/ExcerptTemplate';
import type { BackupObjectDiff } from '../../portability/BackupTypes';
import type { RecoverySnapshotInventory, RecoverySnapshotEntry, RecoveryRetentionPolicy, RecoveryCleanupPreview, RecoveryCleanupResult } from '../../portability/RecoverySnapshotService';

export type Awaitable<T> = T | Promise<T>;
export type ExportContent = Blob | string;
export interface BackupPanelOptions {
	mode?: 'replace' | 'merge';
	conflictPolicy?: 'error' | 'keep-current' | 'use-backup';
	objectDecisions?: Record<string, 'keep-current' | 'use-backup'>;
}
export interface BackupPanelPath {
	key: string;
	originalPath: string;
	mappedPath?: string;
	kind?: string;
}
/** A presentation adapter for the backup service's validated plan; opaque plan is retained by the host. */
export interface BackupPanelPreview {
	/** Plugin data only. PDF/EPUB and native target files are never included. */
	filesIncluded?: false;
	summary: string[];
	paths: BackupPanelPath[];
	warnings: string[];
	canApply: boolean;
	objects?: BackupObjectDiff[];
	plan: unknown;
}
export interface RecoveryPanelItem {
	id: string;
	label: string;
	detail?: string;
}
export interface RecoveryPanelStatus {
	pendingTargets: RecoveryPanelItem[];
	deletedAnnotations: RecoveryPanelItem[];
	/** id is the target path supplied to recheckTarget. */
	repairs?: RecoveryPanelItem[];
}
export interface ExcerptTemplatePanelState {
	template: string;
	placeholders: readonly string[];
}

/** Every new capability is optional, so existing Bookshelf hosts still work. */
export interface DataPanelHost {
	prepareBibliographicImport?(provider: BibliographicProvider, text: string, pathMappings: Record<string, string>): Awaitable<BibliographicImportPlan>;
	applyBibliographicImport?(plan: BibliographicImportPlan, selectedKeys?: readonly string[]): Awaitable<void>;
	recoverySnapshots?(): Awaitable<RecoverySnapshotInventory>;
	previewSnapshotCleanup?(policy: RecoveryRetentionPolicy): Awaitable<RecoveryCleanupPreview>;
	cleanupSnapshots?(preview: RecoveryCleanupPreview): Awaitable<RecoveryCleanupResult>;
	loadRecoverySnapshot?(entry: RecoverySnapshotEntry): Awaitable<string>;
	exportBackup?(): Awaitable<ExportContent>;
	previewBackup?(text: string, pathMappings: Record<string, string>, options?: BackupPanelOptions): Awaitable<BackupPanelPreview>;
	/** Host validates the plan again and persists a current-data backup before applying it. */
	restoreBackup?(preview: BackupPanelPreview): Awaitable<void>;
	repositoryStatus?(): Awaitable<RepositoryStatus>;
	retryRepository?(): Awaitable<void>;
	/** UI requires an explicit second click; host implements reload/discard semantics. */
	reloadRepository?(): Awaitable<void>;
	recoveryStatus?(): Awaitable<RecoveryPanelStatus>;
	retryTargetWrite?(id: string): Awaitable<void>;
	restoreDeletedAnnotation?(id: string): Awaitable<void>;
	recheckTarget?(path: string): Awaitable<void>;
	excerptTemplate?(): Awaitable<ExcerptTemplatePanelState>;
	previewExcerptTemplate?(template: string): Awaitable<ExcerptTemplatePreview>;
	saveExcerptTemplate?(template: string): Awaitable<void>;
}
