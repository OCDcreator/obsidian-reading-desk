import fs from 'node:fs';
import path from 'node:path';

/** Settings may live in Obsidian's about:blank popout instead of the main vault document. */
export async function inspectSettingsWindow(output) {
	const endpoint = process.env.RD_CDP_URL ?? 'http://127.0.0.1:19222';
	const tabs = await (await fetch(`${endpoint}/json/list`)).json();
	const popouts = tabs.filter(tab => tab.type === 'page' && tab.url === 'about:blank' && /设置|Settings/.test(tab.title) && tab.title.includes('testvault'));
	const candidates = popouts.length ? popouts : tabs.filter(tab => tab.type === 'page' && tab.url === 'app://obsidian.md/index.html' && tab.title.includes('testvault'));
	if (candidates.length !== 1) throw new Error(`Expected one testvault settings surface, got ${candidates.length}`);
	const url = new URL(candidates[0].webSocketDebuggerUrl); url.host = new URL(endpoint).host;
	const socket = new WebSocket(url);
	await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
	let sequence = 0;
	const tasks = new Map();
	socket.addEventListener('message', event => {
		const message = JSON.parse(event.data), task = tasks.get(message.id); if (!task) return;
		tasks.delete(message.id); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
	});
	const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; tasks.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
	try {
		const evaluated = await send('Runtime.evaluate', { returnByValue: true, expression: `(()=>{const root=document.querySelector('.reading-desk-settings');return {exists:!!root,connected:!!root?.isConnected,title:document.title,sections:[...(root?.querySelectorAll('h3,h4')??[])].map(e=>e.textContent),buttons:[...(root?.querySelectorAll('button')??[])].map(e=>e.textContent),fileBoundary:root?.textContent?.includes('PDF/EPUB'),restoreModes:[...(root?.querySelectorAll('.rd-backup-panel select')??[])].map(e=>({label:e.getAttribute('aria-label'),value:e.value}))};})()` });
		if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
		const shot = await send('Page.captureScreenshot', { format: 'png' });
		fs.writeFileSync(path.join(output, 'data-panel.png'), Buffer.from(shot.data, 'base64'));
		return evaluated.result.value;
	} finally { socket.close(); }
}
