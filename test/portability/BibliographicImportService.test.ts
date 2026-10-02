import { describe, expect, it } from 'vitest';
import { BibliographicImportService, bibliographicSourceKey } from '../../src/portability/BibliographicImportService';
import { LibraryIndex } from '../../src/library/LibraryIndex';
import type { LibraryBook } from '../../src/types/contracts';

const service = new BibliographicImportService();
function csl(title = 'Paper') { return JSON.stringify([{ id: 'paper-1', type: 'article-journal', title, author: [{ family: 'Lovelace', given: 'Ada' }], DOI: 'https://doi.org/10.1234/ABC', attachments: [{ path: 'C:\\exports\\paper.pdf' }] }]); }
function book(patch: Partial<LibraryBook> = {}): LibraryBook {
	return { id: 'existing', path: 'Library/paper.pdf', title: 'Extracted', author: 'PDF author', format: 'pdf', tags: ['mine'], rating: 7, progress: 0.4, fileSize: 100, fingerprint: { mtime: 1, size: 100 }, ...patch };
}
const availablePaths = ['Library/paper.pdf', 'Library/other.pdf'];
const options = { availablePaths, pathMappings: { 'csl:paper-1': 'Library/paper.pdf' } };

describe('Bibliographic source parsers', () => {
	it('adapts CSL names, numeric IDs, normalized identifiers and stable fallback IDs', () => {
		const parsed = service.parse('csl', csl());
		expect(parsed.diagnostics).toEqual([]);
		expect(parsed.records[0]).toMatchObject({ title: 'Paper', author: 'Ada Lovelace', source: { provider: 'csl', id: 'paper-1', doi: '10.1234/abc' } });
		const input = JSON.stringify([{ type: 'book', id: 42, title: 'Book', ISBN: '978-3-642-32156-6', author: [{ literal: 'Research and Development' }] }]);
		expect(service.parse('csl', input).records[0]).toMatchObject({ source: { id: '42', isbn: '9783642321566' }, author: 'Research and Development' });
		const fallback = JSON.stringify([{ type: 'book', title: 'Book', author: [], issued: { 'date-parts': [[2026]] } }]);
		expect(service.parse('csl', fallback)).toEqual(service.parse('csl', fallback));
		expect(service.parse('csl', fallback).diagnostics[0].severity).toBe('warning');
	});

	it('parses nested BibTeX braces, quoted strings, concatenation, macros, protected organizations and file fields', () => {
		const input = '@comment{ignore {nested}}\n@string{prefix="A "}\n@article{Key2026,title=prefix # {Study of {PDF}},author={Lovelace, Ada and {Research and Development}},month=jan,year=2026,doi={10.1234/ABC},file={PDF:files/paper.pdf:application/pdf}}';
		const parsed = service.parse('bibtex', input);
		expect(parsed.diagnostics).toEqual([]);
		expect(parsed.records[0]).toEqual({ title: 'A Study of PDF', author: 'Ada Lovelace; Research and Development', source: { provider: 'bibtex', id: 'Key2026', citationKey: 'Key2026', doi: '10.1234/abc' }, attachmentPaths: ['files/paper.pdf'] });
	});

	it('adapts Zotero item JSON with library identity, nested attachments and author roles', () => {
		const input = JSON.stringify({ items: [{ key: 'ABCD1234', libraryID: 2, itemType: 'journalArticle', title: 'Zotero Paper', creators: [{ firstName: 'Ada', lastName: 'Lovelace', creatorType: 'author' }, { name: 'Editor', creatorType: 'editor' }], attachments: [{ localPath: '/exports/paper.pdf' }] }, { key: 'ATTACH01', parentItem: 'ABCD1234', itemType: 'attachment', path: 'files/paper.pdf' }, { itemType: 'note', note: 'Ignore this note' }] });
		const parsed = service.parse('zotero', input);
		expect(parsed.records).toHaveLength(1);
		expect(parsed.records[0]).toMatchObject({ source: { provider: 'zotero', id: '2/ABCD1234' }, author: 'Ada Lovelace', attachmentPaths: ['/exports/paper.pdf', 'files/paper.pdf'] });
		expect(service.parse('zotero', csl()).records[0].source.provider).toBe('zotero');
		const wrapped = JSON.stringify([{ key: 'OUTERKEY', data: { itemType: 'book', title: 'Wrapped', creators: [] } }]);
		expect(service.parse('zotero', wrapped).records[0].source.id).toBe('OUTERKEY');
	});

	it.each([
		['csl', '{broken'], ['csl', '{}'], ['csl', '[null]'], ['csl', '[{"type":"book","title":""}]'],
		['csl', '[{"type":"book","title":"Bad","author":"Ada"}]'], ['zotero', '{"items":"bad"}'],
		['bibtex', '@article{key,title={unclosed}'], ['bibtex', '@article{key,title=undefined}'],
		['bibtex', '@article{key,title={One},title={Two}}'], ['bibtex', 'not bibtex']
	] as const)('reports invalid %s input without any applicable writes (%s)', (provider, input) => {
		const parsed = service.parse(provider, input);
		expect(parsed.diagnostics.some(item => item.severity === 'error')).toBe(true);
		expect(service.plan(parsed, [], options).resultBooks).toEqual([]);
	});

	it('does not assign unparented Zotero attachments to unrelated items without keys', () => {
		const parsed = service.parse('zotero', JSON.stringify([{ itemType: 'book', title: 'No key' }, { itemType: 'attachment', path: 'unrelated.pdf' }]));
		expect(parsed.records[0].attachmentPaths).toEqual([]);
	});

	it('includes both CSL structured and EDTF string dates in fallback identity', () => {
		const parsed = service.parse('csl', JSON.stringify([{ type: 'book', title: 'Same title', issued: '2025' }, { type: 'book', title: 'Same title', issued: '2026' }]));
		expect(parsed.records[0].source.id).not.toBe(parsed.records[1].source.id);
	});

	it('treats script-looking data as plain text and rejects oversized/empty input', () => {
		const title = '<img src=x onerror=alert(1)> ${globalThis.hacked=true}';
		expect(service.parse('csl', csl(title)).records[0].title).toBe(title);
		expect(service.parse('bibtex', '').diagnostics[0].severity).toBe('error');
		expect(service.parse('csl', ' '.repeat(10 * 1024 * 1024) + 'x').diagnostics[0].message).toContain('10 MiB');
	});
});

describe('Bibliographic import plans', () => {
	it('previews candidates without writes and requires explicit vault path confirmation', () => {
		const parsed = service.parse('csl', csl());
		const preview = service.plan(parsed, [], { availablePaths });
		expect(preview.entries[0]).toMatchObject({ kind: 'new', pathConfirmed: false, suggestedPaths: ['Library/paper.pdf'] });
		expect(preview.resultBooks).toEqual([]);
		const applied = service.plan(parsed, [], options);
		expect(applied.resultBooks[0]).toMatchObject({ path: 'Library/paper.pdf', title: 'Paper', source: { provider: 'csl', id: 'paper-1' } });
		expect(service.plan(parsed, [], { ...options, pathMappings: { 'csl:paper-1': '../paper.pdf' } }).summary.conflict).toBe(1);
	});

	it('previews no-attachment entries, which may be explicitly associated to an existing PDF', () => {
		const parsed = service.parse('csl', '[{"id":"no-file","type":"book","title":"No attachment"}]');
		expect(service.plan(parsed, [], { availablePaths }).summary['no-attachment']).toBe(1);
		const plan = service.plan(parsed, [], { availablePaths, pathMappings: { 'csl:no-file': 'Library/other.pdf' } });
		expect(plan.resultBooks).toHaveLength(1);
		expect(plan.entries[0].kind).toBe('new');
	});

	it('is idempotent and updates same-source records without losing user metadata or book identity', () => {
		const parsed = service.parse('csl', csl());
		const first = service.plan(parsed, [book()], options);
		expect(first.summary.update).toBe(1);
		expect(first.resultBooks[0]).toMatchObject({ id: 'existing', tags: ['mine'], rating: 7, progress: 0.4 });
		const second = service.plan(parsed, first.resultBooks, { availablePaths });
		expect(second.summary.unchanged).toBe(1);
		expect(second.resultBooks).toEqual([]);
		const third = service.plan(service.parse('csl', csl('Revised')), first.resultBooks, { availablePaths });
		expect(third.resultBooks[0]).toMatchObject({ id: 'existing', title: 'Revised' });
	});

	it('preserves manual title and deliberately empty author while refreshing upstream metadata', () => {
		const current = book({ title: 'My own title', author: '', metadataOverrides: { title: 'My own title', author: '' } });
		const plan = service.plan(service.parse('csl', csl()), [current], options);
		expect(plan.entries[0].protectedFields).toEqual(['title', 'author']);
		expect(plan.resultBooks[0]).toMatchObject({ title: 'My own title', author: '', autoMetadata: { title: 'Paper', author: 'Ada Lovelace' } });
		expect(current.source).toBeUndefined();
		expect(current.title).toBe('My own title');
	});

	it('surfaces duplicate IDs, occupied paths and changed-source path conflicts without merging', () => {
		const parsed = service.parse('csl', csl());
		const current = book({ source: parsed.records[0].source });
		expect(service.plan(parsed, [current, book({ id: 'other' })], options).summary.conflict).toBe(1);
		expect(service.plan(parsed, [current], { availablePaths, pathMappings: { 'csl:paper-1': 'Library/other.pdf' } }).entries[0].reason).toContain('relink');
		const duplicate = service.parse('csl', JSON.stringify([{ id: 'same', type: 'book', title: 'One' }, { id: 'same', type: 'book', title: 'Two' }]));
		expect(service.plan(duplicate, [], { availablePaths }).summary.conflict).toBe(1);
		const otherProvider = book({ source: { provider: 'zotero', id: 'native' } });
		expect(service.plan(parsed, [otherProvider], options).resultBooks).toEqual([]);
	});

	it.each([
		['csl', '[{"id":"stable","type":"book","title":"EPUB"}]'],
		['bibtex', '@book{stable,title={EPUB}}'],
		['zotero', '{"items":[{"key":"stable","itemType":"book","title":"EPUB"}]}']
	] as const)('keeps %s EPUB repeat imports unchanged with the same identity and real stat', (provider, input) => {
		const parsed = service.parse(provider, input);
		const pathMappings = { [`${provider}:stable`]: 'Library/book.epub' };
		const availableFiles = [{ path: 'Library/book.epub', stat: { size: 500, mtime: 123 } }];
		const initial = service.plan(parsed, [], { pathMappings, availableFiles });
		expect(initial.resultBooks[0]).toMatchObject({ format: 'epub', fileSize: 500, fingerprint: { size: 500, mtime: 123 } });
		const repeated = service.plan(parsed, initial.resultBooks, { availableFiles });
		expect(repeated.summary.unchanged).toBe(1); expect(repeated.resultBooks).toEqual([]);
	});

	it('rejects two source identities confirmed to the same file', () => {
		const parsed = service.parse('csl', '[{"id":"one","type":"book","title":"One"},{"id":"two","type":"book","title":"Two"}]');
		const plan = service.plan(parsed, [], { availablePaths, pathMappings: { 'csl:one': 'Library/paper.pdf', 'csl:two': 'Library/paper.pdf' } });
		expect(plan.summary.conflict).toBe(2); expect(plan.resultBooks).toEqual([]);
	});

	it('integrates through LibraryIndex.applyImportedBooks and keeps repeated imports at one record', async () => {
		const books: Record<string, LibraryBook> = {};
		const index = new LibraryIndex({ readBooks: () => books, readCategories: () => [], commit: async mutator => { mutator(); } }, { extract: async () => ({ title: 'PDF', author: '' }) });
		const parsed = service.parse('csl', csl());
		await index.applyImportedBooks(service.plan(parsed, index.list(), options).resultBooks);
		await index.updateBook(index.list()[0].id, { title: 'Hand edited', author: '' });
		await index.applyImportedBooks(service.plan(service.parse('csl', csl('New remote title')), index.list(), options).resultBooks);
		expect(index.list()).toHaveLength(1);
		expect(index.list()[0]).toMatchObject({ title: 'Hand edited', author: '', autoMetadata: { title: 'New remote title' } });
		const source = index.list()[0].source;
		if (!source) throw new Error('Imported source missing');
		expect(bibliographicSourceKey(source)).toBe('csl:paper-1');
	});
});
