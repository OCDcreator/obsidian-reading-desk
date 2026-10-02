import { describe, expect, it, vi } from 'vitest';
import { assertBackupCapacity, BACKUP_CAPACITY_MESSAGE, MAX_BACKUP_BYTES } from '../../src/portability/BackupCapacity';
import { ReadingDeskBackupService } from '../../src/portability/ReadingDeskBackupService';
import { createEmptyData } from '../../src/data/defaults';
import { readPanelFile } from '../../src/ui/portability/PanelSection';

describe('public backup capacity', () => {
	it('uses UTF-8 bytes and rejects oversized exports before returning a downloadable file', () => {
		const data = createEmptyData();
		data.settings.excerptTemplate = '中'.repeat(Math.ceil(MAX_BACKUP_BYTES / 3));
		expect(() => new ReadingDeskBackupService().serializeBackup(data)).toThrow(BACKUP_CAPACITY_MESSAGE);
		expect(() => assertBackupCapacity('😀'.repeat(MAX_BACKUP_BYTES / 4))).not.toThrow();
		expect(() => assertBackupCapacity('😀'.repeat(MAX_BACKUP_BYTES / 4) + 'x')).toThrow('64 MiB');
	});
	it('refuses an oversized restore file before allocating its text while leaving bibliography at 10 MiB', async () => {
		const text = vi.fn(async () => 'data');
		await expect(readPanelFile({ size: MAX_BACKUP_BYTES + 1, text } as unknown as File, { bytes: MAX_BACKUP_BYTES, message: BACKUP_CAPACITY_MESSAGE })).rejects.toThrow('64 MiB');
		expect(text).not.toHaveBeenCalled();
		await expect(readPanelFile({ size: 11 * 1024 * 1024, text } as unknown as File)).rejects.toThrow('10 MiB');
	});
});
