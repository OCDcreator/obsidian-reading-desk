import { BackupError } from './BackupTypes';
import { assertBackupCapacity } from './BackupCapacity';

/** JSON.parse silently drops duplicate keys; backup import must reject them before losing an ID. */
export function parseBackupJson(input: string): unknown {
	assertBackupCapacity(input);
	let value: unknown;
	try { value = JSON.parse(input); }
	catch { throw new BackupError('invalid-backup', '备份 JSON 无法解析'); }
	// Grammar is already checked. Tokens retain object keys, including escaped spellings of the same ID.
	const tokens = input.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|true|false|null|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? [];
	let cursor = 0;
	const visit = (path: string): void => {
		const token = tokens[cursor++];
		if (token === '{') {
			const keys = new Set<string>();
			while (tokens[cursor] !== '}') {
				const key = JSON.parse(tokens[cursor++]) as string;
				if (keys.has(key)) throw new BackupError('invalid-backup', `重复 JSON 字段：${path}.${key}`);
				keys.add(key);
				cursor += 1; // colon
				visit(`${path}.${key}`);
				if (tokens[cursor] === ',') cursor += 1;
			}
			cursor += 1;
		} else if (token === '[') {
			let index = 0;
			while (tokens[cursor] !== ']') {
				visit(`${path}[${index++}]`);
				if (tokens[cursor] === ',') cursor += 1;
			}
			cursor += 1;
		}
	};
	visit('backup');
	return value;
}
