import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const PLUGIN_ID = 'obsidian-reading-desk';
const READER_TYPE = 'reading-desk-reader';
const PHRASE = 'cross span phrase';
const EXTERNAL_URL = 'https://example.com/reading-desk-functional-fixture';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorText = error => error instanceof Error ? error.stack ?? error.message : String(error);
function assert(condition, message) { if (!condition) throw new Error(message); }
function remote(evaluate, fn, ...args) { return evaluate('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')'); }

/** Classic PDF with byte-accurate xref; two fonts force separate text items. */
export function buildFixturePdf(runId) {
	const text = (font, size, x, y, value) => 'BT /' + font + ' ' + size + ' Tf 1 0 0 1 ' + x + ' ' + y + ' Tm (' + value + ') Tj ET';
	const first = ['1 .9 .85 rg 0 0 400 300 re f', '0 0 0 rg'];
	for (const y of [270, 240, 210, 180]) {
		first.push(text('F1', 16, 30, y, 'cross '), text('F2', 16, 78, y, 'span phrase'));
	}
	first.push(text('F1', 14, 30, 135, 'Internal link: page two'), text('F1', 14, 30, 90, 'External HTTPS link - do not open'));
	const second = ['0 .25 .9 rg 0 0 300 400 re f', '0 .75 .2 rg 300 0 300 400 re f', '0 0 0 rg', text('F1', 16, 30, 375, 'Second page: blue left, green right')];
	const stream = lines => { const body = lines.join('\n') + '\n'; return '<< /Length ' + Buffer.byteLength(body, 'ascii') + ' >>\nstream\n' + body + 'endstream'; };
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 4 0 R /Annots [9 0 R 10 0 R] >>',
		stream(first),
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 6 0 R >>',
		stream(second),
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
		'<< /Type /Annot /Subtype /Link /Rect [28 130 220 151] /Border [0 0 0] /A << /S /GoTo /D [5 0 R /XYZ 0 400 null] >> >>',
		'<< /Type /Annot /Subtype /Link /Rect [28 85 285 106] /Border [0 0 0] /A << /S /URI /URI (' + EXTERNAL_URL + ') >> >>',
		'<< /Title (Reading Desk functional ' + runId + ') /Author (Temporary functional fixture) >>'
	];
	let document = '%PDF-1.4\n'; const offsets = [0];
	objects.forEach((object, index) => { offsets.push(Buffer.byteLength(document, 'ascii')); document += (index + 1) + ' 0 obj\n' + object + '\nendobj\n'; });
	const xref = Buffer.byteLength(document, 'ascii');
	document += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
	for (const offset of offsets.slice(1)) document += String(offset).padStart(10, '0') + ' 00000 n \n';
	document += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R /Info 11 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
	return Buffer.from(document, 'ascii');
}

/** All renderer state is under a unique key; no global data snapshot is restored. */
async function initializeRemote(key, fixture, pdfBase64, digest, pluginId, readerType) {
	if (globalThis[key]) throw new Error('Functional run key already exists');
	const plugin = app.plugins.plugins[pluginId];
	if (!plugin?.repository || !plugin.library || !plugin.vaultChanges || !plugin.progressFlusher) throw new Error('Reading Desk functional APIs unavailable');
	if (plugin.repository.status().phase !== 'ready' || plugin.repository.status().pending) throw new Error('Repository must be ready with no unsaved snapshot');
	if (plugin.progressFlusher.pending || plugin.vaultChanges.paths.size) throw new Error('Existing progress/vault events are pending; let them settle before running');
	if (app.vault.getAbstractFileByPath(fixture.folder) || await app.vault.adapter.exists(fixture.folder)) throw new Error('Fixture folder already exists');
	const directory = plugin.library.extractor?.coverDirectory;
	if (typeof directory !== 'string') throw new Error('Cannot prove the extractor cover path before creating a fixture');
	const expectedCover = directory.replace(/\/$/, '') + '/' + digest + '.png';
	if (expectedCover.startsWith('/') || expectedCover.includes(':') || expectedCover.split('/').includes('..')) throw new Error('Cover path is not a safe vault-relative path');
	const originalFiles = new Set(app.vault.getFiles().map(file => file.path));
	if (originalFiles.has(expectedCover) || await app.vault.adapter.exists(expectedCover)) throw new Error('Expected fixture cover already exists; refusing to overwrite it');
	const originalLeaves = new Set(); app.workspace.iterateAllLeaves(leaf => originalLeaves.add(leaf.id));
	const state = {
		fixture, plugin, readerType, pdfBase64, expectedCover, originalFiles, originalLeaves,
		originalActive: app.workspace.activeLeaf?.id ?? null, leaf: null, folderCreated: false,
		files: new Set(), covers: new Set(), records: Object.fromEntries(['books', 'highlights', 'comments', 'commentParents', 'cards', 'deleted', 'pending'].map(name => [name, new Set()]))
	};
	state.findLeaf = id => { let found; app.workspace.iterateAllLeaves(leaf => { if (leaf.id === id) found = leaf; }); return found; };
	state.check = () => { if (app.plugins.plugins[pluginId] !== plugin) throw new Error('Reading Desk reloaded during functional run'); };
	state.view = () => {
		state.check(); const view = state.leaf?.view;
		if (view?.getViewType() !== readerType || view.getState().pdfPath !== fixture.pdf) throw new Error('Fixture reader leaf changed or closed');
		return view;
	};
	state.belongs = highlight => highlight?.pdfPath === fixture.pdf && (!highlight.target || highlight.target.path === fixture.target);
	state.collect = async () => {
		state.check(); const repo = plugin.repository, records = state.records;
		for (const [id, book] of Object.entries(repo.readBooks())) if (book.path === fixture.pdf) {
			records.books.add(id);
			if (book.coverPath && book.coverPath !== expectedCover) throw new Error('Unexpected fixture cover path: ' + book.coverPath);
		}
		for (const [id, highlight] of Object.entries(repo.readHighlights())) if (highlight.pdfPath === fixture.pdf) {
			if (!state.belongs(highlight)) throw new Error('Fixture highlight references a nonfixture target; preserving data');
			records.highlights.add(id);
		}
		for (const [id, deleted] of Object.entries(repo.readDeletedAnnotations())) if (deleted.highlight?.pdfPath === fixture.pdf) {
			if (!state.belongs(deleted.highlight)) throw new Error('Deleted fixture annotation references a nonfixture target');
			records.deleted.add(id); records.highlights.add(id);
			for (const comment of deleted.comments ?? []) records.comments.add(comment.id);
		}
		for (const [id, pending] of Object.entries(repo.readPendingTargetWrites())) if (pending.pdfPath === fixture.pdf) {
			if (!state.belongs(pending)) throw new Error('Fixture pending write references a nonfixture target');
			records.pending.add(id); records.highlights.add(id);
		}
		for (const id of records.highlights) {
			if (repo.readComments()[id]) { records.commentParents.add(id); for (const comment of repo.readComments()[id]) { if (comment.highlightId !== id) throw new Error('Comment ownership mismatch'); records.comments.add(comment.id); } }
			if (repo.readExcerptCards()[id]) records.cards.add(id);
		}
		if (!originalFiles.has(expectedCover) && await app.vault.adapter.exists(expectedCover)) state.covers.add(expectedCover);
		return state.ledger();
	};
	state.ledger = () => ({ folder: fixture.folder, leafId: state.leaf?.id ?? null, folderCreated: state.folderCreated,
		files: [...state.files], covers: [...state.covers], expectedCover, records: Object.fromEntries(Object.entries(state.records).map(([name, ids]) => [name, [...ids]])) });
	state.flush = async () => {
		state.check(); const allowed = value => value === fixture.pdf || state.files.has(value) || state.covers.has(value);
		const pending = plugin.progressFlusher.pending;
		if (pending && !allowed(pending.path)) throw new Error('Nonfixture progress pending; refusing to flush another reader');
		if ([...plugin.vaultChanges.paths].some(value => !allowed(value))) throw new Error('Nonfixture vault event pending; refusing to flush unrelated changes');
		await plugin.progressFlusher.flush(); await plugin.vaultChanges.flush();
	};
	globalThis[key] = state;
	return { version: plugin.manifest.version, originalActive: state.originalActive, expectedCover, coverWasAbsent: true };
}

async function createFixtureRemote(key) {
	const state = globalThis[key]; state.check(); const { fixture, plugin } = state;
	await app.vault.createFolder(fixture.folder); state.folderCreated = true;
	const note = '# Temporary Reading Desk functional fixture\n\nRun: ' + fixture.runId + '\n\nThis folder belongs to the CDP functional test. Do not edit it while the test runs.\nIf cleanup fails, retain this note and functional-scenarios.json for manual review.\n';
	state.files.add(fixture.note); await app.vault.create(fixture.note, note);
	state.files.add(fixture.target); await app.vault.create(fixture.target, '# Fixture excerpt target\n\nRun: ' + fixture.runId + '\n');
	const raw = atob(state.pdfBase64), bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
	state.files.add(fixture.pdf); const file = await app.vault.createBinary(fixture.pdf, bytes.buffer);
	try { await plugin.library.scanFiles([{ path: file.path, extension: file.extension, stat: { mtime: file.stat.mtime, size: file.stat.size } }], []); }
	finally { await state.collect(); }
	await state.flush();
	const book = plugin.library.getByPath(fixture.pdf);
	if (!book || book.missing || book.pageCount !== (fixture.pageCount ?? 2)) throw new Error('Fixture page count does not match its declared PDF');
	const leaf = app.workspace.getLeaf(true);
	if (state.originalLeaves.has(leaf.id)) throw new Error('Workspace did not create a new fixture leaf');
	state.leaf = leaf;
	await leaf.setViewState({ type: state.readerType, state: {}, active: true });
	await leaf.view.openPdf(fixture.pdf, 1);
	app.workspace.setActiveLeaf(leaf, { focus: true });
	const view = state.view();
	if (view.pages !== (fixture.pageCount ?? 2) || !view.surface || typeof view.createExcerpt !== 'function') throw new Error('Fixture reader APIs unavailable');
	view.selectedTarget = 'markdown'; view.selectedTargetPath = fixture.target;
	// This guard is per-fixture leaf; a changed API must fail instead of creating a user target.
	view.host = { ...view.host, createTarget: async () => { throw new Error('Functional test must use its existing fixture Markdown target'); } };
	await view.goTo(1, { jump: true, smooth: false });
	const host = await view.surface.ensurePageRendered(1);
	if (!host?.querySelector('.rd-pdf-text-layer span')) throw new Error('Real PDF text layer did not render');
	return { bookId: book.id, pageCount: book.pageCount, leafId: leaf.id, textSpans: host.querySelectorAll('.rd-pdf-text-layer span').length, ledger: await state.collect() };
}

async function searchRemote(key, phrase) {
	const state = globalThis[key], view = state.view(), panel = view.tools.searchPanel;
	panel.show();
	const input = view.containerEl.querySelector('[aria-label="搜索关键词"]');
	if (!input) throw new Error('Fixture search input missing');
	input.value = phrase; input.dispatchEvent(new Event('input', { bubbles: true }));
	await panel.refresh();
	const hits = panel.hits.map(hit => ({ page: hit.page, start: hit.start, end: hit.end, spans: hit.spans, snippet: hit.snippet }));
	const host = view.surface.hostForPage(1), layer = host?.querySelector('.rd-pdf-text-layer');
	const spans = [...layer?.querySelectorAll('span') ?? []].map(span => ({ text: span.textContent, start: Number(span.dataset.rdTextStart), end: Number(span.dataset.rdTextEnd) }));
	return { query: panel.currentQuery(), hits, pageText: layer?.dataset.rdPageText, domSpans: spans,
		currentPage: view.page, marks: host?.querySelectorAll('.rd-search-hit').length ?? 0,
		currentMarks: host?.querySelectorAll('.rd-search-hit--current').length ?? 0,
		status: view.containerEl.querySelector('.rd-search-panel__status')?.textContent };
}

/** No frozenSelection/frozenRects: the product must derive geometry from this Range. */
async function excerptRemote(key, phrase) {
	const state = globalThis[key], view = state.view(); view.tools.searchPanel.close();
	await view.goTo(1, { smooth: false }); const host = await view.surface.ensurePageRendered(1);
	host.scrollIntoView({ block: 'start', behavior: 'auto' });
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const layer = host.querySelector('.rd-pdf-text-layer'), spans = [...layer.querySelectorAll('span[data-rd-text-start]')];
	const text = layer.dataset.rdPageText;
	const hit = view.tools.searchPanel.hits.find(hit => hit.page === 1);
	if (!hit || !text.slice(hit.start, hit.end).toLowerCase().replace(/\s+/g, ' ').includes(phrase)) throw new Error('Phrase/UTF-16 offsets missing from real search result');
	const start = hit.start, end = hit.end;
	const first = spans.find(span => Number(span.dataset.rdTextStart) <= start && Number(span.dataset.rdTextEnd) > start);
	const last = spans.find(span => Number(span.dataset.rdTextStart) < end && Number(span.dataset.rdTextEnd) >= end);
	if (!first || !last || first === last) throw new Error('Fixture phrase does not cross real text spans');
	const textNode = span => {
		const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT); const node = walker.nextNode();
		if (!node || walker.nextNode()) throw new Error('Unsupported PDF text span structure'); return node;
	};
	const range = document.createRange();
	range.setStart(textNode(first), start - Number(first.dataset.rdTextStart));
	range.setEnd(textNode(last), end - Number(last.dataset.rdTextStart));
	const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
	const selected = selection.toString().trim(), rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
	if (selected.toLowerCase().replace(/\s+/g, '') !== phrase.replace(/\s+/g, '') || !rects.length) throw new Error('Real DOM selection failed: ' + JSON.stringify({ selected, rangeText: range.toString(), rectCount: rects.length, expected: phrase }));
	const before = new Set(state.plugin.annotations.list(state.fixture.pdf).map(highlight => highlight.id));
	try { await view.createExcerpt(selected, 'markdown', 'moss'); }
	finally { await state.collect(); }
	await state.flush();
	const added = state.plugin.annotations.list(state.fixture.pdf).filter(highlight => !before.has(highlight.id));
	if (added.length !== 1) throw new Error('Real createExcerpt did not persist exactly one highlight');
	const highlight = added[0], target = app.vault.getAbstractFileByPath(state.fixture.target);
	const markdown = await app.vault.read(target);
	const persisted = await state.plugin.loadData(), disk = persisted?.highlights?.[highlight.id];
	return { selection: { text: selected, rectCount: rects.length, crossesSpans: first !== last }, highlight, diskHighlight: disk,
		pending: !!state.plugin.repository.readPendingTargetWrites()[highlight.id], diskPending: !!persisted?.pendingTargetWrites?.[highlight.id],
		markdownContainsId: markdown.includes(highlight.id), markdownContainsText: markdown.includes(highlight.text),
		ledger: await state.collect() };
}

async function internalLinkRemote(key, externalUrl) {
	const state = globalThis[key], view = state.view(); await view.goTo(1, { smooth: false });
	const host = await view.surface.ensurePageRendered(1);
	const link = host.querySelector('[data-pdf-link]'), preview = host.querySelector('[data-pdf-preview]');
	const external = host.querySelector('a.rd-pdf-link');
	if (!link || !preview || !external) throw new Error('Fixture internal/preview/external link layer missing');
	if (external.href !== externalUrl || external.target !== '_blank' || !external.rel.includes('noopener')) throw new Error('External link semantics failed');
	link.scrollIntoView({ block: 'center', behavior: 'auto' });
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const bounds = link.getBoundingClientRect();
	const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
	if (document.elementFromPoint(x, y)?.closest('[data-pdf-link]') !== link) throw new Error('Internal link is occluded; refusing a CDP click outside the fixture');
	if (bounds.width <= 0 || bounds.height <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > innerWidth || bounds.bottom > innerHeight) throw new Error('Internal link is not visible for a real CDP click');
	return { destination: JSON.parse(link.dataset.pdfLink), external: { href: external.href, target: external.target, rel: external.rel, clicked: false },
		point: { x, y }, origin: view.positions.capture() };
}

async function previewSampleRemote(key) {
	const view = globalThis[key].view(), preview = view.containerEl.querySelector('.rd-pdf-preview');
	const canvas = preview?.querySelector('canvas');
	return { exists: !!preview, rendered: !!canvas && canvas.width > 0, page: view.page,
		label: preview?.getAttribute('aria-label'), text: preview?.textContent,
		previewLinks: preview?.querySelectorAll('.rd-pdf-link').length ?? 0 };
}
async function closePreviewRemote(key) {
	const view = globalThis[key].view(), preview = view.containerEl.querySelector('.rd-pdf-preview');
	if (!preview) throw new Error('Preview closed before Escape regression');
	preview.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	return { closed: !view.containerEl.querySelector('.rd-pdf-preview'), focusOnInternalLink: !!document.activeElement?.hasAttribute('data-pdf-link'), page: view.page };
}
async function linkPageRemote(key) {
	const view = globalThis[key].view(); return { page: view.page, statePage: view.getState().page, text: view.surface.hostForPage(2)?.querySelector('.rd-pdf-text-layer')?.textContent ?? '' };
}

/** Render page one last; then explicitly crop source page two at 0° and 90°. */
async function cropRemote(key) {
	const view = globalThis[key].view(), pdf = view.pdf;
	const crop = typeof pdf.cropPage === 'function' ? pdf.cropPage.bind(pdf) : pdf.renderCrop?.bind(pdf);
	if (!crop) throw new Error('Explicit cropPage/renderCrop(request) API missing');
	const scratch = document.createElement('div');
	try { if (!await pdf.renderPage(1, scratch, [], { scale: 0.5, rotation: 0, links: false })) throw new Error('Could not render the deliberately different last page'); }
	finally { pdf.releaseTarget(scratch); }
	const lastRenderedPage = pdf.renderedPageNumber;
	if (lastRenderedPage !== 1) throw new Error('Crop test did not establish the wrong last-rendered page');
	const crops = [];
	for (const rotation of [0, 90]) {
		const measured = await pdf.pageViewport(2), viewport = measured.clone({ scale: 1, rotation });
		const rect = { x: 0.1, y: 0.1, width: 0.8, height: 0.6 };
		const blob = await crop({ page: 1, rect, rotation, viewport });
		if (blob.type !== 'image/png') throw new Error('Crop did not return image/png');
		const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
		try {
			const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
			const rendered = measured.clone({ scale: 1.5, rotation }), [minX, minY, maxX, maxY] = rendered.viewBox;
			const a = rendered.convertToViewportPoint(minX + rect.x * (maxX - minX), maxY - rect.y * (maxY - minY));
			const b = rendered.convertToViewportPoint(minX + (rect.x + rect.width) * (maxX - minX), maxY - (rect.y + rect.height) * (maxY - minY));
			const left = Math.min(a[0], b[0]), top = Math.min(a[1], b[1]), width = Math.abs(a[0] - b[0]), height = Math.abs(a[1] - b[1]);
			const sample = fraction => {
				const point = rendered.convertToViewportPoint(minX + fraction * (maxX - minX), maxY - 0.4 * (maxY - minY));
				const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((point[0] - left) / width * canvas.width)));
				const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((point[1] - top) / height * canvas.height)));
				return { x, y, rgba: [...context.getImageData(x, y, 1, 1).data] };
			};
			const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
			for (let offset = 0; offset < bytes.length; offset += 4096) binary += String.fromCharCode(...bytes.subarray(offset, offset + 4096));
			crops.push({ page: 1, rotation, width: bitmap.width, height: bitmap.height, type: blob.type, bytes: bytes.length,
				cssWidth: width, cssHeight: height, sourceWidth: rendered.width, sourceHeight: rendered.height, dpr: window.devicePixelRatio || 1,
				blue: sample(0.25), green: sample(0.75), pngBase64: btoa(binary) });
		} finally { bitmap.close(); canvas.width = canvas.height = 0; }
	}
	return { api: typeof pdf.cropPage === 'function' ? 'cropPage(request)' : 'renderCrop(request)', lastRenderedPage, crops };
}

async function removeRecordedDataRemote(key) {
	const state = globalThis[key]; await state.collect(); const repo = state.plugin.repository, records = state.records;
	await repo.commit(() => {
		for (const id of records.books) { const book = repo.readBooks()[id]; if (book && book.path !== state.fixture.pdf) throw new Error('Recorded book changed ownership'); }
		for (const id of records.highlights) { const highlight = repo.readHighlights()[id]; if (highlight && !state.belongs(highlight)) throw new Error('Recorded highlight changed ownership'); }
		for (const id of records.deleted) { const deleted = repo.readDeletedAnnotations()[id]; if (deleted && !state.belongs(deleted.highlight)) throw new Error('Recorded deleted annotation changed ownership'); }
		for (const id of records.pending) { const pending = repo.readPendingTargetWrites()[id]; if (pending && !state.belongs(pending)) throw new Error('Recorded pending intent changed ownership'); }
		for (const id of records.books) delete repo.readBooks()[id];
		for (const id of records.highlights) delete repo.readHighlights()[id];
		for (const id of records.commentParents) {
			const comments = repo.readComments()[id] ?? [];
			if (comments.some(comment => comment.highlightId !== id || !records.comments.has(comment.id))) throw new Error('Unrecorded comment found during cleanup');
			delete repo.readComments()[id];
		}
		for (const id of records.cards) delete repo.readExcerptCards()[id];
		for (const id of records.deleted) delete repo.readDeletedAnnotations()[id];
		for (const id of records.pending) delete repo.readPendingTargetWrites()[id];
	});
	state.plugin.library.rebuildPathMap?.(); return state.ledger();
}

async function cleanupRemote(key) {
	const state = globalThis[key]; if (!state) return { ok: true, skipped: 'No remote state was created' };
	const errors = [], removed = [];
	try {
		state.check();
		if (state.scenarioCleanupBlocker) throw new Error(state.scenarioCleanupBlocker);
		const leaf = state.leaf;
		if (leaf && state.findLeaf(leaf.id)) {
			if (state.originalLeaves.has(leaf.id)) throw new Error('Refusing to close an original leaf');
			const type = leaf.view.getViewType(), source = leaf.view.getState().pdfPath;
			if ((type !== state.readerType && type !== 'empty') || (source && source !== state.fixture.pdf)) throw new Error('Fixture leaf now shows another document; preserving it');
			await leaf.setViewState({ type: 'empty', state: {}, active: false }); leaf.detach();
		}
		await state.flush(); await state.collect();
	} catch (error) { errors.push('Close/flush failed: ' + String(error)); }
	return { ok: !errors.length, errors, removed, ledger: state.ledger() };
}

async function deleteFixtureFilesRemote(key) {
	const state = globalThis[key], removed = []; state.check();
	const repo = state.plugin.repository;
	const references = [...Object.values(repo.readHighlights()), ...Object.values(repo.readPendingTargetWrites()), ...Object.values(repo.readDeletedAnnotations()).map(item => item.highlight)];
	if (references.some(item => item.target?.path === state.fixture.target && item.pdfPath !== state.fixture.pdf)) throw new Error('Nonfixture annotation references the temporary target; preserving its file');
	for (const filePath of [...state.files].filter(value => value !== state.fixture.note)) {
		if (!filePath.startsWith(state.fixture.folder + '/')) throw new Error('Fixture file escaped the unique folder');
		const file = app.vault.getAbstractFileByPath(filePath); if (!file) { if (await app.vault.adapter.exists(filePath)) throw new Error('Unindexed fixture file needs manual cleanup: ' + filePath); continue; }
		if (filePath === state.fixture.target && !(await app.vault.read(file)).includes(state.fixture.runId)) throw new Error('Fixture target ownership marker changed');
		if (filePath === state.fixture.pdf) {
			const actual = new Uint8Array(await app.vault.readBinary(file)), raw = atob(state.pdfBase64);
			if (actual.length !== raw.length || actual.some((byte, index) => byte !== raw.charCodeAt(index))) throw new Error('Fixture PDF changed; preserving it for review');
		}
		await app.vault.delete(file); removed.push(filePath);
	}
	for (const cover of state.covers) {
		if (cover !== state.expectedCover || state.originalFiles.has(cover)) throw new Error('Cover was not proven new and fixture-owned');
		const file = app.vault.getAbstractFileByPath(cover);
		if (file) await app.vault.delete(file); else if (await app.vault.adapter.exists(cover)) await app.vault.adapter.remove(cover);
		removed.push(cover);
	}
	await state.flush(); return { removed, ledger: await state.collect() };
}

async function finishCleanupRemote(key) {
	const state = globalThis[key]; state.check(); await state.flush();
	const repo = state.plugin.repository, fixture = state.fixture;
	const remaining = { books: Object.values(repo.readBooks()).filter(book => book.path === fixture.pdf).length,
		highlights: Object.values(repo.readHighlights()).filter(highlight => highlight.pdfPath === fixture.pdf).length,
		deleted: Object.values(repo.readDeletedAnnotations()).filter(item => item.highlight?.pdfPath === fixture.pdf).length,
		pending: Object.values(repo.readPendingTargetWrites()).filter(item => item.pdfPath === fixture.pdf).length };
	if (Object.values(remaining).some(Boolean)) throw new Error('Fixture records remain after cleanup: ' + JSON.stringify(remaining));
	const disk = await state.plugin.loadData();
	if (Object.values(disk.books ?? {}).some(book => book.path === fixture.pdf) || Object.values(disk.highlights ?? {}).some(highlight => highlight.pdfPath === fixture.pdf)) throw new Error('Persisted fixture records remain');
	for (const [record, field] of [['commentParents', 'comments'], ['cards', 'excerptCards'], ['deleted', 'deletedAnnotations'], ['pending', 'pendingTargetWrites']]) {
		for (const id of state.records[record]) if (disk[field]?.[id] !== undefined) throw new Error('Persisted fixture ' + field + ' remains: ' + id);
	}
	const folder = app.vault.getAbstractFileByPath(fixture.folder), note = app.vault.getAbstractFileByPath(fixture.note);
	if (folder?.children.some(file => file.path !== fixture.note)) throw new Error('Unexpected files remain in fixture folder; no recursive deletion allowed');
	if (note) { if (!(await app.vault.read(note)).includes(fixture.runId)) throw new Error('Fixture note marker changed'); await app.vault.delete(note); }
	if (folder) {
		if (folder.children.length) throw new Error('Fixture folder is not empty');
		// Obsidian 1.13.7 routes nonrecursive adapter removal through fs.rm (EISDIR).
		const filesystem = window.require('fs/promises'), paths = window.require('path');
		const vaultRoot = await filesystem.realpath(app.vault.adapter.basePath);
		const absolute = await filesystem.realpath(paths.resolve(vaultRoot, fixture.folder));
		if (paths.relative(vaultRoot, absolute) !== fixture.folder || (await filesystem.readdir(absolute)).length) throw new Error('Fixture directory is not a verified empty child of testvault');
		await filesystem.rmdir(absolute);
	}
	for (const filePath of state.files) state.plugin.targets.repairs?.delete(filePath);
	await state.flush(); return { remaining, folderRemoved: !await app.vault.adapter.exists(fixture.folder), ledger: state.ledger() };
}
async function restoreActiveRemote(key, errors, release = false) {
	const state = globalThis[key]; if (!state) return { restored: false, noState: true, errors: [] };
	const localErrors = [], leaf = state.originalActive ? state.findLeaf(state.originalActive) : null;
	if (state.originalActive && !leaf) localErrors.push('Original active leaf no longer exists');
	try { if (leaf) app.workspace.setActiveLeaf(leaf, { focus: true }); }
	catch (error) { localErrors.push('Could not restore active leaf: ' + String(error)); }
	const allErrors = [...errors, ...localErrors];
	if (allErrors.length && state.folderCreated) {
		try {
			const note = app.vault.getAbstractFileByPath(state.fixture.note);
			const text = '# Reading Desk functional fixture: cleanup incomplete\n\nRun: ' + state.fixture.runId + '\n\n' + allErrors.join('\n\n') + '\n\nFixture ownership ledger:\n\n' + JSON.stringify(state.ledger(), null, 2) + '\n\nDo not restore an entire repository snapshot. Remove only these fixture records/files after reviewing the failure.\n';
			if (note) await app.vault.modify(note, text);
			else if (app.vault.getAbstractFileByPath(state.fixture.folder)) { state.files.add(state.fixture.note); await app.vault.create(state.fixture.note, text); }
		} catch (error) { localErrors.push('Could not leave fixture note: ' + String(error)); }
	}
	const result = { restored: !!leaf, originalActive: state.originalActive, ledger: state.ledger(), errors: localErrors };
	if (release && !allErrors.length && !localErrors.length) delete globalThis[key]; return result;
}

async function waitFor(evaluate, fn, key, predicate, label, timeout = 15000) {
	const until = Date.now() + timeout; let sample;
	do { sample = await remote(evaluate, fn, key); if (predicate(sample)) return sample; await pause(120); } while (Date.now() < until);
	throw new Error(label + ' timed out: ' + JSON.stringify(sample));
}
async function click(send, point, shift = false) {
	await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1, modifiers: shift ? 8 : 0 });
	await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1, modifiers: shift ? 8 : 0 });
}
async function capture(send, output, name, result) {
	const image = await send('Page.captureScreenshot', { format: 'png' });
	fs.writeFileSync(path.join(output, name), Buffer.from(image.data, 'base64')); result.artifacts.push(name);
}
function checkExcerpt(sample, fixture) {
	const highlight = sample.highlight;
	assert(highlight.pdfPath === fixture.pdf && highlight.page === 0 && highlight.target?.path === fixture.target && highlight.target.type === 'markdown', 'Excerpt source/zero-based page/target ownership failed');
	assert(highlight.rects.length && highlight.rects.every(rect => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= 1.000001 && rect.y + rect.height <= 1.000001), 'Excerpt rects are not normalized PDF coordinates');
	assert(JSON.stringify(sample.diskHighlight) === JSON.stringify(highlight), 'Excerpt differs between AnnotationStore and persisted data.json');
	assert(!sample.pending && !sample.diskPending && sample.markdownContainsId && sample.markdownContainsText, 'Target write/pending-clear persistence failed');
}
function saveCrops(sample, output, result) {
	for (const crop of sample.crops) {
		const bytes = Buffer.from(crop.pngBase64, 'base64'), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
		assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && width === crop.width && height === crop.height, 'Crop PNG signature/IHDR mismatch');
		const ratio = Math.min(crop.dpr, Math.sqrt(4000000 / (crop.sourceWidth * crop.sourceHeight)));
		assert(Math.abs(width - crop.cssWidth * ratio) <= 3 && Math.abs(height - crop.cssHeight * ratio) <= 3, 'Crop PNG dimensions differ from second-page geometry/DPR budget');
		assert(crop.blue.rgba[2] > 180 && crop.blue.rgba[1] < 110 && crop.green.rgba[1] > 150 && crop.green.rgba[2] < 100, 'Crop pixels do not identify the intended second page/rotation');
		const name = 'functional-crop-page2-' + crop.rotation + '.png'; fs.writeFileSync(path.join(output, name), bytes); result.artifacts.push(name); delete crop.pngBase64;
	}
	const [normal, rotated] = sample.crops;
	assert(Math.abs(normal.width - rotated.height) <= 3 && Math.abs(normal.height - rotated.width) <= 3, '90-degree crop did not swap PNG dimensions');
}
async function cleanup(evaluate, key, result) {
	const errors = [];
	try {
		const closed = await remote(evaluate, cleanupRemote, key); result.cleanup.close = closed; errors.push(...closed.errors ?? []);
		if (!errors.length && !closed.skipped) {
			result.cleanup.deletedRecords = await remote(evaluate, removeRecordedDataRemote, key);
			result.cleanup.deletedFiles = await remote(evaluate, deleteFixtureFilesRemote, key);
			// Flush may reveal late fixture-only scan state; remove those recorded IDs again.
			result.cleanup.lateRecords = await remote(evaluate, removeRecordedDataRemote, key);
			result.cleanup.activeLeaf = await remote(evaluate, restoreActiveRemote, key, []);
			if (result.cleanup.activeLeaf.errors.length) throw new Error(result.cleanup.activeLeaf.errors.join('; '));
			result.cleanup.final = await remote(evaluate, finishCleanupRemote, key);
		}
	} catch (error) { errors.push(errorText(error)); }
	finally {
		try { result.cleanup.activeLeaf = await remote(evaluate, restoreActiveRemote, key, errors, true); errors.push(...result.cleanup.activeLeaf.errors ?? []); }
		catch (error) { errors.push('Restore active leaf failed: ' + errorText(error)); }
	}
	result.cleanup.ok = !errors.length; result.cleanup.errors = errors;
	if (errors.length) result.failures.push('Cleanup incomplete; fixture may remain: ' + errors.join('; '));
}

/** Retry only the exact retained run recorded by the previous acceptance attempt. */
export async function retryFunctionalCleanup(evaluate, output) {
	const previous = JSON.parse(fs.readFileSync(path.join(output, 'functional-scenarios.json'), 'utf8'));
	const key = '__readingDeskFunctional_' + previous.fixture.runId.replace(/-/g, '_');
	const result = { fixture: previous.fixture, cleanup: {}, failures: [] };
	await cleanup(evaluate, key, result);
	fs.writeFileSync(path.join(output, 'functional-cleanup-retry.json'), JSON.stringify(result, null, 2));
	if (!result.cleanup.ok) throw new Error(JSON.stringify(result));
	return result;
}

/** Run only against a deployed testvault; importing this file performs no scenario. */
export async function runFunctionalScenarios({ evaluate, send, output }) {
	assert(typeof evaluate === 'function' && typeof send === 'function' && typeof output === 'string', 'Expected {evaluate,send,output} CDP interface');
	fs.mkdirSync(output, { recursive: true });
	const runId = Date.now() + '-' + randomUUID(), folder = 'ReadingDesk-Functional-' + runId;
	const fixture = { runId, folder, pdf: folder + '/fixture.pdf', target: folder + '/excerpt-target.md', note: folder + '/FIXTURE.md' };
	const key = '__readingDeskFunctional_' + runId.replace(/-/g, '_'), bytes = buildFixturePdf(runId);
	const result = { checkedAt: new Date().toISOString(), fixture, samples: {}, cleanup: {}, failures: [], artifacts: [],
		limitations: ['Uses current ReaderView private runtime APIs; changes fail explicitly.', 'Crop verifies renderCrop/cropPage(request), not drag export or object-storage upload.', 'No external link is clicked; its safe rendered anchor is inspected.', 'Unrelated pending events block explicit flush; failed cleanup leaves a fixture note and ledger.', 'New fixture cover files are removed; shared cover-directory parents are retained.'] };
	try {
		result.samples.preflight = await remote(evaluate, initializeRemote, key, fixture, bytes.toString('base64'), createHash('sha256').update(fixture.pdf).digest('hex'), PLUGIN_ID, READER_TYPE);
		result.samples.fixture = await remote(evaluate, createFixtureRemote, key);
		const search = result.samples.search = await remote(evaluate, searchRemote, key, PHRASE);
		assert(search.hits.length === 4 && search.hits.every(hit => hit.page === 1 && hit.spans.filter(span => span.end > span.start).length >= 2), 'Expected four complete cross-span first-page search matches');
		assert(search.currentPage === 1 && search.marks >= 4 && search.currentMarks >= 2, 'Search did not paint precise/current DOM ranges');
		await capture(send, output, 'functional-search.png', result);
		const excerpt = result.samples.excerpt = await remote(evaluate, excerptRemote, key, PHRASE); checkExcerpt(excerpt, fixture);
		await capture(send, output, 'functional-excerpt.png', result);
		const link = result.samples.links = await remote(evaluate, internalLinkRemote, key, EXTERNAL_URL);
		assert(link.destination.page === 2, 'Fixture GoTo did not resolve to viewer page two');
		await click(send, link.point, true);
		result.samples.preview = await waitFor(evaluate, previewSampleRemote, key, sample => sample.exists && sample.rendered, 'Shift-click internal preview');
		assert(result.samples.preview.page === link.origin.page && result.samples.preview.previewLinks === 0, 'Preview changed the source page or exposed recursive links');
		await capture(send, output, 'functional-link-preview.png', result);
		result.samples.previewClosed = await remote(evaluate, closePreviewRemote, key);
		assert(result.samples.previewClosed.closed && result.samples.previewClosed.focusOnInternalLink && result.samples.previewClosed.page === link.origin.page, 'Escape preview/focus restore failed');
		const jump = await remote(evaluate, internalLinkRemote, key, EXTERNAL_URL); await click(send, jump.point);
		result.samples.linkJump = await waitFor(evaluate, linkPageRemote, key, sample => sample.page === 2 && sample.text.includes('Second page'), 'Internal GoTo jump');
		const crop = result.samples.crop = await remote(evaluate, cropRemote, key); saveCrops(crop, output, result);
	} catch (error) {
		result.failures.push(errorText(error));
		try { await capture(send, output, 'functional-failure.png', result); } catch (captureError) { result.failures.push('Screenshot failed: ' + errorText(captureError)); }
	} finally {
		await cleanup(evaluate, key, result);
		result.finishedAt = new Date().toISOString();
		fs.writeFileSync(path.join(output, 'functional-scenarios.json'), JSON.stringify(result, null, 2) + '\n');
	}
	assert(result.artifacts.some(name => /functional-(search|excerpt|link-preview|failure)\.png$/.test(name)), 'No CDP screenshot artifact was saved');
	if (result.failures.length) throw new Error('Functional scenarios failed; inspect ' + path.join(output, 'functional-scenarios.json') + ': ' + result.failures.join('\n'));
	return result;
}

/** Shared identity-ledger harness for additional scoped PDF workflows. */
export async function withFunctionalFixture({ evaluate, send, output, buildPdf, pageCount, scenario }) {
	fs.mkdirSync(output, { recursive: true });
	const runId = Date.now() + '-' + randomUUID(), folder = 'ReadingDesk-Functional-' + runId;
	const fixture = { runId, folder, pageCount, pdf: folder + '/fixture.pdf', target: folder + '/excerpt-target.md', note: folder + '/FIXTURE.md' };
	const key = '__readingDeskFunctional_' + runId.replace(/-/g, '_'), bytes = buildPdf(runId);
	const result = { checkedAt: new Date().toISOString(), fixture, samples: {}, cleanup: {}, failures: [], artifacts: [], limitations: ['Uses actual deployed Reader private APIs and DOM with scoped fixture identity; it does not claim manual input testing.'] };
	try {
		result.samples.preflight = await remote(evaluate, initializeRemote, key, fixture, bytes.toString('base64'), createHash('sha256').update(fixture.pdf).digest('hex'), PLUGIN_ID, READER_TYPE);
		result.samples.fixture = await remote(evaluate, createFixtureRemote, key);
		await scenario({ key, fixture, result, evaluate, send, output });
	} catch (error) { result.failures.push(errorText(error)); }
	finally {
		await cleanup(evaluate, key, result); result.finishedAt = new Date().toISOString();
		fs.writeFileSync(path.join(output, 'functional-scenarios.json'), JSON.stringify(result, null, 2));
	}
	if (result.failures.length) throw new Error(JSON.stringify(result));
	return result;
}
