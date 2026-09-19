import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const hashes = {};
const cache = new Map();
const checks = [];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function loadSource(file) {
	const full = path.resolve(root, file);
	if (cache.has(full)) return cache.get(full).exports;
	const source = fs.readFileSync(full, 'utf8');
	hashes[path.relative(root, full)] = digest(source);
	const compiled = ts.transpileModule(source, { compilerOptions: {
		target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, esModuleInterop: true
	} }).outputText;
	const loaded = new Module(full);
	loaded.filename = full;
	loaded.paths = Module._nodeModulePaths(root);
	loaded.require = id => {
		if (id.startsWith('.')) {
			const target = path.resolve(path.dirname(full), id);
			if (fs.existsSync(`${target}.ts`)) return loadSource(`${target}.ts`);
		}
		return Module.prototype.require.call(loaded, id);
	};
	cache.set(full, loaded);
	loaded._compile(compiled, full);
	return loaded.exports;
}
function check(name, pass, evidence) { checks.push({ name, pass, evidence }); }
function pdfBytes(viewBox) {
	const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		`<< /Type /Page /Parent 2 0 R /MediaBox [${viewBox.join(' ')}] /Resources << >> /Contents 4 0 R >>`,
		'<< /Length 0 >>\nstream\n\nendstream'];
	let pdf = '%PDF-1.7\n'; const offsets = [0];
	objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
	const xref = Buffer.byteLength(pdf);
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new Uint8Array(Buffer.from(pdf));
}
const geometry = loadSource('src/reader/PdfSelectionGeometry.ts');
for (const viewBox of [[0, 0, 600, 800], [20, 30, 620, 830]]) {
	const document = await pdfjs.getDocument({ data: pdfBytes(viewBox), isEvalSupported: false }).promise;
	const page = await document.getPage(1);
	const source = page.getViewport({ scale: 2, rotation: 0 });
	const rect = [viewBox[0] + 60, viewBox[1] + 680, viewBox[0] + 120, viewBox[1] + 700];
	const [a, b] = source.convertToViewportPoint(rect[0], rect[1]);
	const [c, d] = source.convertToViewportPoint(rect[2], rect[3]);
	const normalized = geometry.normalizeClientRect({ left: Math.min(a, c), top: Math.min(b, d), right: Math.max(a, c), bottom: Math.max(b, d) },
		{ left: 0, top: 0, width: source.width, height: source.height }, source);
	for (const rotation of [0, 90]) {
		const target = page.getViewport({ scale: 1, rotation });
		const [x1, y1] = target.convertToViewportPoint(rect[0], rect[1]);
		const [x2, y2] = target.convertToViewportPoint(rect[2], rect[3]);
		const expected = { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
		const actual = geometry.denormalizeRect(normalized, target);
		check(`geometry actual PDF ${viewBox.join(',')} scale2-to1 rotation${rotation}`, Object.keys(expected).every(key => Math.abs(expected[key] - actual[key]) < 0.001), { normalized, expected, actual });
	}
	await document.destroy();
}
const { LibraryIndex } = loadSource('src/library/LibraryIndex.ts');
const files = [
	{ path: 'books/a.pdf', extension: 'pdf', stat: { mtime: 1, size: 10 } },
	{ path: 'books/b.pdf', extension: 'pdf', stat: { mtime: 1, size: 20 } }
];
{
	const books = {}; let release; let entered; let calls = 0;
	const held = new Promise(resolve => { release = resolve; });
	const started = new Promise(resolve => { entered = resolve; });
	const index = new LibraryIndex({ readBooks: () => books, readCategories: () => [], commit: async fn => fn() },
		{ extract: async file => { if (++calls === 1) { entered(); await held; } return { title: file.path, author: 'auto' }; } });
	const first = index.scan(files.slice(0, 1), ['books']);
	await started;
	const second = index.scan(files, ['books']);
	await Promise.resolve(); await Promise.resolve(); release();
	await Promise.all([first, second]);
	check('overlapping scans retain latest discovered book', !!index.getByPath(files[1].path), { paths: index.list().map(book => book.path) });
}
{
	const books = {}; let fail = true;
	const index = new LibraryIndex({ readBooks: () => books, readCategories: () => [], commit: async fn => {
		if (fail) { fail = false; throw new Error('simulated single transient save failure'); } fn();
	} }, { extract: async file => ({ title: file.path, author: 'auto' }) });
	await index.scan(files, ['books']).catch(() => undefined);
	let error;
	try { await index.scan(files, ['books']); } catch (failure) { error = failure.message; }
	check('scan queue recovers after one transient persistence rejection', !error && !!index.getByPath(files[1].path), { error, paths: index.list().map(book => book.path) });
}
const storage = loadSource('src/storage/ObjectStorageService.ts');
const fixedDate = new Date('2025-01-02T03:04:05.000Z');
const base = { enabled: true, imageHostEnabled: true, provider: 'oss', endpoint: 'oss-cn-hangzhou.aliyuncs.com', region: 'cn-hangzhou', bucket: 'research-bucket', prefix: 'reading-desk', accessKeyId: 'test-ak', secretAccessKey: 'test-secret' };
const cos = { ...base, provider: 'cos', endpoint: 'cos.ap-shanghai.myqcloud.com', region: 'ap-shanghai' };
const oraclePath = path.join(directory, 'functional-cos-sdk-util.cjs');
const oracleSource = fs.readFileSync(oraclePath, 'utf8');
const oracleModule = new Module(oraclePath);
oracleModule.filename = oraclePath;
oracleModule.paths = Module._nodeModulePaths(root);
oracleModule.require = id => id === 'cos-fast-xml-parser'
	? { XMLParser: class { parse() { throw new Error('XML unavailable in signing-only oracle'); } }, XMLBuilder: class { build() { throw new Error('XML unavailable in signing-only oracle'); } } }
	: Module.prototype.require.call(oracleModule, id);
oracleModule._compile(oracleSource, oraclePath);
const oracle = oracleModule.exports;
const time = '1735787045;1735787945';
for (const key of ['reading-desk/images/a.png', 'reading-desk/实验 图(1).png']) {
	const actual = await storage.signCosRequest(cos, 'PUT', key, 'image/png', fixedDate);
	const expected = oracle.getAuth({ SecretId: cos.accessKeyId, SecretKey: cos.secretAccessKey, Method: 'PUT', Pathname: `/${key}`, Headers: { Host: new URL(actual.url).host }, KeyTime: time });
	check(`COS signature matches official SDK: ${key}`, actual.headers.authorization === expected, { sdkVersion: '3.0.0', oracleSourceSha256: digest(oracleSource), expected, actual: actual.headers.authorization });
}
{
	let request;
	await new storage.ObjectStorageService(cos, async (url, init) => { request = { url, init }; return new Response('', { status: 200 }); }, { now: () => fixedDate }).testConnection();
	const expected = oracle.getAuth({ SecretId: cos.accessKeyId, SecretKey: cos.secretAccessKey, Method: 'GET', Pathname: '/', Headers: { Host: new URL(request.url).host }, Query: { 'max-keys': '1' }, KeyTime: time });
	check('COS connection signature matches official SDK', request.init.headers.authorization === expected, { expected, actual: request.init.headers.authorization });
}
{
	const key = 'reading-desk/images/a.png';
	const actual = await storage.signOssRequest(base, 'PUT', key, 'image/png', fixedDate);
	const canonical = `PUT\n\nimage/png\n\nx-oss-date:${fixedDate.toUTCString()}\n/${base.bucket}/${key}`;
	const expected = `OSS ${base.accessKeyId}:${crypto.createHmac('sha1', base.secretAccessKey).update(canonical).digest('base64')}`;
	check('OSS V1 HMAC matches independently computed canonical request', expected === actual.headers.authorization, { expected, actual: actual.headers.authorization, scope: 'cryptographic/protocol construction only; no cloud request' });
}
const highlight = (id, pdfPath = 'papers/a.pdf') => ({ id, pdfPath, page: 2, rotation: 0, rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }], text: 'Original excerpt', color: 'moss', chapterPath: ['第一章', '导论'], tags: [], createdAt: 1, updatedAt: 1 });
const canvasAdapter = loadSource('src/targets/CanvasTargetAdapter.ts');
const excalidraw = loadSource('src/targets/ExcalidrawTargetAdapter.ts');
const markdown = loadSource('src/targets/MarkdownTargetAdapter.ts');
for (const page of [0, 12]) {
	const record = { ...highlight(`page-${page}`), page, chapterPath: [] };
	const canvasResult = canvasAdapter.writeCanvasExcerpt('{"nodes":[],"edges":[]}', 'page.canvas', record);
	const markdownResult = markdown.writeMarkdownExcerpt('', 'page.md', record);
	const scene = '---\nexcalidraw-plugin: parsed\n---\n```json\n{"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}}\n```\n';
	const excalidrawResult = excalidraw.writeExcalidrawExcerpt(scene, 'page.excalidraw.md', record);
	const results = [
		{ type: 'canvas', result: canvasResult, text: JSON.parse(canvasResult.content).nodes[0].text, stored: JSON.parse(canvasResult.content).nodes[0].readingDesk.page },
		{ type: 'markdown', result: markdownResult, text: markdownResult.content, stored: markdown.parseMarkdownBacklink(markdownResult.content, record.id).page },
		{ type: 'excalidraw', result: excalidrawResult, text: JSON.parse(/```json\n([\s\S]*?)\n```/.exec(excalidrawResult.content)[1]).elements[0].text, stored: JSON.parse(/```json\n([\s\S]*?)\n```/.exec(excalidrawResult.content)[1]).elements[0].customData.readingDesk.page }
	];
	for (const value of results) {
		const expected = page + 1;
		const uri = new URL(value.result.result.sourceLink);
		const exactAnchor = uri.hostname === 'reading-desk-highlight' && uri.searchParams.get('highlight') === record.id && uri.searchParams.get('file') === record.pdfPath;
		check(`${value.type} internal page ${page} renders human page ${expected} and links exact highlight`, value.stored === page && value.text.includes(`第 ${expected} 页`) && exactAnchor, { storedZeroBasedPage: value.stored, expectedHumanPage: expected, exactAnchor, sourceLink: value.result.result.sourceLink, contract: 'Exact highlight URI replaces weaker page-only link; main registration/native action verified separately' });
	}
}
{
	const { TargetService } = loadSource('src/targets/TargetService.ts');
	let content = '{"nodes":[],"edges":[]}';
	const service = new TargetService({
		atomicTransform: async (_path, transform) => {
			// An edit arrives immediately before the vault transaction acquires current content.
			content = JSON.stringify({ nodes: [{ id: 'user-concurrent-node', type: 'text', text: 'User edit before atomic transform', x: 0, y: 0, width: 100, height: 100 }], edges: [] });
			content = transform(content);
		}
	});
	await service.writeExcerpt({ type: 'canvas', path: 'notes/concurrent.canvas' }, highlight('one'));
	const nodes = JSON.parse(content).nodes;
	check('Target file transaction preserves an external edit before atomic transform', nodes.some(node => node.id === 'user-concurrent-node'), { finalNodeIds: nodes.map(node => node.id), contract: 'TargetService computes its adapter result inside atomicTransform using the supplied current contents; main.ts binding separately reviewed' });
}
{
	const first = canvasAdapter.writeCanvasExcerpt('{"nodes":[],"edges":[]}', 'notes/a.canvas', highlight('one'));
	const second = canvasAdapter.writeCanvasExcerpt(first.content, 'notes/a.canvas', highlight('two', 'papers/b.pdf'));
	const canvas = JSON.parse(second.content);
	const excerpts = canvas.nodes.filter(node => node.readingDesk?.kind === 'excerpt');
	const chapters = canvas.nodes.filter(node => node.readingDesk?.kind === 'chapter');
	check('Canvas excerpts serialize their palette color', excerpts.every(node => typeof node.color === 'string' && node.color.length > 0), { colors: excerpts.map(node => node.color ?? null) });
	check('Canvas same chapter names in two PDFs remain separate', chapters.length === 4 && new Set(chapters.map(node => node.readingDesk.pdfPath)).size === 2, { chapters: chapters.map(node => ({ pdfPath: node.readingDesk.pdfPath, chapterPath: node.readingDesk.chapterPath })) });
}
{
	const scene = '---\nexcalidraw-plugin: parsed\n---\n# Drawing\n```json\n{"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}}\n```\n';
	const first = excalidraw.writeExcalidrawExcerpt(scene, 'notes/a.excalidraw.md', highlight('one'), { title: 'OLD', sourceLink: 'obsidian://reading-desk?id=old' });
	const second = excalidraw.writeExcalidrawExcerpt(first.content, 'notes/a.excalidraw.md', { ...highlight('one'), text: 'Changed excerpt' }, { title: 'NEW', sourceLink: 'obsidian://reading-desk?id=new' });
	const element = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(second.content)[1]).elements[0];
	check('Excalidraw existing excerpt update changes visible text and link', element.text.includes('NEW') && element.text.includes('Changed excerpt') && element.link === 'obsidian://reading-desk?id=new', { text: element.text, link: element.link, metadata: element.customData.readingDesk });
}
{
	const existingFile = path.join(directory, 'functional-compressed-scene.md');
	if (fs.existsSync(existingFile)) {
		const original = fs.readFileSync(existingFile, 'utf8');
		let failure;
		try { excalidraw.writeExcalidrawExcerpt(original, 'readonly-existing-scene.excalidraw.md', highlight('one')); } catch (error) { failure = error.message; }
		check('Excalidraw reads standard compressed-json scene (synthetic lz-string fixture)', !failure, { source: path.relative(root, existingFile), sourceSha256: digest(original), fencedFormats: [...original.matchAll(/^```([^\n\r]*)/gm)].map(match => match[1]).filter(Boolean), error: failure, unchangedOnDisk: digest(fs.readFileSync(existingFile)) === digest(original) });
	}
}
{
	const first = markdown.writeMarkdownExcerpt('# User content\n', 'notes/a.md', highlight('one'), { sourceLink: 'obsidian://reading-desk?id=old' });
	const second = markdown.writeMarkdownExcerpt(first.content, 'notes/a.md', { ...highlight('one'), text: 'Updated quote' }, { sourceLink: 'obsidian://reading-desk?id=new', title: 'New title' });
	const link = markdown.parseMarkdownBacklink(second.content, 'one');
	check('Markdown update preserves user content and replaces backlink without duplicating excerpt', second.content.startsWith('# User content\n') && second.content.includes('Updated quote') && link.sourceLink.endsWith('new') && [...second.content.matchAll(/reading-desk:excerpt-start/g)].length === 1, { link });
}
const result = { timestamp: new Date().toISOString(), pdfjs: pdfjs.version, hashes, summary: { passed: checks.filter(item => item.pass).length, failed: checks.filter(item => !item.pass).length }, checks, limits: ['No Obsidian UI interaction in this run.', 'No actual OSS/COS credentials or cloud requests.', 'Fixture/in-memory adapter checks do not prove native rendering.'] };
const output = path.join(directory, process.argv[2] ?? 'functional-repro-result.json');
if (!path.basename(output).startsWith('functional-')) throw new Error('Output must remain a functional-* artifact');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.summary.failed > 0 ? 1 : 0;
