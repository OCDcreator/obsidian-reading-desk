import type { ReadingDeskData, ReadingDeskSettings } from '../types/contracts';

export const DEFAULT_SETTINGS: ReadingDeskSettings = {
	libraryFolders: [],
	storage: {
		enabled: false,
		imageHostEnabled: false,
		provider: 'oss',
		endpoint: '',
		region: '',
		bucket: '',
		prefix: 'reading-desk/',
		accessKeyId: '',
		secretAccessKey: ''
	},
	importedBookshelf: false
};

export function createEmptyData(): ReadingDeskData {
	return {
		books: {},
		categories: [],
		highlights: {},
		comments: {},
		excerptCards: {},
		settings: structuredClone(DEFAULT_SETTINGS)
	};
}
