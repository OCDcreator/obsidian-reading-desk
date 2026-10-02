import type { ReadingDeskData } from '../types/contracts';

const credentialKeys = new Set(['accesskeyid', 'secretaccesskey', 'secret']);

/** Remove known credential fields recursively, including future extension fields. */
export function removeBackupCredentials(value: unknown): void {
	if (value === null || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (credentialKeys.has(key.toLowerCase())) delete record[key];
		else removeBackupCredentials(record[key]);
	}
}

export function containsBackupCredentials(value: unknown): boolean {
	if (value === null || typeof value !== 'object') return false;
	return Object.entries(value).some(([key, item]) => credentialKeys.has(key.toLowerCase())
		? item !== '' && item !== undefined && item !== null
		: containsBackupCredentials(item));
}

export function preserveLocalCredentials(current: ReadingDeskData, incoming: ReadingDeskData): void {
	incoming.settings.storage.accessKeyId = current.settings.storage.accessKeyId;
	incoming.settings.storage.secretAccessKey = current.settings.storage.secretAccessKey;
}
