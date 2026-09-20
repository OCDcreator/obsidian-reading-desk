import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const matches = targets.filter(target => target.type === 'page' && target.url === 'app://obsidian.md/index.html' && target.title.includes('testvault'));
if (matches.length !== 1) throw new Error(`Expected one testvault CDP target, found ${matches.length}`);
const target = matches[0];
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
	socket.addEventListener('open', resolveOpen, { once: true });
	socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
	const message = JSON.parse(event.data);
	const task = pending.get(message.id);
	if (!task) return;
	pending.delete(message.id);
	message.error ? task.reject(message.error) : task.resolve(message.result);
});
function send(method, params = {}) {
	return new Promise((resolveSend, reject) => {
		const id = ++nextId;
		pending.set(id, { resolve: resolveSend, reject });
		socket.send(JSON.stringify({ id, method, params }));
	});
}
async function evaluate(expression) {
	const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
	if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails));
	return result.result.value ?? result.result.description;
}

function measure() {
	const visible = element => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
	};
	const metrics = element => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			tag: element.tagName, className: typeof element.className === 'string' ? element.className : '',
			text: element.textContent?.trim().slice(0, 110), aria: element.getAttribute('aria-label'),
			rect: rect.toJSON(), padding: style.padding, gap: style.gap, margin: style.margin,
			fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color,
			background: style.backgroundColor, outline: style.outline, outlineOffset: style.outlineOffset,
			overflowX: style.overflowX, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
			clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
			focusVisible: element.matches(':focus-visible'), disabled: 'disabled' in element ? element.disabled : null,
			inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
		};
	};
	const selectors = [
		'.rd-reader', '.rd-reader-toolbar', '.rd-reader-body', '.rd-pdf-page-host', '.rd-target-panel',
		'.rd-highlight-drawer:not(.is-hidden)', '.rd-highlight-list__scope', '.rd-highlight-list__scope-buttons',
		'.rd-highlight-list__count', '.rd-highlight-list__page-empty', '.rd-highlight-row',
		'.rd-highlight-row__jump', '.rd-highlight-row__copy', '.rd-highlight.is-previewed',
		'.rd-highlight-row.is-previewed', '.rd-reader-toolbar button', '.rd-highlight-list__scope button',
		'.rd-empty', '.rd-error'
	];
	const samples = {};
	for (const selector of selectors) {
		const items = [...document.querySelectorAll(selector)].filter(visible);
		if (items.length) samples[selector] = { count: items.length, items: items.slice(0, 4).map(metrics) };
	}
	const reader = document.querySelector('.rd-reader');
	const leaf = reader?.closest('.workspace-leaf');
	const toolbar = document.querySelector('.rd-reader-toolbar');
	const toolbarButtons = [...(toolbar?.querySelectorAll('button') ?? [])].filter(visible);
	const buttonTops = [...new Set(toolbarButtons.map(button => Math.round(button.getBoundingClientRect().top)))];
	const overflow = reader ? [reader, ...reader.querySelectorAll('*')].filter(element => visible(element) && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2).slice(0, 20).map(metrics) : [];
	const plugin = app.plugins.plugins['obsidian-reading-desk'];
	return {
		capturedAt: new Date().toISOString(), targetTitle: document.title,
		viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
		theme: document.body.classList.contains('theme-dark') ? 'dark' : 'light',
		themeConfig: app.vault.getConfig('theme'),
		readerState: app.workspace.getLeavesOfType('reading-desk-reader')[0]?.view.getState(),
		readerLeaf: leaf ? metrics(leaf) : null, toolbarRows: buttonTops.length,
		drawerOpen: !!document.querySelector('.rd-highlight-drawer:not(.is-hidden)'),
		pluginLoaded: !!plugin, enabled: app.plugins.enabledPlugins.has('obsidian-reading-desk'),
		samples, overflow
	};
}

try {
	const [verb, arg, extra] = process.argv.slice(2);
	if (verb === 'eval') {
		const expression = extra ? readFileSync(resolve(arg), 'utf8') : arg;
		console.log(JSON.stringify(await evaluate(expression), null, 2));
	} else if (verb === 'viewport') {
		const [width, height] = arg.split('x').map(Number);
		await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
		console.log(JSON.stringify({ width, height, targetId: target.id }));
	} else if (verb === 'restore-viewport') {
		await send('Emulation.clearDeviceMetricsOverride');
		console.log(JSON.stringify({ restored: true, targetId: target.id }));
	} else if (verb === 'capture') {
		const result = await evaluate(`(${measure.toString()})()`);
		if (!result.pluginLoaded || !result.enabled || !result.samples['.rd-reader']) throw new Error('Reading Desk Reader surface is not mounted');
		const screenshot = resolve('docs/self-check', `visual-pdf-plus-after-${arg}.png`);
		const image = await send('Page.captureScreenshot', { format: 'png' });
		writeFileSync(screenshot, Buffer.from(image.data, 'base64'));
		const outputPath = resolve('docs/self-check/pdf-plus-integration-measurements.json');
		const output = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : { kind: 'real-obsidian-electron-cdp', targetId: target.id, captures: [] };
		output.captures.push({ id: arg, screenshot, ...result });
		writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
		console.log(JSON.stringify({ id: arg, screenshot, theme: result.theme, viewport: result.viewport, leafWidth: result.readerLeaf?.rect.width, toolbarRows: result.toolbarRows, samples: Object.keys(result.samples).length, overflowCount: result.overflow.length }));
	} else {
		throw new Error('Usage: eval <expression> | eval <file> file | viewport <width>x<height> | restore-viewport | capture <id>');
	}
} finally {
	socket.close();
}
