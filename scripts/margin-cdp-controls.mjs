import fs from 'node:fs';
import path from 'node:path';

export const remote = (evaluate, fn, ...args) => evaluate('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
export async function poll(read, message, timeout = 12000) {
	const end = Date.now() + timeout;
	while (Date.now() < end) { const value = await read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 40)); }
	throw new Error(message);
}
export async function shot(send, output, name) {
	const image = await send('Page.captureScreenshot', { format: 'png' });
	fs.writeFileSync(path.join(output, name), Buffer.from(image.data, 'base64'));
}
function inspectControl(root, label, action) {
	const base = eval(root);
	if (!base?.isConnected) throw new Error('QA surface disappeared');
	const nodes = [...base.querySelectorAll('[aria-label]')].filter(node => node.getAttribute('aria-label') === label);
	if (nodes.length !== 1) throw new Error('Expected one control: ' + label + '; found ' + nodes.length);
	const node = nodes[0];
	if (action === 'point') {
		if (node.disabled || node.closest('[hidden]')) throw new Error('Disabled/hidden control: ' + label);
		node.scrollIntoView({ block: 'center', inline: 'nearest' });
		const rect = node.getBoundingClientRect();
		if (!rect.width || !rect.height) throw new Error('Invisible control: ' + label);
		return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	}
	return { focused: document.activeElement === node, disabled: !!node.disabled, hidden: !!node.closest('[hidden]'), value: node.value, start: node.selectionStart, end: node.selectionEnd,
		type: node.type, checked: node.checked, options: node.options ? [...node.options].map(option => option.value) : null,
		optionLabels: node.options ? [...node.options].map(option => option.textContent) : null };
}
/** Uses CDP keyboard/mouse events. Never assigns input.value or invokes DOM selection APIs. */
export function controls({ evaluate, send }, root) {
	const read = label => remote(evaluate, inspectControl, root, label, 'read');
	const key = async (name, code, virtualKey, extra = {}) => {
		await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: virtualKey, ...extra });
		await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: virtualKey, modifiers: extra.modifiers ?? 0 });
	};
	return {
		read,
		async click(label) {
			const point = await remote(evaluate, inspectControl, root, label, 'point');
			for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
		},
		async type(label, value) {
			await this.click(label);
			const before = await read(label);
			if (!before.focused || typeof before.value !== 'string') throw new Error('Input focus mismatch: ' + label);
			const mac = await evaluate('/Mac/.test(navigator.platform)');
			if (before.value.length) {
				await key('a', 'KeyA', 65, { modifiers: mac ? 4 : 2, commands: ['selectAll'] });
				const selection = await read(label);
				if (!selection.focused || selection.value !== before.value ||
					(selection.start !== null && (selection.start !== 0 || selection.end !== before.value.length))) throw new Error('Select-all failed: ' + label + '; ' + JSON.stringify(selection));
				await key('Backspace', 'Backspace', 8);
				const cleared = await read(label);
				if (!cleared.focused || cleared.value !== '') throw new Error('Input was not cleared: ' + label + '; ' + JSON.stringify(cleared));
			}
			await send('Input.insertText', { text: value });
			const after = await read(label);
			if (!after.focused || after.value !== value) throw new Error('Exact input replacement failed: ' + label + '; ' + JSON.stringify(after));
			return { before: before.value, cleared: true, after: after.value, platform: mac ? 'Mac' : 'other' };
		},
		async select(label, value) {
			let control = await read(label), index = control.options?.indexOf(value);
			if (index === undefined || index < 0) throw new Error('Select value unavailable: ' + label);
			if (send.nativeSelect && control.value !== value) {
				await send.nativeSelect({ root, label, value, before: control.value, options: control.options, optionLabels: control.optionLabels });
				control = await read(label);
				if (control.value !== value) throw new Error('Native select readback mismatch: ' + label + '; ' + JSON.stringify(control));
				return { value, actionSource: 'Native CUA menu click/keys with authoritative CDP value readback' };
			}
			if (control.value !== value && await evaluate('/Mac/.test(navigator.platform)')) throw new Error('macOS select needs native menu input; run with RD_NATIVE_SELECT_QUEUE and CUA controller: ' + label);
			const transitions = [];
			// Escape closes the native popup without selecting. Arrow keys then move from the
			// actual selected index, one event at a time; product redraws may replace the node.
			for (let step = 0; control.value !== value && step < control.options.length; step++) {
				await poll(async () => !(await read(label)).disabled, 'Select stayed busy: ' + label);
				await this.click(label); await key('Escape', 'Escape', 27);
				control = await read(label);
				if (!control.focused) throw new Error('Select focus mismatch: ' + label);
				const current = control.options.indexOf(control.value), down = current < index;
				await key(down ? 'ArrowDown' : 'ArrowUp', down ? 'ArrowDown' : 'ArrowUp', down ? 40 : 38);
				await key('Enter', 'Enter', 13);
				const next = await read(label); transitions.push({ before: control.value, after: next.value });
				if (next.value === control.value) throw new Error('Select keyboard made no transition: ' + label + '; ' + JSON.stringify(transitions));
				control = next;
			}
			if (control.value !== value) throw new Error('Select value mismatch: ' + label + '; ' + JSON.stringify(transitions));
			return { value: control.value, transitions };
		},
		async tab() { await key('Tab', 'Tab', 9); },
		async enter() { await key('Enter', 'Enter', 13); },
		async file(label, filename) {
			// CDP attaches a file to the real product file-input; OS dialog interaction is outside this check.
			const find = (root, label) => {
				const base = eval(root);
				if (!base?.isConnected) throw new Error('QA surface disappeared');
				const matches = [...base.querySelectorAll('input[type=file]')].filter(node => node.getAttribute('aria-label') === label);
				if (matches.length !== 1 || matches[0].disabled) throw new Error('File input missing/disabled');
				return matches[0];
			};
			const expression = '(' + find.toString() + ')(' + JSON.stringify(root) + ',' + JSON.stringify(label) + ')';
			const result = await send('Runtime.evaluate', { expression, returnByValue: false });
			if (result.exceptionDetails || !result.result?.objectId) throw new Error('File input lookup failed');
			try { await send('DOM.setFileInputFiles', { objectId: result.result.objectId, files: [path.resolve(filename)] }); }
			finally { await send('Runtime.releaseObject', { objectId: result.result.objectId }); }
		}
	};
}
