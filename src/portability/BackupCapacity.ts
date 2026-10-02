/** Shared public JSON/file capacity; private raw recovery snapshots have no export cap. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export const BACKUP_CAPACITY_MESSAGE = '完整备份超过支持的 64 MiB，未导出或恢复；请保留插件原始 data.json 和 vault 文件以备恢复。';

export function assertBackupCapacity(text: string): void {
	// UTF-8 byte length without allocating another full backing buffer.
	let bytes = 0;
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		if (code < 0x80) bytes++;
		else if (code < 0x800) bytes += 2;
		else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length
			&& text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
		else bytes += 3;
		if (bytes > MAX_BACKUP_BYTES) throw new Error(BACKUP_CAPACITY_MESSAGE);
	}
}
