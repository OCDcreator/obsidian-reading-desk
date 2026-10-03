import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { controls, poll, remote, shot } from './margin-cdp-controls.mjs';

const assert = (value, message) => { if (!value) throw new Error(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const ACK = '我已备份当前数据，并核对恢复差异与路径映射';

async function mountIsolation(evaluate, key, fixture) {
	const bundle = await build({ entryPoints: ['scripts/margin-workflow-isolation.mjs'], bundle: true, platform: 'browser',
		format: 'iife', globalName: 'RdWorkflowIsolation', write: false });
	return evaluate('(async()=>{' + bundle.outputFiles[0].text + '\n' + `
		const state=globalThis[${JSON.stringify(key)}]; state.check();
		if(state.workflowIsolation)throw Error('Isolation already mounted');
		const isolated=await RdWorkflowIsolation.createWorkflowIsolation(${JSON.stringify(fixture.runId)},${JSON.stringify(fixture.pdf)});
		state.workflowIsolation=isolated;
		const container=document.createElement('div'); container.setAttribute('aria-label','Reading Desk isolated workflow QA');
		Object.assign(container.style,{position:'fixed',top:'40px',right:'20px',width:'760px',maxWidth:'calc(100vw - 40px)',
			maxHeight:'calc(100vh - 80px)',overflow:'auto',zIndex:'9999',padding:'16px',background:'var(--background-primary)'});
		document.body.append(container); isolated.container=container; isolated.mount(container);
		return {backupText:isolated.backupText,bibliographyText:isolated.bibliographyText,familyId:isolated.familyId};
	})()`);
}

async function backupWorkflow(ui, inspect, files) {
	await ui.file('选择 Reading Desk 完整备份文件', files.backup);
	await poll(async () => (await inspect()).preview?.objects.length, 'Backup preview missing');
	await ui.select('恢复模式', 'merge');
	await poll(async () => (await inspect()).preview, 'Merge preview missing');
	await ui.select('恢复冲突处理', 'use-backup');
	const unresolved = await poll(async () => { const preview = (await inspect()).preview;
		return preview?.objects.some(object => object.collection === 'annotations' && object.resolution === 'error') ? preview : null;
	}, 'Cross-state annotation conflict protection missing');
	assert(!unresolved.canApply, 'Activity/deletion conflict was implicitly resolved');
	const family = '恢复决策：annotations:' + files.familyId;
	await ui.select(family, 'keep-current');
	assert((await ui.read('确认恢复完整备份')).disabled && !(await inspect()).counters.restores, 'Decision did not invalidate restore confirmation');
	await ui.click('重新预览恢复差异');
	const kept = await poll(async () => { const p = (await inspect()).preview; return p?.activeFamily && !p.deletedFamily && p.canApply ? p : null; }, 'Family keep decision lost');
	assert(!(await inspect()).counters.saves, 'Preview wrote isolated data');
	await ui.select(family, 'use-backup');
	await ui.click('重新预览恢复差异');
	const moved = await poll(async () => { const p = (await inspect()).preview; return !p?.activeFamily && p?.deletedFamily && p.canApply ? p : null; }, 'Family backup decision lost');
	const serialized = JSON.stringify([kept.objects, moved.objects]);
	assert(!serialized.includes('QA-CREDENTIAL-DO-NOT-DISPLAY') && !serialized.includes('QA-SECRET-DO-NOT-DISPLAY'), 'Credential exposed in preview');
	await ui.click(ACK); await ui.click('确认恢复完整备份');
	assert((await inspect()).counters.restores === 0, 'First confirmation restored data');
	await ui.click('取消恢复确认');
	assert((await inspect()).counters.restores === 0 && !(await ui.read(ACK)).checked, 'Cancel did not clear restore acknowledgement');
	await ui.click(ACK); await ui.click('确认恢复完整备份'); await ui.click('再次确认恢复完整备份');
	const applied = await poll(async () => { const state = await inspect(); return state.counters.restores === 1 ? state : null; }, 'Isolated restore did not complete');
	assert(!applied.activeFamily && applied.deletedFamily && applied.deletedComments.length === 1 && applied.comments.length === 0, 'Annotation/comment family split');
	assert(applied.counters.restoreBackups === 1, 'Pre-restore backup missing');
	return { keepPreview: kept, backupPreview: moved, applied, doubleConfirmation: true, cancellation: true };
}

async function bibliographyWorkflow(ui, inspect, files) {
	await ui.file('选择文献导出文件', files.bibliography);
	const initial = await poll(async () => { const state = await inspect(); return state.import?.entries.length === 102 ? state.import : null; }, 'Bibliography preview missing');
	assert(initial.entries.every(entry => !entry.pathConfirmed), 'Suggestions were implicitly confirmed');
	assert((await inspect()).counters.imports.length === 0, 'Preview imported bibliography');
	await ui.click('批量确认唯一候选附件');
	await poll(async () => (await inspect()).import?.entries.every(entry => entry.pathConfirmed), 'Attachment confirmation failed');
	await ui.click('取消全部文献选择');
	assert(!(await ui.read('选择导入：Isolated import 0')).checked, 'Cancel all failed');
	await ui.click('选择全部可应用文献');
	assert((await ui.read('选择导入：Isolated import 0')).checked, 'Select all failed');
	await ui.click('取消全部文献选择'); await ui.click('选择导入：Isolated import 0');
	// The product page limit is 100 rows; the fixture deliberately crosses that boundary.
	await ui.click('文献预览下一页'); await ui.click('选择导入：Isolated import 100');
	await ui.click('文献预览上一页');
	assert((await ui.read('选择导入：Isolated import 0')).checked && !(await ui.read('选择导入：Isolated import 1')).checked, 'Selection changed across pages');
	await ui.click('确认导入文献');
	const applied = await poll(async () => { const state = await inspect(); return state.counters.imports.length === 1 ? state : null; }, 'Bibliography import missing');
	const titles = Object.values(applied.books).filter(book => book.source).map(book => book.title).sort();
	assert(JSON.stringify(titles) === JSON.stringify(['Isolated import 0', 'Isolated import 100']), 'Import applied unselected records');
	assert(applied.counters.imports[0].length === 2, 'Selected import count mismatch');
	return { entries: 102, attachmentConfirmation: true, crossPageSelection: true, selectedTitles: titles };
}

async function recoveryWorkflow(ui, inspect) {
	const before = (await inspect()).snapshotPaths;
	await ui.click('刷新快照清单');
	await poll(async () => { try { return !(await ui.read('预览恢复：manual.json')).disabled; } catch { return false; } }, 'Snapshot inventory did not render');
	await ui.click('预览恢复：manual.json');
	await poll(async () => (await inspect()).preview, 'Snapshot restore preview missing');
	const restores = (await inspect()).counters.restores;
	await ui.type('保留数量或天数', '1'); await ui.click('预览快照清理');
	const count = await poll(async () => { const paths = (await inspect()).cleanupCandidates; return paths.length === 2 ? paths : null; }, 'Count cleanup preview missing');
	await ui.click('确认清理旧自动快照');
	assert((await inspect()).counters.cleanupCalls === 0, 'First cleanup confirmation deleted files');
	await ui.click('取消快照清理');
	assert(JSON.stringify((await inspect()).snapshotPaths) === JSON.stringify(before), 'Cancelled cleanup deleted files');
	await ui.select('自动快照保留策略', 'days'); await ui.click('预览快照清理');
	const days = await poll(async () => { const paths = (await inspect()).cleanupCandidates; return paths.length === 2 ? paths : null; }, 'Days cleanup preview missing');
	await ui.click('确认清理旧自动快照');
	await ui.type('保留数量或天数', '2');
	// Changing retention must invalidate the armed second confirmation.
	assert((await inspect()).counters.cleanupCalls === 0 && (await ui.read('确认清理旧自动快照')).disabled, 'Changed policy did not invalidate cleanup');
	await ui.click('预览快照清理');
	await ui.click('确认清理旧自动快照'); await ui.click('再次确认删除旧自动快照');
	const applied = await poll(async () => { const state = await inspect(); return state.counters.removed.length === 2 ? state : null; }, 'Isolated cleanup missing');
	assert(applied.counters.restores === restores, 'Snapshot preview silently restored repository');
	assert(applied.snapshotPaths.length === 5 && applied.snapshotPaths.some(p => p.endsWith('3-commit.json')) &&
		['manual.json', 'before-restore.json', 'broken.json', 'archive'].every(name => applied.snapshotPaths.some(p => p.endsWith('/' + name))), 'Protected snapshot removed');
	return { count, days, removed: applied.counters.removed, protected: applied.snapshotPaths, doubleConfirmation: true, policyInvalidation: true };
}

/** Real product controls + CDP input, with isolated domain persistence. Never uses plugin.dataPanelHost(). */
export async function runSettingsWorkflow({ evaluate, send, output, key, fixture }) {
	const directory = fs.mkdtempSync(path.join(output, 'workflow-input-'));
	const ownedFiles = [];
	let mounted = false;
	const result = { scope: 'Product ImportExportPanel DOM / real input; memory-only Repository and RecoverySnapshotGateway; no real data.json or recovery I/O',
		actionSource: send.nativeSelect ? 'CDP mouse/key/insertText + CUA native select menus with CDP readback' : 'CDP mouse/key/insertText',
		fileInputScope: 'CDP file input attachment; native OS picker is unverified' };
	try {
		const setup = await mountIsolation(evaluate, key, fixture); mounted = true;
		const files = { familyId: setup.familyId };
		for (const [name, text] of [['backup', setup.backupText], ['bibliography', setup.bibliographyText]]) {
			files[name] = path.join(directory, name + '.json'); fs.writeFileSync(files[name], text, { flag: 'wx' });
			ownedFiles.push({ path: files[name], digest: hash(text) });
		}
		const root = 'globalThis[' + JSON.stringify(key) + '].workflowIsolation.container';
		const ui = controls({ evaluate, send }, root);
		const inspect = () => remote(evaluate, key => globalThis[key].workflowIsolation.inspect(), key);
		result.backup = await backupWorkflow(ui, inspect, files);
		result.narrowPreview = await remote(evaluate, key => {
			const container = globalThis[key].workflowIsolation.container;
			container.style.width = '360px'; container.querySelector('.rd-backup-panel').scrollIntoView({ block: 'start' });
			return { width: container.getBoundingClientRect().width, clientWidth: container.clientWidth, scrollWidth: container.scrollWidth,
				longTextPresent: container.textContent.includes('恢复差异长标题'), theme: document.body.className };
		}, key);
		assert(result.narrowPreview.longTextPresent && result.narrowPreview.scrollWidth <= result.narrowPreview.clientWidth + 2, 'Narrow preview overflowed');
		await shot(send, output, 'workflow-settings-narrow.png');
		await remote(evaluate, key => { globalThis[key].workflowIsolation.container.style.width = '760px'; }, key);
		result.bibliography = await bibliographyWorkflow(ui, inspect, files);
		result.recovery = await recoveryWorkflow(ui, inspect);
		await shot(send, output, 'workflow-settings.png');
		return result;
	} finally {
		if (mounted) {
			result.finalObservation = await remote(evaluate, key => globalThis[key].workflowIsolation.inspect(), key);
			fs.writeFileSync(path.join(output, 'workflow-settings-observation.json'), JSON.stringify(result, null, 2));
		}
		// Identity-based teardown only; it cannot restore or delete real plugin data.
		if (mounted || await remote(evaluate, key => !!globalThis[key]?.workflowIsolation, key)) {
			await remote(evaluate, key => { const state = globalThis[key]; state.workflowIsolation.dispose(); state.workflowIsolation.container?.remove(); delete state.workflowIsolation; }, key);
			assert(!await remote(evaluate, key => !!globalThis[key]?.workflowIsolation, key), 'Isolation teardown failed');
		}
		for (const file of ownedFiles) {
			assert(hash(fs.readFileSync(file.path)) === file.digest, 'Fixture input changed; preserving ' + file.path);
			fs.unlinkSync(file.path);
		}
		fs.rmdirSync(directory); result.cleanup = { isolatedSurfaceRemoved: true, exactOwnedInputFilesRemoved: ownedFiles.length };
	}
}
