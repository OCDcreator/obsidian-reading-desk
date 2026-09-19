import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const hashes = {};
const cache = new Map();
const checks = [];
const notices = [];
globalThis.__APP_VERSION__ = 'functional-synthetic';
globalThis.__BUILD_ID__ = 'functional-host-contract-only';
globalThis.document = {};
globalThis.window = { getSelection: () => ({ toString: () => 'Selected PDF paragraph' }) };
class TFile {
	constructor(file) { this.path = file; this.name = file.split('/').pop(); this.basename = this.name.replace(/\.[^.]+$/, ''); this.extension = this.name.split('.').pop(); this.stat = { mtime: 1, size: 20 }; }
}
class Plugin {
	constructor(app) { this.app = app; this.manifest = { dir: '.obsidian/plugins/obsidian-reading-desk' }; this.views = {}; this.commands = {}; this.domEvents = []; }
	async loadData() { return this.saved; }
	async saveData(data) { this.saved = structuredClone(data); }
	registerView(type, factory) { this.views[type] = factory; }
	addRibbonIcon() {}
	addCommand(command) { this.commands[command.id] = command; }
	addSettingTab() {}
	registerEvent() {}
	registerObsidianProtocolHandler(name, callback) { this.protocols ??= {}; this.protocols[name] = callback; }
	registerDomEvent(_target, type, callback) { this.domEvents.push({ type, callback }); }
}
const obsidian = { Plugin, TFile, MarkdownView: class {}, ItemView: class {}, PluginSettingTab: class {}, Setting: class {}, Menu: class {}, Notice: class { constructor(message) { notices.push(message); } } };
function loadSource(file) {
	const full = path.resolve(root, file);
	if (cache.has(full)) return cache.get(full).exports;
	const source = fs.readFileSync(full, 'utf8');
	hashes[path.relative(root, full)] = crypto.createHash('sha256').update(source).digest('hex');
	const loaded = new Module(full);
	loaded.filename = full;
	loaded.paths = Module._nodeModulePaths(root);
	loaded.require = id => {
		if (id === 'obsidian') return obsidian;
		if (id === 'pdfjs-dist') return {};
		if (id.startsWith('.')) {
			const target = path.resolve(path.dirname(full), id);
			if (fs.existsSync(`${target}.ts`)) return loadSource(`${target}.ts`);
			if (fs.existsSync(`${target}/index.ts`)) return loadSource(`${target}/index.ts`);
		}
		return Module.prototype.require.call(loaded, id);
	};
	cache.set(full, loaded);
	loaded._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, full);
	return loaded.exports;
}
function check(name, pass, evidence) { checks.push({ name, pass, evidence }); }
function fakeApp(initial = {}, enabled = true) {
	const content = new Map(Object.entries(initial));
	const nodes = new Map([...content.keys()].map(file => [file, new TFile(file)]));
	const opened = []; const executed = []; const probed = []; const read = []; const changed = []; const events = {};
	const commandNames = ['opencodian:add-current-note-to-context', 'opencodian:open-view'];
	const app = {
		plugins: { enabledPlugins: new Set(enabled ? ['opencodian'] : []), getPlugin: id => { probed.push(id); return id === 'opencodian' && enabled ? { id } : undefined; } },
		commands: { commands: Object.fromEntries(commandNames.map(name => [name, {}])), executeCommandById: async id => { executed.push(id); } },
		workspace: { openLinkText: async file => { opened.push(file); }, getLeavesOfType: () => [], getActiveFile: () => new TFile('books/source.pdf') },
		vault: {
			on: (type, callback) => { events[type] = callback; return {}; },
			getFiles: () => [...nodes.values()].filter(node => node instanceof TFile && !node.path.startsWith('.obsidian/')),
			getAbstractFileByPath: file => nodes.get(file),
			createFolder: async file => { nodes.set(file, { path: file }); },
			create: async (file, value) => { changed.push(file); content.set(file, value); const result = new TFile(file); nodes.set(file, result); return result; },
			process: async (file, transform) => { content.set(file.path, transform(content.get(file.path))); changed.push(file.path); },
			adapter: {
				exists: async file => { read.push(file); return content.has(file) || nodes.has(file) || [...content.keys()].some(key => key.startsWith(`${file}/`)); },
				read: async file => { read.push(file); if (!content.has(file)) throw new Error(`missing ${file}`); return content.get(file); },
				list: async folder => ({ files: [...content.keys()].filter(file => file.startsWith(`${folder}/`) && !file.slice(folder.length + 1).includes('/')), folders: [] }),
				getResourcePath: file => `app://synthetic-vault/${file}`
			}
		}
	};
	return { app, content, nodes, opened, executed, probed, read, changed, events };
}
const Main = loadSource('src/main.ts').default;
{
	const env = fakeApp(); const plugin = new Main(env.app); await plugin.onload();
	const availability = plugin.ai.availability();
	await plugin.askAiWithSelection('Actual main bridge selection', 'books/source.pdf');
	const context = [...env.content].find(([file]) => file.startsWith('Reading Desk/AI Context/'));
	check('production main probes enabled AI and passes selection through declared commands', availability.available && env.probed.includes('opencodian') && !!context?.[1].includes('Actual main bridge selection') && !!context?.[1].includes('books/source.pdf') && env.executed.join(',') === 'opencodian:add-current-note-to-context,opencodian:open-view', { availability, probed: env.probed, commands: env.executed, contextCreated: !!context, contextOpenedBeforeCommands: env.opened[0] === context?.[0], limit: 'Obsidian host is synthetic; actual AI app receiving/opening context still needs native evidence' });
	check('production main registers user entry points for portability, AI, and paste', ['import-legacy-bookshelf', 'export-library-markdown', 'export-library-json', 'ask-ai-about-selection'].every(id => id in plugin.commands) && plugin.domEvents.some(event => event.type === 'paste'), { commandIds: Object.keys(plugin.commands), domEvents: plugin.domEvents.map(event => event.type) });
}
{
	const env = fakeApp({}, false); const plugin = new Main(env.app); await plugin.onload();
	let failure; try { await plugin.askAiWithSelection('x', 'books/source.pdf'); } catch (error) { failure = error.message; }
	check('production main keeps AI unavailable without installed enabled plugin', !plugin.ai.availability().available && !!failure && env.executed.length === 0 && env.changed.length === 0, { availability: plugin.ai.availability(), commandCount: env.executed.length, createdCount: env.changed.length, failure });
}
{
	const legacyPath = '.obsidian/plugins/bookshelf/metadata/source.json';
	const legacy = JSON.stringify({ id: 'legacy-source', filepath: 'Books/source.pdf', filename: 'source.pdf', title: 'Old Title', author: 'Old Author', category: 'Research', progress: 50 });
	const env = fakeApp({ [legacyPath]: legacy, '.obsidian/plugins/obsidian-bookshelf/data.json': JSON.stringify({ booksFolder: 'Books', categories: ['Research'] }) });
	const plugin = new Main(env.app); await plugin.onload();
	const first = await plugin.importLegacyBookshelf();
	const second = await plugin.importLegacyBookshelf();
	check('production main imports actual legacy per-book metadata directory once without mutation', first.importedBookCount === 1 && second.alreadyImported === true && Object.values(plugin.repository.readBooks()).some(book => book.path === 'Books/source.pdf' && book.title === 'Old Title') && env.content.get(legacyPath) === legacy && !env.changed.some(file => file.startsWith('.obsidian/plugins/bookshelf/')), { first: { count: first.importedBookCount, marker: first.data.settings.importedBookshelf }, second: { count: second.importedBookCount, alreadyImported: second.alreadyImported }, read: env.read, oldFilesChanged: env.changed.filter(file => file.startsWith('.obsidian/plugins/bookshelf/')) });
}
{
	const env = fakeApp(); const plugin = new Main(env.app); await plugin.onload();
	let failure; try { await plugin.importLegacyBookshelf(); } catch (error) { failure = error.message; }
	check('missing legacy data does not consume the one-time import flag', !!failure && !plugin.repository.readSettings().importedBookshelf, { failure, imported: plugin.repository.readSettings().importedBookshelf });
	check('production main registers exact persisted highlight protocol', typeof plugin.protocols?.['reading-desk-highlight'] === 'function', { protocols: Object.keys(plugin.protocols ?? {}), scope: 'Handler reachability, native click/open/highlight rendering not exercised' });
}
{
	const env = fakeApp(); const plugin = new Main(env.app); await plugin.onload();
	await plugin.updateStorageSettings({ enabled: true, provider: 'oss', endpoint: 'oss-cn-hangzhou.aliyuncs.com', bucket: 'synthetic-bucket', region: 'cn-hangzhou', accessKeyId: 'synthetic-key', secretAccessKey: 'synthetic-secret' });
	const originalFetch = globalThis.fetch; const requests = [];
	globalThis.fetch = async (url, init) => { requests.push({ url, method: init.method }); return new Response('', { status: 200 }); };
	let binaryWrites = 0;
	env.app.vault.createBinary = async () => { binaryWrites += 1; };
	try { await plugin.createCrop({ pdfPath: 'Books/source.pdf', page: 0, rect: { x: 0.1, y: 0.2, width: 0.2, height: 0.1 }, target: 'canvas', image: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) }); }
	finally { globalThis.fetch = originalFetch; }
	const canvasEntry = [...env.content].find(([file]) => file.endsWith('.canvas'));
	const node = canvasEntry ? JSON.parse(canvasEntry[1]).nodes[0] : undefined;
	check('object-storage crop keeps only external image in target and writes no local PNG', binaryWrites === 0 && requests.length === 1 && requests[0].method === 'PUT' && node?.type === 'text' && node.text.includes('https://synthetic-bucket.') && ![...env.content.keys()].some(file => file.endsWith('.png')), { binaryWrites, requestCount: requests.length, targetNodeType: node?.type, externalImage: node?.text, scope: 'Request mocked deliberately; verifies main branching only, real account upload remains blocked' });
}
{
	const oldPath = 'Books/source.pdf'; const newPath = 'Books/renamed.pdf'; const targetPath = 'Notes/source.canvas';
	const env = fakeApp({ [oldPath]: 'synthetic PDF not parsed in unchanged-fingerprint rename', [targetPath]: '{"nodes":[],"edges":[]}' });
	const plugin = new Main(env.app); await plugin.onload();
	const record = { id: 'rename-highlight', pdfPath: oldPath, page: 0, rotation: 0, rects: [{ x: 0.1, y: 0.2, width: 0.2, height: 0.03 }], text: 'Preserved excerpt', color: 'moss', chapterPath: [], tags: [], createdAt: 1, updatedAt: 1 };
	const { writeCanvasExcerpt } = loadSource('src/targets/CanvasTargetAdapter.ts');
	const written = writeCanvasExcerpt(env.content.get(targetPath), targetPath, record);
	env.content.set(targetPath, written.content); record.target = written.result.target;
	await plugin.repository.commit(() => {
		plugin.repository.readBooks().book = { id: 'book', path: oldPath, format: 'pdf', title: 'Manual title', author: 'Manual author', fileSize: 20, fingerprint: { mtime: 1, size: 20 }, tags: ['retained'], progress: 0.5 };
		plugin.repository.readHighlights()[record.id] = record;
	});
	env.content.set(newPath, env.content.get(oldPath)); env.content.delete(oldPath); env.nodes.delete(oldPath); const renamed = new TFile(newPath); env.nodes.set(newPath, renamed);
	await plugin.onVaultRename(renamed, oldPath);
	const node = JSON.parse(env.content.get(targetPath)).nodes.find(item => item.readingDesk?.highlightId === record.id);
	const stored = plugin.repository.readHighlights()[record.id];
	const link = node?.readingDesk?.sourceLink;
	check('PDF rename preserves book state and rewrites exact target backlink', stored?.pdfPath === newPath && plugin.repository.readBooks().book.title === 'Manual title' && !!link && new URL(link).searchParams.get('file') === newPath, { storedSource: stored?.pdfPath, book: plugin.repository.readBooks().book, targetSource: node?.readingDesk?.pdfPath, targetLink: link });
	const { ReaderView } = loadSource('src/views/ReaderView.ts');
	let openedHighlight;
	const reader = Object.create(ReaderView.prototype);
	reader.openPdfAtHighlight = async (file, id) => { openedHighlight = { file, id }; };
	env.app.workspace.getLeaf = () => ({ view: reader, setViewState: async () => undefined });
	await plugin.openReaderHighlight({ file: oldPath, highlight: record.id });
	check('stale source URI resolves canonical renamed PDF via persisted highlight id', openedHighlight?.file === newPath && openedHighlight?.id === record.id, { uriFile: oldPath, openedHighlight, scope: 'Main protocol resolver with Reader open method captured; does not render the UI' });
	env.content.set(targetPath, '{"nodes":[],"edges":[]}');
	await plugin.syncTargetDeletion(targetPath);
	check('native-target deletion reconcile removes corresponding persistent highlight', !plugin.repository.readHighlights()[record.id], { survivingHighlightIds: Object.keys(plugin.repository.readHighlights()), limit: 'Actual main reconcile with synthetic vault; native delete gesture and visible repaint still need live evidence' });
	await plugin.onVaultDelete(renamed);
	check('source file delete removes its library record', !plugin.repository.readBooks().book, { survivingBookIds: Object.keys(plugin.repository.readBooks()) });
}
{
	const env = fakeApp(); const plugin = new Main(env.app); await plugin.onload();
	await plugin.commands['export-library-markdown'].callback();
	await plugin.commands['export-library-json'].callback();
	const outputPaths = [...env.content.keys()].filter(file => file.startsWith('Reading Desk/exports/'));
	const json = outputPaths.find(file => file.endsWith('.json')); const md = outputPaths.find(file => file.endsWith('.md'));
	check('registered export commands create readable Markdown and JSON files', !!md && env.content.get(md).startsWith('# Reading Desk') && !!json && JSON.parse(env.content.get(json)).schemaVersion === 1, { outputPaths, opened: env.opened, scope: 'Command handler execution with synthetic vault; native command-palette click not exercised' });
}
const output = { timestamp: new Date().toISOString(), hashes, summary: { passed: checks.filter(item => item.pass).length, failed: checks.filter(item => !item.pass).length }, checks, scope: 'Executes actual main.ts/AiIntegrationService and other source with synthetic Obsidian host/file interfaces; proves wiring, not UI actions or third-party runtime interoperability.' };
const destination = path.join(directory, process.argv[2] ?? 'functional-host-integration-result.json');
if (!path.basename(destination).startsWith('functional-')) throw new Error('Output must remain a functional-* artifact');
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.summary.failed ? 1 : 0;
