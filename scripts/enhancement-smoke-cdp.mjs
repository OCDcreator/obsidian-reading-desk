import fs from 'node:fs';
import path from 'node:path';

const phase = process.argv[2] ?? 'inspect';
const endpoint = process.env.RD_CDP_URL ?? 'http://127.0.0.1:19222';
const output = path.resolve('.obsidian-debug/enhancement-20261002');
fs.mkdirSync(output, { recursive: true });
const targets = (await (await fetch(`${endpoint}/json/list`)).json()).filter(tab => tab.type === 'page' && tab.url === 'app://obsidian.md/index.html' && tab.title.includes('testvault'));
if (targets.length !== 1) throw new Error(`Expected one testvault, got ${targets.length}`);
const url = new URL(targets[0].webSocketDebuggerUrl);
url.host = new URL(endpoint).host;
const socket = new WebSocket(url);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const tasks = new Map();
const events = [];
socket.addEventListener('message', event => {
	const message = JSON.parse(event.data);
	if (!message.id) { events.push(message); return; }
	const task = tasks.get(message.id);
	if (!task) return;
	tasks.delete(message.id);
	message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
	const id = ++sequence;
	tasks.set(id, { resolve, reject });
	socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
	const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
	return result.result.value;
};
try {
await send('Runtime.enable');
if (phase === 'ui' || phase === 'functional') { await send('Runtime.discardConsoleEntries'); events.length = 0; }
if (phase === 'preflight') {
	const { build } = await import('esbuild');
	const bundle = await build({ entryPoints: ['src/data/DataValidation.ts'], bundle: true, platform: 'browser', format: 'iife', globalName: 'RdValidation', write: false });
	const check = await evaluate(`(()=>{${bundle.outputFiles[0].text}\ntry{const data=RdValidation.validateReadingDeskData(app.plugins.plugins['obsidian-reading-desk'].repository.snapshot());return {valid:true,books:Object.keys(data.books).length,highlights:Object.keys(data.highlights).length};}catch(error){return {valid:false,message:error.message,issues:error.issues};}})()`);
	fs.writeFileSync(path.join(output, 'preflight-validation.json'), JSON.stringify(check, null, 2));
	if (!check.valid) throw new Error(`Existing testvault data validation failed: ${JSON.stringify(check)}`);
}
if (phase === 'reload') {
	await send('Runtime.discardConsoleEntries'); events.length = 0;
	await evaluate(`(async()=>{const id='obsidian-reading-desk';const directory=app.plugins.plugins[id]?.manifest.dir??app.plugins.manifests[id]?.dir;await app.plugins.plugins[id]?.progressFlusher?.flush();await app.plugins.disablePlugin(id);const manifest=JSON.parse(await app.vault.adapter.read(directory+'/manifest.json'));if(manifest.id!==id)throw Error('Unexpected plugin manifest');app.plugins.manifests[id]={...manifest,dir:directory};await app.plugins.enablePlugin(id);return {enabled:!!app.plugins.plugins[id]};})()`);
	await new Promise(resolve => setTimeout(resolve, 1800));
}
if (phase === 'ui') {
	const { runUiScenarios } = await import('./enhancement-ui-scenarios.mjs');
	console.log(JSON.stringify(await runUiScenarios({ evaluate, send, output }), null, 2));
}
if (phase === 'functional-cleanup') {
	const { retryFunctionalCleanup } = await import('./enhancement-functional-scenarios.mjs');
	console.log(JSON.stringify(await retryFunctionalCleanup(evaluate, output), null, 2));
}
if (phase === 'functional') {
	const { runFunctionalScenarios } = await import('./enhancement-functional-scenarios.mjs');
	console.log(JSON.stringify(await runFunctionalScenarios({ evaluate, send, output }), null, 2));
}
const inspection = await evaluate(`(()=>{
 const plugin=app.plugins.plugins['obsidian-reading-desk'];if(!plugin)throw Error('Reading Desk unavailable');
 const data=plugin.repository.snapshot();
 const r=el=>{const b=el?.getBoundingClientRect();return b?{x:b.x,y:b.y,width:b.width,height:b.height}:null};
 return {version:plugin.manifest.version,dataShape:{books:Object.keys(data.books).length,highlights:Object.keys(data.highlights).length,firstPageHighlights:Object.values(data.highlights).filter(h=>h.page===0).length,comments:Object.keys(data.comments).length,lists:data.lists?.length,deleted:Object.keys(data.deletedAnnotations??{}).length,pending:Object.keys(data.pendingTargetWrites??{}).length},repositoryStatus:typeof plugin.repository.status==='function'?plugin.repository.status():typeof plugin.repository.getStatus==='function'?plugin.repository.getStatus():null,leaves:app.workspace.getLeavesOfType('reading-desk-reader').map(l=>({state:l.view.getState(),rect:r(l.view.containerEl)})),shelf:r(document.querySelector('.rd-shelf')),reader:r(document.querySelector('.rd-reader'))};
})()`);
const startup = events.filter(event => event.method === 'Runtime.consoleAPICalled').map(event => event.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ')).filter(text => text.includes('[Reading Desk]'));
const scopedErrors = events.filter(event => (event.method === 'Runtime.exceptionThrown' || (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error')) && /obsidian-reading-desk|\[Reading Desk\]/.test(JSON.stringify(event)));
const expectedBuild = fs.readFileSync('main.js', 'utf8').match(/["']([0-9]+\.[0-9]+\.[0-9]+\+[0-9TZ:.-]+)["']/)?.[1];
const result = { phase, checkedAt: new Date().toISOString(), expectedBuild, inspection, startup, scopedErrors };
fs.writeFileSync(path.join(output, `${phase}.json`), JSON.stringify(result, null, 2));
if (phase === 'reload' && (!expectedBuild || !startup.some(text => text.includes(expectedBuild)) || inspection.repositoryStatus?.phase !== 'ready' || inspection.version !== JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version)) throw new Error(`Reading Desk startup verification failed: ${JSON.stringify(result)}`);
if (['reload', 'ui', 'functional'].includes(phase) && scopedErrors.length) throw new Error(`Reading Desk scoped runtime errors: ${JSON.stringify(scopedErrors)}`);
if (phase === 'reload') {
	const baselinePath = path.join(output, 'preflight-validation.json');
	if (fs.existsSync(baselinePath) && inspection.dataShape.highlights !== JSON.parse(fs.readFileSync(baselinePath, 'utf8')).highlights) throw new Error('Existing annotations changed during deployment');
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(output, `${phase}.png`), Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(result, null, 2));
} finally { socket.close(); }
