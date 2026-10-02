import { describe, expect, it } from 'vitest';
import { dataSignature, validateReadingDeskData } from '../../src/data/DataValidation';
import { completeData, highlight } from './DataRecoveryFixtures';

describe('Reading Desk persisted data validation', () => {
	it('migrates schema 0 and retains first-page zero-based coordinates and references', () => {
		const value = completeData();
		delete value.schemaVersion;
		delete value.lists;
		delete value.deletedAnnotations;
		delete value.pendingTargetWrites;
		const migrated = validateReadingDeskData(value);
		expect(migrated.schemaVersion).toBe(1);
		expect(migrated.lists).toEqual([]);
		expect(migrated.highlights.h).toEqual(highlight());
		expect(migrated.highlights.h.page).toBe(0);
		expect(migrated.comments.h).toEqual(value.comments.h);
	});

	it('preserves first-page deleted/pending records, manual metadata and unknown extensions', () => {
		const value = { ...completeData(), extension: { stable: [1, 'x'] } };
		const loaded = validateReadingDeskData(value);
		expect(loaded).toEqual(value);
		expect(loaded.pendingTargetWrites?.intent.page).toBe(0);
		expect(loaded.deletedAnnotations?.deleted.highlight.page).toBe(0);
		loaded.highlights.h.text = 'changed';
		expect(value.highlights.h.text).toBe('第 1 页');
	});

	it.each([['books', 'oops'], ['categories', {}], ['highlights', []], ['comments', []], ['excerptCards', null], ['lists', {}], ['pendingTargetWrites', []], ['deletedAnnotations', 1], ['settings', 'oops']])('rejects malformed present collection %s', (key, badValue) => {
		expect(() => validateReadingDeskData({ ...completeData(), [key as string]: badValue })).toThrow(`data.${key}`);
	});

	it('rejects negative page, screen pixel rectangles, bad IDs and unsupported versions', () => {
		const value = completeData();
		value.highlights.h.page = -1;
		value.highlights.h.rects[0].x = 220;
		value.highlights.h.id = 'other';
		expect(() => validateReadingDeskData(value)).toThrow('highlights.h');
		expect(() => validateReadingDeskData({ schemaVersion: 99, books: {} })).toThrow('schemaVersion');
	});

	it('rejects JSON cycles and unsafe prototype fields', () => {
		const value: Record<string, unknown> = { books: {} };
		value.extension = value;
		expect(() => validateReadingDeskData(value)).toThrow('循环引用');
		expect(() => validateReadingDeskData(JSON.parse('{"books": {}, "__proto__": {"polluted": true}}'))).toThrow('不安全');
	});

	it('compares full canonical data independent of object key insertion order', () => {
		expect(dataSignature({ a: 1, b: { d: 2, c: 3 } })).toBe(dataSignature({ b: { c: 3, d: 2 }, a: 1 }));
		expect(dataSignature({ value: 1 })).not.toBe(dataSignature({ value: 2 }));
	});
});
