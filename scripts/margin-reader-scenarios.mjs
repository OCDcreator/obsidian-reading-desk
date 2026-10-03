import fs from 'node:fs';
import path from 'node:path';
import { withFunctionalFixture } from './enhancement-functional-scenarios.mjs';
import { controls } from './margin-cdp-controls.mjs';
const PAGE_COUNT = 350;
const remote = (evaluate, fn, ...args) => evaluate('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
/** Real PDF: Roman introduction, Arabic body, repeated label for disambiguation. */
export function buildReaderFixturePdf(runId) {
	const objects = ['<< /Type /Catalog /Pages 2 0 R /PageLabels << /Nums [0 << /S /r >> 2 << /S /D >> 348 << /P (dup) >>] >> >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
	const pages = [];
	for (let index = 0; index < PAGE_COUNT; index += 1) {
		const id = objects.length + 1; pages.push(id + ' 0 R');
		const width = index % 9 === 0 ? 500 : 600, height = index % 7 === 0 ? 900 : 800;
		const content = `0.97 0.97 0.94 rg 0 0 ${width} ${height} re f 0 0 0 rg BT /F1 18 Tf 36 ${height - 50} Td (Margin reader fixture ${index + 1}) Tj 0 -40 Td (Run ${runId}) Tj ET\n`;
		objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`, `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}endstream`);
	}
	objects[1] = `<< /Type /Pages /Kids [${pages.join(' ')}] /Count ${PAGE_COUNT} >>`;
	let pdf = '%PDF-1.7\n'; const offsets = [0];
	for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
	const xref = Buffer.byteLength(pdf, 'ascii');
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(pdf, 'ascii');
}
async function readerScenarioRemote(key) {
	const state = globalThis[key], view = state.view(); const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
	const assert = (test, message) => { if (!test) throw new Error(message); };
	const ready = async (check, message) => { const until = Date.now() + 10000; while (!check()) { if (Date.now() > until) throw new Error(message); await pause(25); } };
	const previousNavMode = window.localStorage.getItem('reading-desk-nav-mode');
	state.readerStep = 'labels'; const labels = await view.pdf.pageLabels();
	assert(labels.length === 350 && labels[0] === 'i' && labels[2] === '1' && labels[348] === labels[349], 'Fixture printed page labels mismatch');
	assert(view.labels.resolve('1', 350).page === 3 && view.labels.resolve('#1', 350).page === 1 && view.labels.resolve('dup', 350).message, 'Printed label resolution or ambiguity failed');
	// Exercise the real navigation owner in an isolated sidebar-sized surface.
	const shell = document.createElement('div'); shell.className = 'reading-desk-shell'; const navigation = document.createElement('div'); shell.append(navigation);
	Object.assign(shell.style, { position: 'fixed', right: '0', top: '50px', width: '220px', height: '650px', zIndex: '1000' });
	document.body.append(shell);
	try {
		view.attachNavigation(navigation);
		Array.from(navigation.querySelectorAll('[role=tab]')).find(tab => tab.textContent === '缩略图').click();
		const panel = navigation.querySelector('.rd-reader-navigation__panel'); panel.style.height = '580px'; panel.style.overflow = 'auto';
		const stats = () => { let pixels = 0, thumbnails = 0; for (const [canvas, allocation] of view.pdf.canvasBudget.canvases) { const size = canvas.width * canvas.height + allocation.reservedPixels; pixels += size; if (allocation.thumbnail) thumbnails += size; } return { pixels, thumbnails, errors: navigation.querySelectorAll('[data-render-error]').length }; };
		let peak = 0;
		for (let page = 1; page <= 350; page += 2) {
			state.readerStep = 'thumbnail-' + page; const item = navigation.querySelector(`[data-nav-page="${page - 1}"]`); if (!item) throw new Error('Missing thumbnail ' + page + '; active tab=' + navigation.querySelector('[aria-selected=true]')?.textContent); item.scrollIntoView({ block: 'start' }); await ready(() => item.querySelector('canvas')?.dataset.rendered === '1', 'Visible thumbnail did not render');
			const sample = stats(); peak = Math.max(peak, sample.pixels); assert(sample.pixels <= 24000000 && sample.thumbnails <= 3000000, 'Canvas budget exceeded during sidebar traversal');
		}
		navigation.querySelector('[data-nav-page="0"]').scrollIntoView({ block: 'start' }); await ready(() => navigation.querySelector('canvas[data-page="1"]')?.dataset.rendered === '1', 'Top thumbnail did not rerender');
		assert(navigation.querySelector('canvas[data-page="1"]').width > 0, 'Returning to top did not redraw its thumbnail');
		state.readerStep = 'main-after-thumbnails'; await view.goTo(320, { jump: true, smooth: false }); assert(view.surface.hostForPage(320).querySelector('canvas').width > 0, 'Main page unavailable after thumbnail traversal');
		await view.display.rotate(90); await view.applyScale(1.5); await view.goTo(120, { smooth: false });
		view.surface.stage.scrollTop += 180; view.surface.stage.dispatchEvent(new Event('scroll')); await pause(80);
		state.readerStep = 'bookmark-internal'; await view.persistence.addBookmark('Fixture evidence'); const bookmark = view.persistence.bookmarks().find(item => item.name === 'Fixture evidence');
		assert(bookmark && bookmark.position.rotation === 90 && bookmark.position.scale === 1.5, 'Named bookmark did not freeze display state');
		await view.persistence.renameBookmark(bookmark.id, 'Fixture renamed'); await view.persistence.flush();
		const bookId = state.plugin.library.getByPath(state.fixture.pdf).id; const expected = state.plugin.library.readReaderState(state.fixture.pdf).position;
		assert(expected && expected.rotation === 90, 'Position was not saved');
		state.readerStep = 'reopen'; await view.openPdf(state.fixture.pdf); const reopened = view.positions.capture();
		assert(view.pdf.getRotation() === expected.rotation && Math.abs(view.pdf.getScale() - expected.scale) < 0.01 && reopened.page === expected.page + 1 && Math.abs(reopened.y - expected.y) < 0.03, 'Reopen did not restore exact position');
		await view.openPdf(state.fixture.pdf, 3); assert(view.page === 3, 'Explicit page did not override saved position');
		await view.persistence.jumpBookmark(bookmark.id); assert(view.page === bookmark.position.page + 1, 'Bookmark jump did not restore physical page');
		await view.persistence.removeBookmark(bookmark.id); assert(!view.persistence.bookmarks().some(item => item.id === bookmark.id), 'Bookmark removal failed');
		await view.persistence.flush(); await state.flush(); const disk = await state.plugin.loadData();
		assert(!disk.books[bookId].bookmarks.some(item => item.id === bookmark.id), 'Deleted bookmark remains on disk');
		return { labels: { first: labels[0], body: labels[2], duplicate: labels[348] }, traversedPages: 350, peakPixels: peak, finalBudget: stats(), expected, reopened, bookmark: { id: bookmark.id, removed: true } };
	} finally { view.detachNavigation(navigation); shell.remove(); if (previousNavMode === null) window.localStorage.removeItem('reading-desk-nav-mode'); else window.localStorage.setItem('reading-desk-nav-mode', previousNavMode); }
}
async function bookmarkUiRemote(key, operation, value) {
	const state = globalThis[key], view = state.view();
	if (operation === 'mount') {
		const shell = document.createElement('div'); shell.className = 'reading-desk-shell'; const navigation = document.createElement('div'); shell.append(navigation);
		Object.assign(shell.style, { position: 'fixed', right: '16px', top: '50px', width: '300px', maxHeight: Math.max(200, innerHeight - 80) + 'px', overflow: 'auto', zIndex: '1000', background: 'var(--background-primary)' });
		document.body.append(shell); state.bookmarkUi = { shell, navigation, previousMode: localStorage.getItem('reading-desk-nav-mode') };
		view.attachNavigation(navigation);
	}
	const ui = state.bookmarkUi;
	if (operation === 'close') { if (ui) { view.detachNavigation(ui.navigation); ui.shell.remove(); if (ui.previousMode === null) localStorage.removeItem('reading-desk-nav-mode'); else localStorage.setItem('reading-desk-nav-mode', ui.previousMode); delete state.bookmarkUi; } return { closed: true }; }
	if (operation === 'read') return { bookmarks: view.persistence.bookmarks(), status: ui.navigation.querySelector('[role=status]')?.textContent, disk: (await state.plugin.loadData()).books[state.plugin.library.getByPath(state.fixture.pdf).id].bookmarks ?? [] };
	const query = operation === 'point' ? value : '书签';
	const node = query === 'new-input' ? ui.navigation.querySelector('input[aria-label="新书签名称"]')
		: query === 'rename-input' ? ui.navigation.querySelector('input[aria-label^="重命名书签"]')
			: Array.from(ui.navigation.querySelectorAll('button')).find(button => button.textContent === query);
	if (!node) throw new Error('Bookmark UI control missing: ' + query);
	node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect();
	if (!box.width || !box.height) throw new Error('Bookmark UI control not visible: ' + query);
	return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}
async function runBookmarkInputScenario({ evaluate, send, key, output }) {
	const click = async value => { const point = await remote(evaluate, bookmarkUiRemote, key, 'point', value); for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 }); };
	const wait = async check => { const until = Date.now() + 10000; let sample; do { sample = await remote(evaluate, bookmarkUiRemote, key, 'read'); if (check(sample)) return sample; await new Promise(resolve => setTimeout(resolve, 50)); } while (Date.now() < until); throw new Error('Bookmark UI readback timed out: ' + JSON.stringify(sample)); };
	try {
		await remote(evaluate, bookmarkUiRemote, key, 'mount'); await click('书签');
		const ui = controls({ evaluate, send }, 'globalThis[' + JSON.stringify(key) + '].bookmarkUi.navigation');
		const creationInput = await ui.type('新书签名称', 'Pointer bookmark'); await click('添加书签');
		const added = await wait(sample => sample.bookmarks.some(item => item.name === 'Pointer bookmark') && sample.disk.some(item => item.name === 'Pointer bookmark'));
		const replacementInput = await ui.type('重命名书签 Pointer bookmark', 'Pointer renamed'); await click('保存名称');
		const renamed = await wait(sample => sample.bookmarks.some(item => item.name === 'Pointer renamed') && sample.disk.some(item => item.name === 'Pointer renamed'));
		const screenshot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'margin-bookmark-input.png'), Buffer.from(screenshot.data, 'base64'));
		const jumpLayout = await remote(evaluate, key => {
			const root = globalThis[key].bookmarkUi.navigation;
			const button = [...root.querySelectorAll('.rd-reader-bookmark-entry button')].find(node => node.title.startsWith('Pointer renamed'));
			if (!button) throw new Error('Renamed jump control missing');
			const bounds = button.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(button);
			const text = [...range.getClientRects()].filter(rect => rect.width && rect.height);
			return { width: bounds.width, height: bounds.height, computedHeight: getComputedStyle(button).height,
				textHeight: Math.max(...text.map(rect => rect.bottom)) - Math.min(...text.map(rect => rect.top)), lines: text.length,
				contained: text.every(rect => rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1 && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1) };
		}, key);
		if (!jumpLayout.contained) throw new Error('Bookmark jump label overflows its button: ' + JSON.stringify(jumpLayout));
		await click('删除书签'); const removed = await wait(sample => !sample.bookmarks.length && !sample.disk.length);
		return { input: 'CDP mouse/key/insertText; platform selectAll, selection readback, Backspace and exact input readback; product navigation in fixture DOM surface', creationInput, replacementInput,
			added: added.bookmarks.length, renamed: renamed.bookmarks[0].name, removed: removed.bookmarks.length, jumpLayout,
			diskReadbacks: { created: added.disk.map(item => item.name), renamed: renamed.disk.map(item => item.name), deleted: removed.disk.length }, diskVerified: true };
	} finally { await remote(evaluate, bookmarkUiRemote, key, 'close'); }
}
/** Called by the existing CDP harness; import alone performs no vault writes. */
export async function runReaderScenarios({ evaluate, send, output }) {
	return withFunctionalFixture({ evaluate, send, output, buildPdf: buildReaderFixturePdf, pageCount: PAGE_COUNT,
		scenario: async ({ key, result }) => {
			try {
			result.samples.reader = await remote(evaluate, readerScenarioRemote, key);
			result.samples.bookmarkInput = await runBookmarkInputScenario({ evaluate, send, key, output });
			result.artifacts.push('margin-bookmark-input.png');
			const image = await send('Page.captureScreenshot', { format: 'png' });
			fs.writeFileSync(path.join(output, 'margin-reader.png'), Buffer.from(image.data, 'base64')); result.artifacts.push('margin-reader.png');
			} catch (error) {
				result.samples.failureState = await remote(evaluate, key => { const state = globalThis[key]; const view = state?.view(); return { step: state?.readerStep, page: view?.page, position: view?.positions.capture(), saved: view ? state.plugin.library.readReaderState(state.fixture.pdf).position : null }; }, key);
				const image = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'margin-reader-failure.png'), Buffer.from(image.data, 'base64')); result.artifacts.push('margin-reader-failure.png'); throw error;
			}
		} });
}
