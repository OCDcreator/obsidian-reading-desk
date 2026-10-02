import type { AnnotationPersistence } from '../annotations/AnnotationStore';
import type { LibraryPersistence } from '../library/LibraryIndex';
import type { DeletedAnnotation, ExcerptCardState, LibraryBook, LibraryCategory, LibraryList, PdfComment, PdfHighlight, ReadingDeskData, ReadingDeskSettings } from '../types/contracts';
import { createEmptyData } from './defaults';
import { dataFingerprint, dataSignature, DataValidationError, validateReadingDeskData } from './DataValidation';
import { RepositoryError, type RepositoryBackupContext, type RepositoryOptions, type RepositoryStatus } from './RepositoryStatus';
export { RepositoryError, type RepositoryBackupContext, type RepositoryOptions, type RepositoryStatus } from './RepositoryStatus';

export interface DataSink {
	load(): Promise<unknown>;
	save(value: ReadingDeskData): Promise<void>;
}
export interface RepositoryReplaceOptions {
	recoverInvalid?: boolean;
	/** Canonical signature of the previewed snapshot; checked inside the write queue before replacement. */
	expectedSignature?: string;
}

/** One in-process queue; external comparisons detect stale snapshots but are not cross-device CAS. */
export class ReadingDeskRepository implements AnnotationPersistence, LibraryPersistence {
	private data: ReadingDeskData = createEmptyData();
	private writeQueue: Promise<void> = Promise.resolve();
	private expectedSignature?: string;
	private rawSource: unknown;
	private rawLoaded = false;
	private pendingSnapshot?: ReadingDeskData;
	private listeners = new Set<(status: RepositoryStatus) => void>();
	private currentStatus: RepositoryStatus = { phase: 'uninitialized', initialized: false, pending: false, revision: 0, diagnostics: [] };

	constructor(private readonly sink: DataSink, private readonly options: RepositoryOptions = {}) { }

	/** Initialization leaves damaged/unreadable data blocked so the host can show a recovery panel. */
	initialize(): Promise<void> {
		return this.enqueue(async () => {
			if (this.currentStatus.phase !== 'uninitialized') return;
			try { await this.loadFromSink(); } catch { /* Diagnostics remain visible through status(). */ }
		});
	}

	readBooks(): Record<string, LibraryBook> { return this.data.books; }
	readCategories(): LibraryCategory[] { return this.data.categories; }
	readLists(): LibraryList[] { return this.data.lists ??= []; }
	readHighlights(): Record<string, PdfHighlight> { return this.data.highlights; }
	readComments(): Record<string, PdfComment[]> { return this.data.comments; }
	readExcerptCards(): Record<string, ExcerptCardState> { return this.data.excerptCards; }
	readDeletedAnnotations(): Record<string, DeletedAnnotation> { return this.data.deletedAnnotations ??= {}; }
	readPendingTargetWrites(): Record<string, PdfHighlight> { return this.data.pendingTargetWrites ??= {}; }
	readSettings(): ReadingDeskSettings { return this.data.settings; }
	snapshot(): ReadingDeskData { return structuredClone(this.data); }
	/** Original loaded value, including malformed JSON shapes; never an implicit empty replacement. */
	recoverySnapshot(): unknown { return structuredClone(this.rawSource); }
	status(): RepositoryStatus { return structuredClone(this.currentStatus); }

	subscribe(listener: (status: RepositoryStatus) => void): () => void {
		this.listeners.add(listener);
		this.notify(listener);
		return () => { this.listeners.delete(listener); };
	}

	commit(mutator: () => void): Promise<void> {
		return this.enqueue(async () => {
			await this.ensureReady();
			await this.checkLatest();
			const previous = this.snapshot();
			try {
				// Invoke once against current data; persistence retries never replay this closure.
				mutator();
				validateReadingDeskData(this.data);
			} catch (error) {
				this.data = previous;
				throw error;
			}
			this.preparePending();
			await this.persistPending('commit');
		});
	}

	updateSettings(patch: Partial<ReadingDeskSettings>): Promise<void> {
		return this.commit(() => { this.data.settings = { ...this.data.settings, ...patch }; });
	}

	/** Retries the validated snapshot, never re-executes the original mutator. */
	retry(): Promise<void> {
		return this.enqueue(async () => {
			await this.ensureReady();
			if (this.pendingSnapshot) await this.persistPending('retry');
		});
	}

	reload(options: { discardPending?: boolean; expectedSignature?: string } = {}): Promise<void> {
		return this.enqueue(async () => {
			if (options.expectedSignature !== undefined && dataSignature(this.data) !== options.expectedSignature) throw new RepositoryError('external-conflict', '备份后当前数据已变化，请重新核对并备份后重载');
			if (this.pendingSnapshot && !options.discardPending) throw new RepositoryError('pending-changes', '存在未保存数据，请先重试或明确丢弃后重载');
			await this.loadFromSink();
		});
	}

	replaceData(value: unknown, options: RepositoryReplaceOptions = {}): Promise<void> {
		return this.enqueue(async () => {
			const replacement = validateReadingDeskData(value, { requireComplete: true });
			if (this.pendingSnapshot) throw new RepositoryError('pending-changes', '存在未保存数据，请先重试或重载后恢复');
			if (this.currentStatus.phase === 'uninitialized') await this.loadFromSink();
			if (this.currentStatus.phase === 'blocked') {
				if (!options.recoverInvalid || !this.rawLoaded || !this.options.beforeOverwrite || this.expectedSignature === undefined) {
					throw new RepositoryError('invalid-data', '原始数据被保护；恢复损坏数据需要 recoverInvalid 和原件备份回调');
				}
			} else await this.ensureReady();
			await this.checkLatest();
			// Earlier queued commits may finish after the service's preview check but before this operation.
			// Keep this comparison and the assignment synchronous within the repository queue.
			if (options.expectedSignature !== undefined && dataSignature(this.data) !== options.expectedSignature) {
				throw new RepositoryError('external-conflict', '预览后当前数据已变化，请重新预览');
			}
			this.data = replacement;
			this.preparePending();
			await this.persistPending('replace');
		});
	}

	private enqueue(operation: () => Promise<void>): Promise<void> {
		const pending = this.writeQueue.catch(() => undefined).then(operation);
		this.writeQueue = pending;
		return pending;
	}

	private async ensureReady(): Promise<void> {
		if (this.currentStatus.phase === 'uninitialized') await this.loadFromSink();
		if (this.currentStatus.phase === 'blocked') throw new RepositoryError(this.currentStatus.error?.code ?? 'invalid-data', this.currentStatus.error?.message ?? '数据已进入只读恢复状态');
	}

	private async loadFromSink(): Promise<void> {
		let loaded: unknown;
		try { loaded = await this.sink.load(); }
		catch (cause) {
			const error = this.failure('load-failed', '读取数据失败', cause);
			this.publish({ phase: 'blocked', initialized: false, error: { code: error.code, message: error.message } });
			throw error;
		}
		this.rawSource = loaded;
		this.rawLoaded = true;
		try {
			this.rawSource = structuredClone(loaded);
			const validated = validateReadingDeskData(loaded);
			this.data = validated;
			this.expectedSignature = dataSignature(loaded);
			this.pendingSnapshot = undefined;
			this.publish({ phase: 'ready', initialized: true, revision: this.currentStatus.revision + 1,
				persistedFingerprint: dataFingerprint(loaded), externalFingerprint: undefined, error: undefined, diagnostics: [] });
		} catch (cause) {
			try { this.expectedSignature = dataSignature(loaded); } catch { this.expectedSignature = undefined; }
			const error = this.failure('invalid-data', '原始数据校验失败，已阻止写入', cause);
			this.publish({ phase: 'blocked', initialized: false, error: { code: error.code, message: error.message },
				diagnostics: cause instanceof DataValidationError ? cause.issues : [] });
			throw error;
		}
	}

	private preparePending(): void {
		this.pendingSnapshot = this.snapshot();
		this.publish({ pending: true, revision: this.currentStatus.revision + 1 });
	}

	private async checkLatest(): Promise<unknown> {
		let latest: unknown;
		try { latest = await this.sink.load(); }
		catch (cause) {
			const error = this.failure('load-failed', '保存前读取最新数据失败', cause);
			this.publish({ phase: this.pendingSnapshot ? 'pending' : 'blocked', error: { code: error.code, message: error.message } });
			throw error;
		}
		const signature = dataSignature(latest);
		// A sink may write successfully and then reject its promise; acknowledge that exact snapshot on retry.
		if (this.pendingSnapshot && signature === dataSignature(this.pendingSnapshot)) this.acknowledge(latest);
		else if (signature !== this.expectedSignature) {
			const error = new RepositoryError('external-conflict', '外部数据已变化；已阻止旧快照覆盖，请备份未保存数据并重载');
			this.publish({ phase: 'conflict', externalFingerprint: dataFingerprint(latest), error: { code: error.code, message: error.message } });
			throw error;
		}
		return latest;
	}

	private async persistPending(reason: RepositoryBackupContext['reason']): Promise<void> {
		this.publish({ phase: 'saving', error: undefined });
		const latest = await this.checkLatest();
		if (!this.pendingSnapshot) return;
		if (latest !== null && latest !== undefined && this.options.beforeOverwrite) {
			try { await this.options.beforeOverwrite(structuredClone(latest), { reason, fingerprint: dataFingerprint(latest) }); }
			catch (cause) {
				const error = this.failure('backup-failed', '覆盖前备份失败，已阻止写入', cause);
				this.publish({ phase: 'pending', error: { code: error.code, message: error.message } });
				throw error;
			}
			await this.checkLatest();
			if (!this.pendingSnapshot) return;
		}
		const candidate = structuredClone(this.pendingSnapshot);
		try { await this.sink.save(structuredClone(candidate)); }
		catch (cause) {
			const error = this.failure('save-failed', '数据未保存，可重试', cause);
			this.publish({ phase: 'pending', error: { code: error.code, message: error.message } });
			throw error;
		}
		this.acknowledge(candidate);
	}

	private acknowledge(value: unknown): void {
		this.expectedSignature = dataSignature(value);
		this.rawSource = structuredClone(value);
		this.pendingSnapshot = undefined;
		this.publish({ phase: 'ready', initialized: true, persistedFingerprint: dataFingerprint(value), externalFingerprint: undefined, error: undefined, diagnostics: [] });
	}

	private failure(code: RepositoryError['code'], message: string, cause: unknown): RepositoryError {
		return new RepositoryError(code, `${message}：${cause instanceof Error ? cause.message : String(cause)}`, cause);
	}

	private publish(patch: Partial<RepositoryStatus>): void {
		this.currentStatus = { ...this.currentStatus, ...patch, pending: this.pendingSnapshot !== undefined };
		for (const listener of this.listeners) this.notify(listener);
	}

	private notify(listener: (status: RepositoryStatus) => void): void {
		try { listener(this.status()); } catch { /* Presentation callbacks must never change persistence outcomes. */ }
	}
}
