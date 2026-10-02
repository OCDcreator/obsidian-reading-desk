const DATA_PATHS = ['.obsidian/plugins/obsidian-bookshelf/data.json', '.obsidian/plugins/obsidian-bookshelf/metadata.json'];
const METADATA_FOLDER = '.obsidian/plugins/bookshelf/metadata';

export interface LegacyBookshelfSource {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	list(path: string): Promise<{ files: string[] }>;
	notice(message: string): void;
}

/** Reads legacy formats without mutating the old plugin or consuming import eligibility. */
export async function readLegacyBookshelfSource(source: LegacyBookshelfSource): Promise<unknown | null> {
	const records: unknown[] = [];
	if (await source.exists(METADATA_FOLDER)) {
		const listing = await source.list(METADATA_FOLDER);
		for (const path of listing.files) {
			if (!path.endsWith('.json') || path.includes('/covers/')) continue;
			try { records.push(JSON.parse(await source.read(path))); }
			catch { source.notice(`跳过无法解析的旧元数据：${path}`); }
		}
	}
	if (records.length) {
		let settings: unknown = {};
		if (await source.exists(DATA_PATHS[0])) {
			try { settings = JSON.parse(await source.read(DATA_PATHS[0])); } catch { /* Legacy settings are optional. */ }
		}
		return { books: records, settings };
	}
	for (const path of DATA_PATHS) {
		if (!await source.exists(path)) continue;
		try { return JSON.parse(await source.read(path)); }
		catch { throw new Error(`旧 Bookshelf 数据无法解析：${path}`); }
	}
	return null;
}
