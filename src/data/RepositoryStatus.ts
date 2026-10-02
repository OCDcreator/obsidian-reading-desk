import type { DataValidationIssue } from './DataValidation';

export type RepositoryPhase = 'uninitialized' | 'ready' | 'saving' | 'pending' | 'conflict' | 'blocked';
export type RepositoryErrorCode = 'load-failed' | 'invalid-data' | 'save-failed' | 'backup-failed' | 'external-conflict' | 'pending-changes';

export interface RepositoryStatus {
	phase: RepositoryPhase;
	initialized: boolean;
	pending: boolean;
	revision: number;
	persistedFingerprint?: string;
	externalFingerprint?: string;
	error?: { code: RepositoryErrorCode; message: string };
	diagnostics: DataValidationIssue[];
}

export interface RepositoryBackupContext {
	reason: 'commit' | 'retry' | 'replace';
	fingerprint: string;
}
export interface RepositoryOptions {
	/** Persist the original sink value before overwriting it. Throwing prevents the write. */
	beforeOverwrite?: (value: unknown, context: RepositoryBackupContext) => Promise<void>;
}

export class RepositoryError extends Error {
	readonly name = 'RepositoryError';
	constructor(readonly code: RepositoryErrorCode, message: string, readonly cause?: unknown) { super(message); }
}
