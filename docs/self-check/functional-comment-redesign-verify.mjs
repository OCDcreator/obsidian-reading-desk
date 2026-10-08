import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Live verification for the comment popover redesign: reloads the deployed
 * plugin, opens a book highlight's comment popover, exercises the tag
 * combobox, captures screenshots and computed styles. */
const directory = path.dirname(fileURLToPath(import.meta.url));
const endpoint = process.env.RD_CDP_URL ?? 'http://127.0.0.1:9222';
const tabs = await (await fetch(`${endpoint}/json/list`)).json();
const tab = tabs.find(item => item.type === 'page' && item.url === 'app://obsidian.md/index.html' && item.title.includes('testvault'));
if (!tab) throw new Error('Test Vault CDP target not found');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
const consoleLines = [];
socket.addEventListener('message', event => {
	const message = JSON.parse(event.data);
	if (!message.id) {
		if (message.method === 'Runtime.consoleAPICalled') {
			consoleLines.push((message.params.args ?? []).map(arg => arg.value ?? arg.description ?? '').join(' '));
		}
		return;
	}
	const task = pending.get(message.id);
	if (!task) return;
	pending.delete(message.id);
	message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
	const id = ++sequence;
	pending.set(id, { resolve, reject });
	socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
	const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
	return result.result.value;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const screenshot = async name => {
	const shot = await send('Page.captureScreenshot', { format: 'png' });
	const target = path.join(directory, name);
	fs.writeFileSync(target, Buffer.from(shot.data, 'base64'));
	return target;
};

const report = { timestamp: new Date().toISOString() };
try {
	await send('Runtime.enable');
	await send('Page.enable');
	// A hidden renderer suspends rAF; focus emulation keeps the Reader alive.
	await send('Emulation.setFocusEmulationEnabled', { enabled: true });

	// 1. Reload the plugin in place so the freshly deployed build re-emits its startup line.
	report.reload = await evaluate(`(async()=>{const id='obsidian-reading-desk';const directory=app.plugins.plugins[id]?.manifest.dir??app.plugins.manifests[id]?.dir;await app.plugins.plugins[id]?.progressFlusher?.flush();await app.plugins.disablePlugin(id);const manifest=JSON.parse(await app.vault.adapter.read(directory+'/manifest.json'));if(manifest.id!==id)throw Error('Unexpected plugin manifest');app.plugins.manifests[id]={...manifest,dir:directory};await app.plugins.enablePlugin(id);return {enabled:!!app.plugins.plugins[id]};})()`);
	await sleep(1600);
	report.startupLines = consoleLines.filter(line => /Reading Desk|reading-desk|Margin/.test(line));

	// 2. Open the shelf and pick an existing highlight (first-page preferred).
	report.pick = await evaluate(`(async()=>{
		await app.commands.executeCommandById('obsidian-reading-desk:open-reading-desk');
		await new Promise(r=>setTimeout(r,800));
		const plugin=app.plugins.plugins['obsidian-reading-desk'];
		const data=plugin.repository.snapshot();
		const all=Object.values(data.highlights);
		const first=all.filter(h=>h.page===0&&h.text)[0]??all.find(h=>h.text)??null;
		if(!first) return { total: all.length, first: null };
		const book=Object.values(data.books).find(b=>b.path===first.pdfPath);
		return { total: all.length, first: { id:first.id, page:first.page, color:first.color, tags:first.tags }, bookTitle: book?.title ?? null };
	})()`);
	if (!report.pick.first) throw new Error('No highlights in the vault to verify against');

	// 3. Open the book that owns the highlight and navigate to its page.
	report.opened = await evaluate(`(async()=>{
		const title=${JSON.stringify(report.pick.bookTitle)};
		const card=[...document.querySelectorAll('.rd-shelf-card')].find(node=>node.textContent.includes(title));
		if(!card) return { opened:false, reason:'shelf card not found' };
		card.click();
		await new Promise(r=>setTimeout(r,1800));
		const page=${report.pick.first.page};
		if(page>0){
			const view=app.workspace.getLeavesOfType('reading-desk-reader')[0]?.view;
			if(view?.goTo) await view.goTo(page+1,{jump:true,smooth:false});
			await new Promise(r=>setTimeout(r,800));
		}
		return { opened: !!document.querySelector('.rd-reader') };
	})()`);
	if (!report.opened.opened) throw new Error('Reader did not open');

	// 4. Open the comment popover for the highlight and assert the new chrome.
	report.popover = await evaluate(`(async()=>{
		const id=${JSON.stringify(report.pick.first.id)};
		let button=document.querySelector('.rd-highlight-comment-button[data-highlight-id="'+id+'"]');
		if(!button){
			const mark=document.querySelector('[data-highlight-id="'+id+'"]');
			mark?.scrollIntoView({block:'center'});
			await new Promise(r=>setTimeout(r,600));
			button=document.querySelector('.rd-highlight-comment-button[data-highlight-id="'+id+'"]');
		}
		if(!button) return { open:false, reason:'comment button not rendered' };
		button.click();
		await new Promise(r=>setTimeout(r,400));
		const pop=document.querySelector('.rd-comment-popover');
		if(!pop) return { open:false, reason:'popover missing' };
		const cs=el=>el?getComputedStyle(el):null;
		const swatch=cs(pop.querySelector('.rd-swatch'));
		const primary=cs(pop.querySelector('.rd-button--primary'));
		const header=cs(pop.querySelector('.rd-comment-popover__header'));
		const excerpt=cs(pop.querySelector('.rd-comment-popover__excerpt'));
		return {
			open:true,
			swatchShape: swatch ? { radius: swatch.borderRadius, width: swatch.width, height: swatch.height } : null,
			primaryButton: primary ? { background: primary.backgroundColor, color: primary.color } : null,
			headerPosition: header?.position ?? null,
			excerptBar: excerpt ? { borderLeftWidth: excerpt.borderLeftWidth, borderLeftColor: excerpt.borderLeftColor } : null,
			commentCount: pop.querySelector('.rd-comment-popover__count')?.textContent ?? null
		};
	})()`);
	if (report.popover.open) report.screenshots = { popover: await screenshot('functional-comment-redesign-popover.png') };

	// 5. Exercise the tag combobox: focus, fuzzy filter, arrow highlight.
	report.combobox = await evaluate(`(async()=>{
		const input=document.querySelector('.rd-combo__input');
		if(!input) return { present:false };
		input.focus();
		const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
		setter.call(input,'');
		input.dispatchEvent(new Event('input',{bubbles:true}));
		await new Promise(r=>setTimeout(r,120));
		const menuAll=document.querySelector('.rd-combo__menu');
		const allOptions=[...menuAll.querySelectorAll('.rd-combo__option')].map(o=>o.textContent);
		setter.call(input,'化');
		input.dispatchEvent(new Event('input',{bubbles:true}));
		await new Promise(r=>setTimeout(r,120));
		input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
		await new Promise(r=>setTimeout(r,120));
		const menu=document.querySelector('.rd-combo__menu');
		const cs=getComputedStyle(menu);
		return {
			present:true,
			allOptions,
			filtered:[...menu.querySelectorAll('.rd-combo__option')].map(o=>o.textContent),
			expanded: input.getAttribute('aria-expanded'),
			activeDescendant: input.getAttribute('aria-activedescendant'),
			menuStyle: { background: cs.backgroundColor, borderRadius: cs.borderRadius },
			highlighted: menu.querySelector('.is-highlighted')?.textContent ?? null
		};
	})()`);
	if (report.combobox.present) report.screenshots.combobox = await screenshot('functional-comment-redesign-combobox.png');

	// Leave the popover closed behind us.
	await evaluate(`(()=>{document.querySelector('.rd-comment-popover__close')?.click();return true;})()`);
} finally {
	const output = path.join(directory, 'functional-comment-redesign-result.json');
	fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
	console.log(JSON.stringify(report, null, 2));
	socket.close();
}
