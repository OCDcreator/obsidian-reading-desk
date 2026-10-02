import type { RecoveryCleanupPreview, RecoveryRetentionPolicy, RecoverySnapshotEntry } from '../../portability/RecoverySnapshotService';
import type { DataPanelHost } from './DataPanelHost';
import { PanelSection, labelledInput, panelElement } from './PanelSection';

/** Lists protected recovery files; deletion always requires an original, fresh plan. */
export class RecoverySnapshotPanel extends PanelSection {
	private readonly inventory = panelElement('div');
	private readonly preview = panelElement('div');
	private readonly policy: RecoveryRetentionPolicy = { mode: 'count', keep: 30 };
	private plan: RecoveryCleanupPreview | null = null;
	private confirming = false;
	private readonly cleanupButton: HTMLButtonElement;
	constructor(private readonly host: DataPanelHost, private readonly selectRestore: (text: string) => Promise<void>) {
		super('恢复快照管理', 'rd-recovery-snapshots');
		this.body.append(panelElement('p', '查看插件私有恢复快照。清理只删除已识别的旧自动快照，始终保护最新可用快照、恢复前备份、手工文件和归档目录。选择快照只生成恢复预览。'));
		this.body.append(this.button('刷新快照清单', () => void this.load(), () => !!host.recoverySnapshots), this.inventory);
		const label = panelElement('label', '自动快照保留策略');
		const mode = this.control(panelElement('select'));
		mode.setAttribute('aria-label', '自动快照保留策略');
		for (const [value, text] of [['count', '按数量保留最新快照'], ['days', '保留最近若干天']]) { const option = panelElement('option', text); option.value = value; mode.append(option); }
		mode.value = 'count'; mode.addEventListener('change', () => { this.policy.mode = mode.value as RecoveryRetentionPolicy['mode']; this.invalidate(); });
		const { wrapper, input } = labelledInput('保留数量或天数', '30');
		input.type = 'number'; input.min = '1'; input.max = '10000'; this.control(input);
		input.addEventListener('input', () => { this.policy.keep = Number(input.value); this.invalidate(); });
		label.append(mode); this.body.append(label, wrapper);
		this.body.append(this.button('预览快照清理', () => void this.prepare(), () => !!host.previewSnapshotCleanup), this.preview);
		this.cleanupButton = this.button('确认清理旧自动快照', () => void this.cleanup(), () => !!this.plan?.candidates.length && !!host.cleanupSnapshots);
		this.body.append(this.cleanupButton, this.button('取消快照清理', () => { this.invalidate(); this.message('已取消快照清理。'); }, () => this.confirming));
		this.message('点击“刷新快照清单”查看数量、占用空间与可恢复原件。'); this.refreshControls();
	}
	private invalidate(): void {
		this.plan = null; this.confirming = false; this.clearContents(this.preview);
		this.cleanupButton.textContent = '确认清理旧自动快照'; this.cleanupButton.setAttribute('aria-label', '确认清理旧自动快照'); this.refreshControls();
	}
	private load(): Promise<void> {
		this.invalidate();
		return this.run('正在读取恢复快照…', () => this.loadNow());
	}
	private async loadNow(): Promise<void> {
		const inventory = await this.host.recoverySnapshots?.(); if (!inventory || this.disposed) return;
		this.clearContents(this.inventory);
		this.inventory.append(panelElement('p', `${inventory.count} 个文件，共 ${formatBytes(inventory.bytes)}；其中 ${inventory.automaticCount} 个自动快照。`));
		if (!inventory.entries.length) this.inventory.append(panelElement('p', '尚无恢复快照。插件下次覆盖已有数据前会自动保护原件。'));
		const rows = panelElement('div'); this.inventory.append(rows);
		this.pagedRows(rows, inventory.entries, '恢复快照清单', entry => this.snapshotRow(entry));
		this.message('已读取清单。可选择快照预览恢复，或先预览旧自动快照清理。');
	}
	private snapshotRow(entry: RecoverySnapshotEntry): HTMLElement {
		const row = panelElement('div'); row.className = 'rd-data-preview-row';
		row.append(panelElement('p', entry.name), panelElement('p', `${formatBytes(entry.bytes)} · ${new Date(entry.modifiedAt).toLocaleString()} · ${entry.protectedReason ?? '旧自动快照，可按策略清理'}`));
		row.append(this.button(`预览恢复：${entry.name}`, () => void this.run('正在载入快照恢复预览…', async () => {
			const text = await this.host.loadRecoverySnapshot?.(entry);
			if (text !== undefined && !this.disposed) { await this.selectRestore(text); this.message('快照已载入下方完整备份恢复预览；尚未改变当前数据。'); }
		}), () => entry.canRestore && !!this.host.loadRecoverySnapshot));
		return row;
	}
	private prepare(): Promise<void> {
		this.invalidate();
		return this.run('正在预览快照清理…', async () => {
			const plan = await this.host.previewSnapshotCleanup?.({ ...this.policy }); if (!plan || this.disposed) return;
			this.plan = plan;
			this.preview.append(panelElement('p', `将删除 ${plan.candidates.length} 个旧自动快照，释放 ${formatBytes(plan.bytes)}；保护 ${plan.protectedCount} 项。`));
			const rows = panelElement('div'); this.preview.append(rows);
			this.pagedRows(rows, plan.candidates, '待清理快照', entry => panelElement('p', `${entry.name} · ${formatBytes(entry.bytes)}`));
			this.message(plan.candidates.length ? '请核对文件清单；确认后还需再次点击才会删除。' : '当前策略没有可清理的旧自动快照。');
		});
	}
	private async cleanup(): Promise<void> {
		if (!this.plan?.candidates.length || !this.host.cleanupSnapshots) return;
		if (!this.confirming) {
			this.confirming = true; this.cleanupButton.textContent = '再次确认删除旧自动快照'; this.cleanupButton.setAttribute('aria-label', '再次确认删除旧自动快照');
			this.message('即将删除预览中的旧自动快照；请再次确认或取消。'); this.refreshControls(); return;
		}
		const plan = this.plan;
		await this.run('正在清理旧自动快照…', async () => {
			const result = await this.host.cleanupSnapshots?.(plan); if (!result || this.disposed) return;
			this.invalidate(); await this.loadNow();
			for (const failure of result.failures) this.preview.append(panelElement('p', `${failure.path}：${failure.message}`));
			this.message(`已删除 ${result.deleted.length} 个快照；${result.failures.length} 项未删除。${result.failures.length ? '请查看原因并重新预览。' : '受保护原件已保留。'}`, !!result.failures.length);
		});
	}
}
function formatBytes(bytes: number): string { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MiB` : `${Math.ceil(bytes / 1024)} KiB`; }
