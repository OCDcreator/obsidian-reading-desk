import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const hashes = {};
const cache = new Map();
const checks = [];
function loadSource(file) {
	const full = path.resolve(root, file);
	if (cache.has(full)) return cache.get(full).exports;
	const source = fs.readFileSync(full, 'utf8');
	hashes[path.relative(root, full)] = crypto.createHash('sha256').update(source).digest('hex');
	const loaded = new Module(full);
	loaded.filename = full;
	loaded.paths = Module._nodeModulePaths(root);
	loaded.require = id => id.startsWith('.') && fs.existsSync(path.resolve(path.dirname(full), `${id}.ts`))
		? loadSource(path.resolve(path.dirname(full), `${id}.ts`)) : Module.prototype.require.call(loaded, id);
	cache.set(full, loaded);
	loaded._compile(ts.transpileModule(source, { compilerOptions: {
		target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, esModuleInterop: true
	} }).outputText, full);
	return loaded.exports;
}
function check(name, pass, evidence) { checks.push({ name, pass, evidence }); }
const { ReadingDeskRepository } = loadSource('src/data/ReadingDeskRepository.ts');
{
	let attempts = 0; let saved;
	const repository = new ReadingDeskRepository({ load: async () => null, save: async value => {
		if (++attempts === 1) throw new Error('one transient save error'); saved = value;
	} });
	await repository.initialize();
	await repository.updateSettings({ readerLayout: 'focus' }).catch(() => undefined);
	let failure;
	try { await repository.updateSettings({ readerLayout: 'split' }); } catch (error) { failure = error.message; }
	check('repository resumes after a single rejected save', !failure && attempts === 2 && saved?.settings.readerLayout === 'split', { attempts, failure, inMemory: repository.readSettings().readerLayout, persisted: saved?.settings.readerLayout });
}
const { MetadataExtractor } = loadSource('src/library/MetadataExtractor.ts');
const writes = [];
const input = new Map();
const metadata = new MetadataExtractor({ readBinary: async file => input.get(file), writeBinary: async (file, data) => { writes.push({ file, bytes: data.byteLength }); } }, {
	load: data => pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWuoAAAAASUVORK5CYII=', 'base64');
async function epub(version, title) {
	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
	zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
	zip.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="${version}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>Alice &amp; Bob</dc:creator>${version === '2.0' ? '<meta name="cover" content="cover" />' : ''}</metadata><manifest><item id="cover" href="cover.png" media-type="image/png"${version === '3.0' ? ' properties="cover-image"' : ''}/></manifest><spine/></package>`);
	zip.file('OEBPS/cover.png', png);
	return zip.generateAsync({ type: 'arraybuffer' });
}
for (const [file, version] of [['books/epub2.epub', '2.0'], ['书籍/甲.epub', '3.0'], ['书籍/乙.epub', '3.0']]) {
	input.set(file, await epub(version, 'Science &amp; Art'));
	const before = writes.length;
	const result = await metadata.extract({ path: file, extension: 'epub', stat: { mtime: 1, size: input.get(file).byteLength } });
	check(`${version} EPUB cover from actual ZIP/OPF ${file}`, !!result.coverPath && writes.length === before + 1, { result, writes: writes.slice(before) });
	if (version === '2.0') check('EPUB decodes XML entity values', result.title === 'Science & Art' && result.author === 'Alice & Bob', { title: result.title, author: result.author });
}
check('non-ASCII source book names do not share a cover cache path', new Set(writes.slice(-2).map(item => item.file)).size === 2, { lastTwoWrites: writes.slice(-2) });
{
	const sourcePath = `书籍/${'研究'.repeat(22)}.epub`;
	const contents = await epub('3.0', 'Long but valid source filename');
	let attempt;
	const extractor = new MetadataExtractor({ readBinary: async () => contents, writeBinary: async (file, data) => {
		const basename = path.basename(file);
		const actualPath = path.join(directory, `functional-cover-write-${basename}`);
		attempt = { sourceBasenameBytes: Buffer.byteLength(path.basename(sourcePath)), coverBasenameBytes: Buffer.byteLength(basename) };
		try {
			fs.writeFileSync(actualPath, new Uint8Array(data), { flag: 'wx' });
			fs.unlinkSync(actualPath);
		} catch (error) { attempt.filesystemError = error.code; throw error; }
	} }, { load: async () => { throw new Error('EPUB must not load PDF'); } });
	const result = await extractor.extract({ path: sourcePath, extension: 'epub', stat: { mtime: 1, size: contents.byteLength } });
	check('cover cache key fits actual filesystem basename limit for a valid Unicode source', !!result.coverPath && !attempt?.filesystemError, { attempt, result, scope: 'Writes only a temporary functional-cover-write-* output beside this script, removes it if successful' });
}

function pdfWithXmp() {
	const xmp = '<?xpacket begin="\ufeff"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">XMP Book</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>Alice</rdf:li><rdf:li>Bob</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
	const objects = ['<< /Type /Catalog /Pages 2 0 R /Metadata 5 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << >> /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream', `<< /Type /Metadata /Subtype /XML /Length ${Buffer.byteLength(xmp)} >>\nstream\n${xmp}\nendstream`];
	let pdf = '%PDF-1.7\n'; const offsets = [0];
	objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
	const xref = Buffer.byteLength(pdf);
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new Uint8Array(Buffer.from(pdf));
}
{
	const data = pdfWithXmp();
	const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
	const original = await doc.getMetadata();
	const authors = original.metadata.get('dc:creator');
	await doc.destroy();
	input.set('books/xmp.pdf', data.slice().buffer);
	const result = await metadata.extract({ path: 'books/xmp.pdf', extension: 'pdf', stat: { mtime: 1, size: data.length } });
	check('PDF XMP dc:creator sequence is retained', result.author.includes('Alice') && result.author.includes('Bob'), { actualPdfjsAuthors: authors, extractedAuthor: result.author, title: result.title });
}
// AI production composition is now exercised by functional-host-integration-repro.mjs.
// Testing an empty optional constructor map no longer represents main.ts wiring.
const output = { timestamp: new Date().toISOString(), hashes, summary: { passed: checks.filter(item => item.pass).length, failed: checks.filter(item => !item.pass).length }, checks, scope: 'Isolated services with real JSZip and real pdfjs parsing; no UI, no main-vault fixtures, no actual cloud requests.' };
const destination = path.join(directory, process.argv[2] ?? 'functional-data-integration-result.json');
if (!path.basename(destination).startsWith('functional-')) throw new Error('Output must remain a functional-* artifact');
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.summary.failed ? 1 : 0;
