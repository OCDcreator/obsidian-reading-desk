import type { PdfRenderer } from './PdfRenderer';

export interface OpenedReaderDocument { renderer: PdfRenderer; pages: number; }

/** Opens on an isolated renderer and promotes it only while the request still owns the Reader. */
export async function openReaderDocument(path: string, candidate: PdfRenderer, previous: PdfRenderer, isCurrent: () => boolean): Promise<OpenedReaderDocument | null> {
	let pages: number;
	try {
		pages = await candidate.open(path);
	} catch (error) {
		await candidate.close();
		if (!isCurrent()) return null;
		throw error;
	}
	if (!isCurrent()) { await candidate.close(); return null; }
	await previous.close();
	if (!isCurrent()) { await candidate.close(); return null; }
	return { renderer: candidate, pages };
}
