import { describe, expect, it, vi } from 'vitest';
import { ReadingDeskRepository } from '../../src/data/ReadingDeskRepository';
import type { ReadingDeskData } from '../../src/types/contracts';
import { highlight } from './DataRecoveryFixtures';

describe('pre-schema Reading Desk data.json shape', () => {
	it('loads and saves five first-page highlights without rejecting or renumbering page 0', async () => {
		// Same historical field layout as the deployed pre-schema data, using synthetic text/IDs only.
		// New lists/tombstones/intents/card-state fields are intentionally absent.
		const highlights = Object.fromEntries(Array.from({ length: 5 }, (_, index) => {
			const id = `legacy-${index}`;
			return [id, highlight(id)];
		}));
		const legacy = {
			books: { b: {
				id: 'b', path: 'Books/first.pdf', format: 'pdf', title: 'First', author: '',
				fileSize: 100, fingerprint: { mtime: 1, size: 100 }, tags: [], progress: 0
			} },
			categories: [], highlights, comments: {},
			settings: { libraryFolders: ['Books'], importedBookshelf: false,
				viewer: { scrollMode: 'single', invertPdf: 'on' },
				storage: { enabled: false, imageHostEnabled: false, provider: 'oss', endpoint: '', region: '', bucket: '', prefix: 'reading-desk/', accessKeyId: '', secretAccessKey: '' }
			}
		};
		let disk: unknown = structuredClone(legacy);
		const save = vi.fn(async (value: ReadingDeskData) => { disk = structuredClone(value); });
		const repository = new ReadingDeskRepository({ load: async () => disk, save });
		await repository.initialize();
		expect(repository.status()).toMatchObject({ phase: 'ready', diagnostics: [] });
		expect(Object.values(repository.readHighlights())).toHaveLength(5);
		expect(Object.values(repository.readHighlights()).map(value => value.page)).toEqual([0, 0, 0, 0, 0]);
		expect(repository.readHighlights()).toEqual(highlights);
		expect(repository.readExcerptCards()).toEqual({});
		expect(repository.readSettings().viewer.outlineStyle).toBe('tree');
		expect(save).not.toHaveBeenCalled();
		await repository.updateSettings({ excerptTemplate: '{{text}}' });
		expect((disk as ReadingDeskData).highlights).toEqual(highlights);
		expect((disk as ReadingDeskData).schemaVersion).toBe(1);
		expect(legacy).not.toHaveProperty('schemaVersion');
	});
});
