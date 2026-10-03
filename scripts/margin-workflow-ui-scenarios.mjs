import { withFunctionalFixture, buildFixturePdf } from './enhancement-functional-scenarios.mjs';
import { controls, poll, remote, shot } from './margin-cdp-controls.mjs';
import { runSettingsWorkflow } from './margin-workflow-settings.mjs';

const assert = (value, message) => { if (!value) throw new Error(message); };

async function prepareRemote(key) {
	const state = globalThis[key]; state.check(); const plugin = state.plugin;
	const workflow = state.workflow = { originalShelf: structuredClone(plugin.repository.readSettings().shelf),
		lastShelf: undefined, listIds: new Set(), inFlight: new Set(), leaf: null };
	workflow.listName = 'Margin QA ' + state.fixture.runId;
	workflow.install = leaf => {
		const host = leaf.view.shelf?.host;
		if (!host?.updateBook || !host.createList || !host.saveShelfState) throw new Error('Fixture shelf host unavailable');
		const original = { updateBook: host.updateBook, createList: host.createList, saveShelfState: host.saveShelfState };
		const track = operation => { const pending = Promise.resolve().then(operation); workflow.inFlight.add(pending); pending.then(() => workflow.inFlight.delete(pending), () => workflow.inFlight.delete(pending)); return pending; };
		const createList = name => track(async () => {
			if (name !== workflow.listName) throw new Error('Refuse nonfixture list creation');
			const list = await original.createList.call(host, name); workflow.listIds.add(list.id); return list;
		});
		const saveShelfState = value => track(async () => {
			await original.saveShelfState.call(host, value); workflow.lastShelf = structuredClone(value);
		});
		const updateBook = (id, patch) => track(async () => {
			const book = plugin.library.getByPath(state.fixture.pdf);
			if (id !== book?.id) throw new Error('Refuse nonfixture delayed update');
			if (workflow.delayTitle && Object.hasOwn(patch, 'title')) {
				workflow.titleBlocked = true; await new Promise(resolve => { workflow.releaseTitle = resolve; });
			}
			return original.updateBook.call(host, id, patch);
		});
		Object.assign(host, { createList, saveShelfState, updateBook });
		workflow.restoreHost = () => {
			for (const [field, wrapper] of Object.entries({ createList, saveShelfState, updateBook })) {
				if (host[field] !== wrapper) throw new Error('Fixture host changed; preserving later wrapper: ' + field);
				host[field] = original[field];
			}
		};
	};
	workflow.open = async () => {
		const leaf = workflow.leaf = app.workspace.getLeaf(true);
		if (state.originalLeaves.has(leaf.id)) throw new Error('Expected a new fixture shelf leaf');
		await leaf.setViewState({ type: 'reading-desk-shelf', state: {}, active: true });
		workflow.install(leaf); app.workspace.setActiveLeaf(leaf, { focus: true });
	};
	workflow.close = async () => {
		workflow.delayTitle = false; workflow.releaseTitle?.();
		await Promise.all([...workflow.inFlight]);
		const leaf = workflow.leaf;
		if (leaf && state.findLeaf(leaf.id)) {
			if (leaf.view.getViewType() !== 'reading-desk-shelf') throw new Error('Fixture shelf leaf changed; preserving it');
			await leaf.setViewState({ type: 'empty', state: {}, active: false }); leaf.detach();
		}
		workflow.restoreHost?.(); workflow.restoreHost = undefined; workflow.leaf = null;
	};
	await workflow.open();
	return { name: workflow.listName, book: plugin.library.getByPath(state.fixture.pdf) };
}

async function cleanupRemote(key) {
	const state = globalThis[key]; if (!state?.workflow) return { skipped: true }; state.check();
	const workflow = state.workflow, plugin = state.plugin;
	await workflow.close();
	const names = [workflow.listName, workflow.listName + ' renamed'];
	// Prove each captured id still has an exact fixture name and no unrelated relation.
	for (const id of workflow.listIds) {
		const list = plugin.library.listLists().find(item => item.id === id);
		if (list && !names.includes(list.name)) throw new Error('Fixture list changed; preserving ' + id);
		if (Object.values(plugin.repository.readBooks()).some(book => book.path !== state.fixture.pdf && book.listIds?.includes(id))) throw new Error('Fixture list gained unrelated books; preserving ' + id);
	}
	let restored = false;
	await plugin.repository.commit(() => {
		const lists = plugin.repository.readLists();
		for (const id of workflow.listIds) {
			const position = lists.findIndex(list => list.id === id && names.includes(list.name));
			if (position >= 0) lists.splice(position, 1);
			for (const book of Object.values(plugin.repository.readBooks())) if (book.path === state.fixture.pdf && book.listIds?.includes(id)) book.listIds = book.listIds.filter(value => value !== id);
		}
		const settings = plugin.repository.readSettings();
		if (workflow.lastShelf !== undefined && JSON.stringify(settings.shelf) === JSON.stringify(workflow.lastShelf)) {
			if (workflow.originalShelf === undefined) delete settings.shelf; else settings.shelf = workflow.originalShelf;
			restored = true;
		}
	});
	const disk = await plugin.loadData();
	const remaining = disk.lists.filter(list => workflow.listIds.has(list.id));
	if (remaining.length) throw new Error('Fixture lists remain on disk');
	if (restored && JSON.stringify(disk.settings.shelf) !== JSON.stringify(workflow.originalShelf)) throw new Error('Shelf restoration disk mismatch');
	return { fixtureListsRemain: remaining.length, shelfRestored: restored, concurrentShelfStatePreserved: !restored,
		scope: 'Captured list ids + exact names and fixture relations; shelf field restored only when equal to last own save' };
}

async function listReadback(evaluate, key, id, expectedName) {
	return poll(() => remote(evaluate, async (key, id, name) => {
		const state = globalThis[key], live = state.plugin.library.listLists().find(list => list.id === id);
		const disk = (await state.plugin.loadData()).lists.find(list => list.id === id);
		return name === null ? (!live && !disk ? { absentInMemory: true, absentOnDisk: true } : null)
			: live?.name === name && disk?.name === name ? { id, memoryName: live.name, diskName: disk.name } : null;
	}, key, id, expectedName), 'List memory/disk readback mismatch');
}

async function shelfWorkflow({ evaluate, send, output, key, fixture }) {
	const root = 'globalThis[' + JSON.stringify(key) + '].workflow.leaf.view.containerEl';
	const ui = controls({ evaluate, send }, root), initial = await remote(evaluate, prepareRemote, key);
	await ui.type('搜索书架', fixture.runId); await ui.select('格式', 'pdf');
	await ui.click('新建阅读列表'); await ui.type('阅读列表名称', initial.name); await ui.click('创建阅读列表');
	const list = await poll(() => remote(evaluate, key => {
		const state = globalThis[key]; return state.plugin.library.listLists().find(list => state.workflow.listIds.has(list.id));
	}, key), 'Create list failed');
	const created = await listReadback(evaluate, key, list.id, initial.name);
	const renamedName = initial.name + ' renamed';
	await ui.click('管理阅读列表'); await ui.type('阅读列表名称：' + initial.name, renamedName);
	await ui.click('保存阅读列表名称：' + initial.name);
	const renamed = await listReadback(evaluate, key, list.id, renamedName);
	await shot(send, output, 'workflow-list-manager.png');
	await ui.click('删除阅读列表：' + renamedName);
	await listReadback(evaluate, key, list.id, renamedName);
	await ui.click('取消删除阅读列表：' + renamedName);
	await listReadback(evaluate, key, list.id, renamedName);
	await ui.click('删除阅读列表：' + renamedName); await ui.click('确认删除阅读列表：' + renamedName);
	const removed = await listReadback(evaluate, key, list.id, null);
	await ui.click('关闭管理阅读列表'); await ui.click('表格视图');
	const persisted = await poll(() => remote(evaluate, async key => {
		const state = globalThis[key], disk = await state.plugin.loadData(), shelf = disk.settings.shelf;
		return shelf?.mode === 'table' && shelf.query?.query === state.fixture.runId && shelf.query.format === 'pdf' ? shelf : null;
	}, key), 'Shelf state disk save missing');
	await remote(evaluate, async key => { const workflow = globalThis[key].workflow; await workflow.close(); await workflow.open(); }, key);
	assert((await ui.read('搜索书架')).value === fixture.runId && (await ui.read('格式')).value === 'pdf', 'Reopen query/filter mismatch');
	assert(await remote(evaluate, key => globalThis[key].workflow.leaf.view.containerEl.querySelector('[data-shelf-mode="table"]').getAttribute('aria-pressed') === 'true', key), 'Reopen mode mismatch');
	await remote(evaluate, key => { globalThis[key].workflow.delayTitle = true; }, key);
	await ui.type(initial.book.title + ' 的标题', initial.book.title + ' QA'); await ui.tab();
	await poll(() => remote(evaluate, key => globalThis[key].workflow.titleBlocked, key), 'Delayed title save did not enter host');
	await ui.type(initial.book.title + ' 的作者', 'Fixture author draft');
	await remote(evaluate, key => { const workflow = globalThis[key].workflow; workflow.delayTitle = false; workflow.releaseTitle(); }, key);
	const draft = await poll(() => remote(evaluate, (key, title) => {
		const node = [...globalThis[key].workflow.leaf.view.containerEl.querySelectorAll('input')].find(input => input.getAttribute('aria-label') === title + ' QA 的作者');
		return node?.value === 'Fixture author draft' && document.activeElement === node ? { value: node.value, focusPreserved: true } : null;
	}, key, initial.book.title), 'Delayed repaint lost author draft/focus');
	await ui.tab();
	const book = await poll(() => remote(evaluate, async key => {
		const state = globalThis[key], live = state.plugin.library.getByPath(state.fixture.pdf), disk = (await state.plugin.loadData()).books[live.id];
		return live.author === 'Fixture author draft' && disk?.author === live.author && disk.title === live.title ? { title: disk.title, author: disk.author } : null;
	}, key), 'Book draft disk readback failed');
	await shot(send, output, 'workflow-shelf.png');
	return { actionSource: 'CDP mouse/key/insertText; ' + (send.nativeSelect ? 'CUA native format select; ' : '') + 'internal fixture setup and per-fixture-leaf delayed persistence',
		list: { created, renamed, removed, cancelledDeletion: true }, persistedShelf: persisted, reopened: true, draft, book };
}

async function sourceWorkflow({ evaluate, send, key }) {
	const setup = await remote(evaluate, async key => {
		const state = globalThis[key], file = app.vault.getAbstractFileByPath(state.fixture.pdf), id = 'anchor-qa-' + state.fixture.runId;
		if (state.plugin.annotations.get(id)) throw new Error('Anchor identity collision');
		const highlight = { id, pdfPath: state.fixture.pdf, page: 0, pageLabel: 'i', rotation: 0, rects: [{ x: .05, y: .05, width: .2, height: .05 }],
			text: 'cross span phrase', color: 'moss', chapterPath: [], tags: [], createdAt: Date.now(), updatedAt: Date.now(), sourceFingerprint: { mtime: file.stat.mtime - 1, size: file.stat.size } };
		try { await state.plugin.annotations.save(highlight); } finally { await state.collect(); }
		await app.workspace.revealLeaf(state.leaf); app.workspace.setActiveLeaf(state.leaf, { focus: true });
		await state.view().refreshAnnotations();
		return { id, rects: highlight.rects };
	}, key);
	const ui = controls({ evaluate, send }, 'globalThis[' + JSON.stringify(key) + '].view().containerEl');
	const toolbar = await remote(evaluate, key => {
		const node = globalThis[key].view().containerEl.querySelector('.rd-reader-toolbar button[aria-label="高亮列表"]');
		if (!node) throw new Error('Highlight toolbar control missing');
		return { expanded: node.getAttribute('aria-expanded') === 'true', visible: !!node.getClientRects().length };
	}, key);
	if (!toolbar.expanded) {
		if (toolbar.visible) await controls({ evaluate, send }, 'globalThis[' + JSON.stringify(key) + '].view().containerEl.querySelector(".rd-reader-toolbar")').click('高亮列表');
		else {
			await ui.click('更多工具');
			await remote(evaluate, () => {
				const items = [...document.querySelectorAll('.menu .menu-item')].filter(item => item.querySelector('.menu-item-title')?.textContent === '高亮列表');
				if (items.length !== 1) throw new Error('Highlight overflow menu ambiguity'); items[0].setAttribute('aria-label', 'QA 高亮列表菜单项');
			});
			await controls({ evaluate, send }, 'document.body').click('QA 高亮列表菜单项');
		}
	}
	await remote(evaluate, key => {
		const summary = globalThis[key].view().containerEl.querySelector('.rd-source-anchor-diagnostics summary');
		if (!summary) throw new Error('Anchor diagnostic summary missing'); summary.setAttribute('aria-label', '展开源文件核验');
	}, key);
	await ui.click('展开源文件核验'); await ui.click('查找引文：PDF 第 1 页');
	const readback = await poll(() => remote(evaluate, async (key, id) => {
		const state = globalThis[key], view = state.view(), query = view.containerEl.querySelector('[aria-label="搜索关键词"]')?.value;
		if (query !== 'cross span phrase') return null;
		return { changed: view.containerEl.querySelector('.rd-source-anchor-diagnostics').textContent.includes('文件信息变化'), query,
			memory: state.plugin.annotations.get(id), disk: (await state.plugin.loadData()).highlights[id] };
	}, key, setup.id), 'Source quote search failed');
	assert(readback.changed && JSON.stringify(readback.memory.rects) === JSON.stringify(setup.rects) && JSON.stringify(readback.disk.rects) === JSON.stringify(setup.rects), 'Source diagnostic changed anchor geometry or missed change');
	return { actionSource: 'Real diagnostic/search controls; internally seeded dedicated stale fingerprint', ...readback };
}

export async function runWorkflowScenarios({ evaluate, send, output, sourceOnly = false }) {
	return withFunctionalFixture({ evaluate, send, output, buildPdf: buildFixturePdf, pageCount: 2, scenario: async ({ key, result, fixture }) => {
		try {
			if (!sourceOnly) {
				result.samples.shelf = await shelfWorkflow({ evaluate, send, output, key, fixture });
				result.samples.settings = await runSettingsWorkflow({ evaluate, send, output, key, fixture });
			}
			result.samples.source = await sourceWorkflow({ evaluate, send, key });
			await shot(send, output, 'workflow-source.png'); result.artifacts.push('workflow-source.png');
		} catch (error) {
			try { await shot(send, output, 'workflow-failure.png'); result.artifacts.push('workflow-failure.png'); } catch { /* Retain the original failure. */ }
			throw error;
		} finally {
			try { result.samples.workflowCleanup = await remote(evaluate, cleanupRemote, key); }
			catch (error) {
				result.samples.workflowCleanup = { ok: false, error: String(error), ledger: await remote(evaluate, key => {
					const state = globalThis[key]; state.scenarioCleanupBlocker = 'Workflow cleanup failed; preserve fixture and inspect its stable ids';
					return state.workflow ? { listIds: [...state.workflow.listIds], listName: state.workflow.listName, shelfLeafId: state.workflow.leaf?.id, fixture: state.fixture } : { fixture: state.fixture };
				}, key) };
				throw error;
			}
		}
	} });
}
