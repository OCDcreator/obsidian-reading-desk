import type { AnnotationTarget } from '../types/contracts';

export type TargetRepairReason = 'unavailable' | 'invalid-document' | 'invalid-marker' | 'invalid-metadata' | 'metadata-missing' | 'ambiguous-card';

export interface TargetRepairDiagnostic {
	target: Pick<AnnotationTarget, 'path'> & Partial<AnnotationTarget>;
	highlightIds: string[];
	reason: TargetRepairReason;
	message: string;
}

export interface TargetReconciliationResult {
	removedIds: string[];
	diagnostics: TargetRepairDiagnostic[];
}

export interface TargetWriteRecoveryResult {
	highlightId: string;
	status: 'recovered' | 'pending';
	message?: string;
}

export class TargetRepairError extends Error {
	constructor(readonly reason: TargetRepairReason, message: string) {
		super(message);
		this.name = 'TargetRepairError';
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireExcerptIdentity(value: unknown): string | undefined {
	if (!isRecord(value) || value.schemaVersion !== 1 || value.kind !== 'excerpt') return undefined;
	if (typeof value.highlightId !== 'string' || !value.highlightId
		|| typeof value.sourceLink !== 'string' || !Number.isInteger(value.page) || (value.page as number) < 0
		|| (value.title !== undefined && typeof value.title !== 'string')
		|| (value.folded !== undefined && typeof value.folded !== 'boolean')
		|| (value.managedText !== undefined && typeof value.managedText !== 'string')) {
		throw new TargetRepairError('invalid-metadata', '摘录元数据损坏，请修复后重试。');
	}
	return value.highlightId;
}

/** Preserve edits even when an old generated body cannot be identified exactly. */
export function updateManagedText(current: string, previous: string | undefined, next: string): string {
	const normalized = current.replace(/\r\n/g, '\n');
	const baseline = previous?.replace(/\r\n/g, '\n');
	if (normalized === next) return current;
	if (baseline && normalized.includes(baseline) && normalized.indexOf(baseline) === normalized.lastIndexOf(baseline)) {
		return normalized.replace(baseline, () => next);
	}
	// Unrecognized legacy/edit content is retained verbatim; it is never guessed away.
	return current ? `${next}\n\n${current}` : next;
}
