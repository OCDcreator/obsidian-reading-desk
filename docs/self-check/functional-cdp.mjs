import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const tabs = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const tab = tabs.find(item => item.type === 'page' && item.url === 'app://obsidian.md/index.html' && item.title.includes('testvault'));
if (!tab) throw new Error('Test Vault CDP target not found');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0; const pending = new Map();
socket.addEventListener('message', event => { const value = JSON.parse(event.data); const task = pending.get(value.id); if (task) { pending.delete(value.id); value.error ? task.reject(value.error) : task.resolve(value.result); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
const code = fs.readFileSync(0, 'utf8');
const command = process.argv[2] ?? 'eval';
let result;
try {
	if (command === 'eval') {
		result = await send('Runtime.evaluate', { expression: code, returnByValue: true, awaitPromise: true, userGesture: true });
		if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
		result = result.result.value ?? result.result.description;
	} else if (command === 'commands') {
		result = [];
		for (const entry of JSON.parse(code)) { if (entry.delayMs) await new Promise(resolve => setTimeout(resolve, Math.min(entry.delayMs, 1000))); else result.push(await send(entry.method, entry.params)); }
	} else if (command === 'screenshot') {
		const target = path.join(directory, process.argv[3]);
		if (!path.basename(target).startsWith('functional-')) throw new Error('Screenshot must use functional-* basename');
		const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(target, Buffer.from(shot.data, 'base64')); result = { screenshot: target };
	}
	const output = { timestamp: new Date().toISOString(), command, target: tab.id, result };
	if (process.argv[3] && command !== 'screenshot') {
		const name = path.basename(process.argv[3]); if (!name.startsWith('functional-')) throw new Error('Output must use functional-* basename');
		fs.writeFileSync(path.join(directory, name), JSON.stringify(output, null, 2) + '\n');
	}
	console.log(JSON.stringify(output, null, 2));
} finally { socket.close(); }
