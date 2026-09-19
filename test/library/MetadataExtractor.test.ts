import * as JSZip from 'jszip';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { MetadataExtractor, type BinaryReader, type PdfLoader } from '../../src/library/MetadataExtractor';

class MemoryBinaryReader implements BinaryReader {
	readonly writes = new Map<string, ArrayBuffer>();

	constructor(private readonly reads: Record<string, ArrayBuffer>) { }

	async readBinary(path: string): Promise<ArrayBuffer> {
		const value = this.reads[path];
		if (!value) throw new Error(`missing binary fixture: ${path}`);
		return value;
	}

	async writeBinary(path: string, value: ArrayBuffer): Promise<void> {
		this.writes.set(path, value);
	}
}

const noPdf: PdfLoader = {
	load: async () => {
		throw new Error('PDF loader should not run for EPUB tests');
	}
};

async function epubFixture(opf: string): Promise<ArrayBuffer> {
	const zip = new (JSZip as unknown as { default: new () => {
		file(path: string, contents: string | Uint8Array): void;
		generateAsync(options: { type: 'arraybuffer' }): Promise<ArrayBuffer>;
	} }).default();
	zip.file('META-INF/container.xml', '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>');
	zip.file('OPS/content.opf', opf);
	zip.file('OPS/images/cover.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
	return zip.generateAsync({ type: 'arraybuffer' });
}

const EPUB2_OPF = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata>
    <dc:title>研究 &amp; 方法 &#x4E66; &#65;</dc:title>
    <dc:creator>作者 &amp; 合作者</dc:creator>
    <meta content="cover-image" scheme="x" name="cover" />
  </metadata>
  <manifest><item href="images/cover.jpg" media-type="image/jpeg" id="cover-image" /></manifest>
</package>`;

describe('MetadataExtractor EPUB metadata', () => {
	it('reads EPUB2 cover metadata regardless of attribute order and decodes XML entities', async () => {
		const path = '书架/实验.epub';
		const reader = new MemoryBinaryReader({ [path]: await epubFixture(EPUB2_OPF) });
		const metadata = await new MetadataExtractor(reader, noPdf).extract({ path, extension: 'epub', stat: { mtime: 1, size: 1 } });

		expect(metadata).toMatchObject({ title: '研究 & 方法 书 A', author: '作者 & 合作者' });
		expect(metadata.coverPath).toMatch(/\.jpg$/);
		expect(reader.writes.get(metadata.coverPath ?? '')).toBeInstanceOf(ArrayBuffer);
	});

	it('creates deterministic but distinct cover paths for Unicode source paths', async () => {
		const left = '书架/非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常甲.epub';
		const right = `${left.slice(0, -5)}乙.epub`;
		const reader = new MemoryBinaryReader({ [left]: await epubFixture(EPUB2_OPF), [right]: await epubFixture(EPUB2_OPF) });
		const extractor = new MetadataExtractor(reader, noPdf);

		const leftFirst = await extractor.extract({ path: left, extension: 'epub', stat: { mtime: 1, size: 1 } });
		const leftSecond = await extractor.extract({ path: left, extension: 'epub', stat: { mtime: 1, size: 1 } });
		const rightResult = await extractor.extract({ path: right, extension: 'epub', stat: { mtime: 1, size: 1 } });

		expect(leftFirst.coverPath).toBe(leftSecond.coverPath);
		expect(leftFirst.coverPath).not.toBe(rightResult.coverPath);
		expect(basename(leftFirst.coverPath ?? '')).toMatch(/^[a-f0-9]{64}\.jpg$/);
		expect(Buffer.byteLength(basename(leftFirst.coverPath ?? ''))).toBeLessThanOrEqual(255);
	});

	it('writes a cover for a 137-byte Unicode source filename without exceeding the filesystem basename limit', async () => {
		const sourcePath = `书架/${'研'.repeat(44)}.epub`;
		expect(Buffer.byteLength(basename(sourcePath))).toBe(137);
		const temporaryDirectory = await mkdtemp(join(tmpdir(), 'reading-desk-cover-'));
		const source = await epubFixture(EPUB2_OPF);
		const reader: BinaryReader = {
			readBinary: async path => {
				expect(path).toBe(sourcePath);
				return source;
			},
			writeBinary: async (path, value) => {
				await mkdir(temporaryDirectory, { recursive: true });
				await writeFile(path, new Uint8Array(value));
			}
		};
		try {
			const metadata = await new MetadataExtractor(reader, noPdf, temporaryDirectory).extract({ path: sourcePath, extension: 'epub', stat: { mtime: 1, size: 1 } });
			const coverPath = metadata.coverPath ?? '';
			expect(Buffer.byteLength(basename(coverPath))).toBeLessThanOrEqual(255);
			expect(await readFile(coverPath)).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
		} finally {
			await rm(temporaryDirectory, { recursive: true, force: true });
		}
	});
});

describe('MetadataExtractor PDF XMP metadata', () => {
	it('joins an XMP dc:creator string array', async () => {
		const reader = new MemoryBinaryReader({ 'papers/sample.pdf': new ArrayBuffer(1) });
		const pdf: PdfLoader = {
			load: async () => ({
				numPages: 3,
				getMetadata: async () => ({ metadata: { get: name => name === 'dc:creator' ? ['Alice', 'Béatrice'] : name === 'dc:title' ? 'XMP title' : undefined } }),
				getPage: async () => { throw new Error('no browser cover rendering in test'); },
				destroy: async () => undefined
			})
		};

		await expect(new MetadataExtractor(reader, pdf).extract({ path: 'papers/sample.pdf', extension: 'pdf', stat: { mtime: 1, size: 1 } }))
			.resolves.toMatchObject({ title: 'XMP title', author: 'Alice, Béatrice', pageCount: 3 });
	});
});
