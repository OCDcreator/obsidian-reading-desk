import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Optional bridge to the native computer-use controller for macOS menus.
 * It never generates OS input itself. Each request needs native UI action plus
 * an id-matched acknowledgement; controls.select independently reads the value.
 */
export function nativeSelectBridge({ directory, evaluate, endpoint, target, expectedVault }) {
	fs.mkdirSync(directory, { recursive: true });
	const pending = path.join(directory, 'pending.json');
	return async control => {
		const targets = (await (await fetch(endpoint + '/json/list')).json()).filter(tab => tab.type === 'page' && tab.url === 'app://obsidian.md/index.html' && tab.title.includes('testvault'));
		if (targets.length !== 1 || targets[0].id !== target.id || await evaluate('app.vault.adapter.getBasePath()') !== expectedVault) throw new Error('Native select target changed');
		const id = randomUUID(), response = path.join(directory, id + '-response.json');
		const request = { id, checkedAt: new Date().toISOString(), targetId: target.id, vaultPath: expectedVault, title: targets[0].title,
			...control, response, actionRequired: 'Use CUA against this exact Test Vault window and labelled product select. Do not set DOM values.' };
		fs.writeFileSync(pending, JSON.stringify(request, null, 2), { flag: 'wx' });
		fs.writeFileSync(path.join(directory, id + '-request.json'), JSON.stringify(request, null, 2), { flag: 'wx' });
		console.log(JSON.stringify({ nativeSelectPending: pending, id, label: control.label, value: control.value }));
		const end = Date.now() + 120000;
		while (!fs.existsSync(response) && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 100));
		if (!fs.existsSync(response)) throw new Error('Native menu input pending; inspect ' + pending);
		const acknowledgement = JSON.parse(fs.readFileSync(response, 'utf8'));
		if (acknowledgement.id !== id || acknowledgement.actionSource !== 'CUA native menu input' || acknowledgement.value !== control.value) throw new Error('Native menu acknowledgement mismatch');
		if (JSON.parse(fs.readFileSync(pending, 'utf8')).id !== id) throw new Error('Native menu request identity changed');
		fs.unlinkSync(pending);
	};
}
