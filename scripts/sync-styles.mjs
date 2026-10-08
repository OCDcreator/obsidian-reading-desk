import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Concatenation order is load-bearing: later files override earlier ones at
// equal specificity, so this list must preserve the original single-file
// cascade. Settings intentionally sits before the responsive and late blocks.
const ORDER = [
	'base.css',
	'reader.css',
	'target-panel.css',
	'highlight-drawer.css',
	'comment-popover.css',
	'crop-overlay.css',
	'shelf.css',
	'settings.css',
	'reader-responsive.css',
	'pdf-links.css',
	'reader-extras.css',
	'shelf-controls.css',
	'action-menu.css'
];

const sourceDir = fileURLToPath(new URL('../assets/styles/', import.meta.url));
const outputUrl = new URL('../styles.css', import.meta.url);

function assertComplete(present) {
	const orphans = present.filter(name => !ORDER.includes(name));
	if (orphans.length > 0) {
		throw new Error(`Styles partials not listed in ORDER: ${orphans.join(', ')}`);
	}
	const missing = ORDER.filter(name => !present.includes(name));
	if (missing.length > 0) {
		throw new Error(`Styles partials missing from assets/styles/: ${missing.join(', ')}`);
	}
}

/** Concatenated stylesheet text; pure read, safe for gates and builds. */
export function readStylesheet() {
	assertComplete(fs.readdirSync(sourceDir).filter(name => name.endsWith('.css')));
	return ORDER.map(name => fs.readFileSync(sourceDir + name, 'utf8')).join('\n');
}

export function writeStylesheet() {
	fs.writeFileSync(outputUrl, readStylesheet());
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) writeStylesheet();
