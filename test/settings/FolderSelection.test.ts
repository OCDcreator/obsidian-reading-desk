import { describe, expect, it } from 'vitest';
import { buildFolderTree, collectExpandedPaths, formatFolderList, lastSegment, parseFolderList, replaceLastSegment } from '../../src/settings/FolderSelection';

describe('parseFolderList', () => {
	it('trims segments and drops empties', () => {
		expect(parseFolderList(' Reading ,PDF,,  ')).toEqual(['Reading', 'PDF']);
	});

	it('deduplicates paths and strips trailing slashes', () => {
		expect(parseFolderList('Reading/, Reading/PDF, Reading')).toEqual(['Reading', 'Reading/PDF']);
	});
});

describe('formatFolderList', () => {
	it('normalizes to a comma-space joined list', () => {
		expect(formatFolderList(['B', 'A', 'A/'])).toBe('B, A');
	});
});

describe('lastSegment / replaceLastSegment', () => {
	it('treats the whole value as the segment when no comma exists', () => {
		expect(lastSegment('Reading')).toBe('Reading');
		expect(replaceLastSegment('Reading', 'Notes')).toBe('Notes, ');
	});

	it('replaces the trailing partial segment after a comma', () => {
		expect(replaceLastSegment('Reading, re', 'Reading/PDF')).toBe('Reading, Reading/PDF, ');
	});

	it('appends to a value that already ends with a comma', () => {
		expect(replaceLastSegment('Reading, ', 'Notes')).toBe('Reading, Notes, ');
	});
});

describe('buildFolderTree', () => {
	it('nests paths by slash and sorts children alphabetically', () => {
		const tree = buildFolderTree(['Reading/PDF', 'Books', 'Reading']);
		expect(tree.path).toBe('');
		expect(tree.children.map(child => child.name)).toEqual(['Books', 'Reading']);
		const reading = tree.children[1];
		expect(reading.path).toBe('Reading');
		expect(reading.children.map(child => child.path)).toEqual(['Reading/PDF']);
	});

	it('creates intermediate nodes only once', () => {
		const tree = buildFolderTree(['A/B', 'A/C', 'A']);
		expect(tree.children).toHaveLength(1);
		expect(tree.children[0].children.map(child => child.path)).toEqual(['A/B', 'A/C']);
	});
});

describe('collectExpandedPaths', () => {
	it('expands only the branches that contain a selected folder', () => {
		const tree = buildFolderTree(['Reading/PDF', 'Reading/EPUB', 'Books']);
		const expanded = collectExpandedPaths(tree, new Set(['Reading/PDF']));
		expect(expanded.has('Reading')).toBe(true);
		expect(expanded.has('Books')).toBe(false);
		expect(expanded.has('Reading/PDF')).toBe(false);
	});
});
