import type { BibliographicSource, LibraryBook } from '../types/contracts';
import { applyAutomaticMetadata, uniqueValues } from './LibraryMetadata';

export function sourceKey(source: BibliographicSource | undefined): string | undefined {
	return source ? JSON.stringify([source.provider, source.id]) : undefined;
}

/** Pure plan: identity conflicts are rejected before LibraryIndex's single commit. */
export function planImportedBooks(existing: Record<string, LibraryBook>, incoming: LibraryBook[]): LibraryBook[] {
	const byId = new Map(Object.values(existing).map(book => [book.id, book]));
	const byPath = indexIdentity(Object.values(existing), book => book.path || undefined);
	const bySource = indexIdentity(Object.values(existing), book => sourceKey(book.source));
	const changed = new Map<string, LibraryBook>();
	for (const imported of incoming) {
		validateImportedBook(imported);
		const identity = sourceKey(imported.source);
		const matches = [byId.get(imported.id), ...(byPath.get(imported.path) ?? []), ...(identity ? bySource.get(identity) ?? [] : [])]
			.filter((book): book is LibraryBook => !!book);
		if (new Set(matches.map(book => book.id)).size > 1) throw new Error(`导入身份冲突：${imported.title}`);
		const previous = matches[0];
		if (previous?.source && imported.source && sourceKey(previous.source) !== identity) throw new Error(`文献来源冲突：${imported.title}`);
		if (previous?.path && imported.path && previous.path !== imported.path) throw new Error(`源路径已改变，请先确认重新关联：${imported.title}`);
		const merged = mergeImportedBook(previous, imported);
		byId.set(merged.id, merged);
		if (merged.path) byPath.set(merged.path, [merged]);
		if (merged.source) bySource.set(sourceKey(merged.source), [merged]);
		changed.set(merged.id, merged);
	}
	return [...changed.values()];
}

function mergeImportedBook(previous: LibraryBook | undefined, incoming: LibraryBook): LibraryBook {
	const automatic = incoming.autoMetadata ?? { title: incoming.title, author: incoming.author };
	const merged: LibraryBook = previous ? {
		...incoming,
		...previous,
		path: previous.path || incoming.path,
		source: incoming.source ? { ...incoming.source } : previous.source,
		metadataOverrides: previous.metadataOverrides,
		missing: incoming.missing ?? previous.missing,
		tags: uniqueValues([...previous.tags, ...incoming.tags])
	} : {
		...incoming,
		source: incoming.source ? { ...incoming.source } : undefined,
		tags: uniqueValues(incoming.tags),
		listIds: incoming.listIds ? uniqueValues(incoming.listIds) : undefined,
		fingerprint: { ...incoming.fingerprint },
		missing: incoming.missing ?? true
	};
	return applyAutomaticMetadata(merged, automatic);
}

function indexIdentity(books: LibraryBook[], identity: (book: LibraryBook) => string | undefined): Map<string, LibraryBook[]> {
	const index = new Map<string, LibraryBook[]>();
	for (const book of books) {
		const key = identity(book);
		if (key) index.set(key, [...(index.get(key) ?? []), book]);
	}
	return index;
}

function validateImportedBook(book: LibraryBook): void {
	if (!book.id || typeof book.path !== 'string' || !book.title?.trim() || typeof book.author !== 'string') throw new Error('无效的导入书目');
	if (!['pdf', 'epub'].includes(book.format) || !Array.isArray(book.tags) || !book.fingerprint) throw new Error(`无效的导入书目：${book.id}`);
	if (book.source && (!['csl', 'bibtex', 'zotero'].includes(book.source.provider) || !book.source.id?.trim())) throw new Error('无效的文献来源');
}
