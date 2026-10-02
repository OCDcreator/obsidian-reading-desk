import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../../src/data/defaults';
import { validateReadingDeskData } from '../../src/data/DataValidation';
import type { ReaderSavedPosition } from '../../src/types/contracts';
const position: ReaderSavedPosition = { page: 0, x: -0.2, y: -0.36, rotation: 90, scale: 1.5, fitMode: 'width', updatedAt: 10 };
function data() { const value = createEmptyData(); value.books.b = { id: 'b', path: 'b.pdf', title: 'Book', author: '', format: 'pdf', fileSize: 1, fingerprint: { mtime: 1, size: 1 }, tags: [], progress: 0, lastReadPosition: { ...position }, bookmarks: [{ id: 'mark', name: 'mark', position, createdAt: 1, updatedAt: 1 }] }; return value; }
describe('persistent workspace validation', () => {
	it('preserves zero physical pages and signed offsets while accepting old data without workspace fields', () => {
		expect(validateReadingDeskData(createEmptyData()).settings.shelf).toBeUndefined();
		expect(validateReadingDeskData(data()).books.b.lastReadPosition).toEqual(position);
	});
	it.each([{ page: -1 }, { page: 0.5 }, { rotation: 45 }, { x: Infinity }, { y: -10001 }, { scale: 0.01 }, { fitMode: 'bad' }])('rejects malformed saved positions %j', patch => {
		const value = data(); Object.assign(value.books.b.lastReadPosition ?? {}, patch);
		expect(() => validateReadingDeskData(value)).toThrow();
	});
	it('rejects duplicate bookmark identities and invalid shelf states', () => {
		const value = data(); const bookmark = value.books.b.bookmarks?.[0];
		if (!bookmark) throw new Error('fixture missing');
		value.books.b.bookmarks?.push(structuredClone(bookmark));
		expect(() => validateReadingDeskData(value)).toThrow('书签 ID 重复');
		const other = createEmptyData(); other.settings.shelf = { mode: 'cards', page: 0, query: { query: '', sort: 'title' } };
		expect(() => validateReadingDeskData(other)).toThrow();
	});
});
