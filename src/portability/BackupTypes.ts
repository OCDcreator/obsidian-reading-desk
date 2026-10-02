import type { ReadingDeskData } from '../types/contracts';

export const BACKUP_FORMAT = 'reading-desk-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export interface ReadingDeskBackup {
	format: typeof BACKUP_FORMAT;
	schemaVersion: number;
	createdAt: string;
	credentialsIncluded: boolean;
	/** This JSON contains references only. Back up the actual vault/source files separately. */
	filesIncluded: false;
	data: ReadingDeskData;
}
export interface BackupExportOptions { includeCredentials?: boolean; }
export interface BackupPathMapping { from: string; to: string; }
export interface BackupRestoreOptions {
	mode?: 'replace' | 'merge';
	conflictPolicy?: 'error' | 'keep-current' | 'use-backup';
	pathMappings?: BackupPathMapping[];
	/** Optional vault inventory makes unresolved source/target paths visible in the preview. */
	existingPaths?: string[];
	recoverInvalid?: boolean;
}
export interface BackupIssue {
	code: 'duplicate-id' | 'duplicate-path' | 'conflict' | 'reference' | 'path' | 'missing-file';
	path: string;
	message: string;
	severity: 'error' | 'warning';
}
export interface BackupConflict { collection: string; id: string; resolution: 'error' | 'keep-current' | 'use-backup'; }
export interface BackupPathChange { field: string; from: string; to: string; }
export interface BackupCollectionChange { collection: string; added: number; updated: number; removed: number; unchanged: number; }
export interface BackupRestorePreview {
	canApply: boolean;
	mode: 'replace' | 'merge';
	data: ReadingDeskData;
	issues: BackupIssue[];
	conflicts: BackupConflict[];
	duplicates: { collection: string; id: string }[];
	pathChanges: BackupPathChange[];
	changes: BackupCollectionChange[];
	filesIncluded: false;
	warnings: string[];
}
export interface BackupRestoreHost {
	snapshot(): ReadingDeskData;
	replaceData(data: ReadingDeskData, options?: { recoverInvalid?: boolean; expectedSignature?: string }): Promise<void>;
	/** Must durably save this backup before resolving. Throw to cancel restore. Credentials are excluded. */
	backupBeforeRestore(backup: ReadingDeskBackup): Promise<void>;
	status?(): { phase: string; pending: boolean };
}
export class BackupError extends Error {
	readonly name = 'BackupError';
	constructor(readonly code: 'invalid-backup' | 'invalid-preview' | 'restore-conflict' | 'backup-failed', message: string, readonly issues: BackupIssue[] = []) { super(message); }
}
