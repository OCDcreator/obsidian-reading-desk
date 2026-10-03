import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

// This deliberately does not attach CDP or claim desktop acceptance.
const bundle = await build({ entryPoints: ['scripts/margin-workflow-isolation.mjs'], bundle: true, platform: 'node', format: 'esm', write: false });
const { createWorkflowIsolation } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const runId = 'domain-' + Date.now(), fixture = await createWorkflowIsolation(runId, 'ReadingDesk-QA-' + runId + '/source.pdf');
const evidence = { checkedAt: new Date().toISOString(), scope: 'Actual services with memory-only gateways; no UI, vault or real data/recovery filesystem acceptance' };
try {
	const { host } = fixture;
	assert.equal(fixture.inspect().status.phase, 'ready');
	const conflict = host.previewBackup(fixture.backupText, {}, { mode: 'merge', conflictPolicy: 'use-backup' });
	assert.equal(conflict.canApply, false); assert(conflict.objects.some(object => object.collection === 'annotations' && object.resolution === 'error'));
	const keep = host.previewBackup(fixture.backupText, {}, { mode: 'merge', conflictPolicy: 'use-backup', objectDecisions: { ['annotations:' + fixture.familyId]: 'keep-current' } });
	assert.equal(keep.canApply, true); assert.equal(fixture.inspect().preview.activeFamily, true); assert.equal(fixture.inspect().preview.deletedFamily, false);
	const use = host.previewBackup(fixture.backupText, {}, { mode: 'merge', conflictPolicy: 'use-backup', objectDecisions: { ['annotations:' + fixture.familyId]: 'use-backup' } });
	assert.equal(use.canApply, true); assert.equal(fixture.inspect().preview.deletedFamily, true); assert.equal(fixture.inspect().counters.saves, 0);
	assert.doesNotMatch(JSON.stringify(use.objects), /QA-CREDENTIAL-DO-NOT-DISPLAY|QA-SECRET-DO-NOT-DISPLAY/);
	await host.restoreBackup(use);
	const restored = fixture.inspect();
	assert.equal(restored.activeFamily, false); assert.equal(restored.deletedFamily, true); assert.equal(restored.comments.length, 0);
	assert.equal(restored.deletedComments.length, 1); assert.equal(restored.counters.restoreBackups, 1);
	evidence.annotationFamily = { keptActiveInPreview: true, restoredDeletedWithComments: true, preRestoreBackup: true, credentialsRedacted: true };
	const initial = host.prepareBibliographicImport('csl', fixture.bibliographyText, {});
	assert.equal(initial.entries.length, 102); assert(initial.entries.every(entry => !entry.pathConfirmed && entry.suggestedPaths.length === 1));
	const mappings = Object.fromEntries(initial.entries.map(entry => [entry.key, entry.suggestedPaths[0]]));
	const confirmed = host.prepareBibliographicImport('csl', fixture.bibliographyText, mappings);
	assert(confirmed.entries.every(entry => entry.pathConfirmed));
	await host.applyBibliographicImport(confirmed, [confirmed.entries[0].key, confirmed.entries[100].key]);
	const imported = Object.values(fixture.inspect().books).filter(book => book.source).map(book => book.title).sort();
	assert.deepEqual(imported, ['Isolated import 0', 'Isolated import 100']);
	evidence.bibliography = { explicitAttachmentConfirmation: true, previewEntries: 102, selectedTitles: imported };
	const inventory = await host.recoverySnapshots();
	assert.equal(inventory.automaticCount, 3); assert.equal(inventory.count, 6);
	const count = await host.previewSnapshotCleanup({ mode: 'count', keep: 1 });
	const days = await host.previewSnapshotCleanup({ mode: 'days', keep: 1 });
	assert.equal(count.candidates.length, 2); assert.deepEqual(count.candidates.map(e => e.path), days.candidates.map(e => e.path));
	await assert.rejects(() => host.cleanupSnapshots(structuredClone(count)), /无效/);
	assert.equal(fixture.inspect().counters.removed.length, 0);
	const cleanup = await host.cleanupSnapshots(count);
	assert.equal(cleanup.deleted.length, 2); assert.equal(cleanup.failures.length, 0);
	const retained = fixture.inspect().snapshotPaths;
	assert.equal(retained.length, 5); assert(retained.some(p => p.endsWith('3-commit.json')));
	assert(['manual.json', 'before-restore.json', 'broken.json', 'archive'].every(name => retained.some(p => p.endsWith('/' + name))));
	await assert.rejects(() => host.cleanupSnapshots(count), /无效/);
	evidence.recovery = { countAndDaysPreview: true, originalPlanRequired: true, singleUse: true, deleted: cleanup.deleted, protected: retained };
	evidence.passed = true;
} finally { fixture.dispose(); }
if (process.env.RD_EVIDENCE_DIR) {
	fs.mkdirSync(process.env.RD_EVIDENCE_DIR, { recursive: true });
	fs.writeFileSync(path.join(process.env.RD_EVIDENCE_DIR, 'workflow-isolation-domain.json'), JSON.stringify(evidence, null, 2));
}
console.log(JSON.stringify(evidence, null, 2));
