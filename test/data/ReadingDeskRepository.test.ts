import { describe, expect, it } from 'vitest';
import { ReadingDeskRepository, type DataSink } from '../../src/data/ReadingDeskRepository';

describe('ReadingDeskRepository persistence queue', () => {
	it('reports a failed save but allows the following commit to persist', async () => {
		const saves: number[] = [];
		let attempts = 0;
		const sink: DataSink = {
			load: async () => undefined,
			save: async value => {
				attempts += 1;
				if (attempts === 1) throw new Error('temporary disk error');
				saves.push(value.settings.libraryFolders.length);
			}
		};
		const repository = new ReadingDeskRepository(sink);

		await expect(repository.updateSettings({ libraryFolders: ['first'] })).rejects.toThrow('temporary disk error');
		await expect(repository.updateSettings({ libraryFolders: ['first', 'second'] })).resolves.toBeUndefined();

		expect(attempts).toBe(2);
		expect(saves).toEqual([2]);
		expect(repository.readSettings().libraryFolders).toEqual(['first', 'second']);
	});

	it('migrates absent excerpt-card state and persists a title/fold entry', async () => {
		let saved: unknown;
		const repository = new ReadingDeskRepository({
			load: async () => ({ books: {}, categories: [], highlights: {}, comments: {}, settings: {} }),
			save: async value => { saved = value; }
		});
		await repository.initialize();
		expect(repository.readExcerptCards()).toEqual({});
		await repository.commit(() => { repository.readExcerptCards().excerpt = { title: '可编辑标题', folded: true }; });
		expect((saved as { excerptCards: Record<string, unknown> }).excerptCards.excerpt).toEqual({ title: '可编辑标题', folded: true });
	});
});
