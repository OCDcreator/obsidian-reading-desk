import type { RepositoryStatus } from '../../data/RepositoryStatus';
import type { DataPanelHost, RecoveryPanelStatus } from './DataPanelHost';
import { PanelSection, panelElement } from './PanelSection';

const PHASE_LABEL: Record<RepositoryStatus['phase'], string> = {
	uninitialized: '尚未加载', ready: '已保存', saving: '正在保存', pending: '尚未保存，等待重试', conflict: '外部快照冲突', blocked: '数据不可写入'
};

export class RepositoryRecoveryPanel extends PanelSection {
	private repository: RepositoryStatus | null = null;
	private confirmReload = false;
	private readonly detail = panelElement('div');
	private readonly recoveries = panelElement('div');
	private readonly reload: HTMLButtonElement;

	constructor(private readonly host: DataPanelHost) {
		super('保存状态与恢复', 'rd-recovery-panel');
		this.body.append(this.detail,
			this.button('刷新保存与恢复状态', () => void this.refresh()),
			this.button('重试保存当前数据', () => void this.retry(), () => !!host.retryRepository && !!this.repository?.pending));
		this.reload = this.button('重载外部数据', () => this.requestReload(), () => !!host.reloadRepository);
		this.body.append(this.reload, this.button('取消重载确认', () => {
			this.confirmReload = false; this.reload.textContent = '重载外部数据'; this.message('已取消重载。');
		}, () => this.confirmReload), this.recoveries);
		this.refreshControls(); void this.refresh();
	}

	private refresh(): Promise<void> {
		return this.run('正在读取保存与恢复状态…', () => this.readStatus());
	}

	private async readStatus(): Promise<void> {
		const repository = await this.host.repositoryStatus?.();
		if (this.disposed) return;
		if (repository) {
			this.repository = repository; this.detail.replaceChildren();
			this.detail.append(panelElement('p', `保存状态：${PHASE_LABEL[repository.phase]} · 修订 ${repository.revision}`));
			if (repository.error) this.detail.append(panelElement('p', repository.error.message));
			for (const diagnostic of repository.diagnostics) this.detail.append(panelElement('p', `${diagnostic.path}：${diagnostic.message}`));
		}
		const recovery = await this.host.recoveryStatus?.();
		if (this.disposed) return;
		if (recovery) this.renderRecovery(recovery);
		this.message(repository?.pending ? '当前有未保存数据，请先备份并重试保存。重载可能放弃本地未保存变更。' : '状态已刷新。');
	}

	private retry(): Promise<void> {
		return this.run('正在重试保存…', async () => {
			await this.host.retryRepository?.();
			if (!this.disposed) await this.readStatus();
		});
	}

	private requestReload(): void {
		if (!this.confirmReload) {
			this.confirmReload = true;
			this.reload.textContent = '确认重载外部数据';
			this.message('重载将读取外部快照，可能放弃当前未保存变更。请先导出完整备份；再次点击确认重载，或取消。');
			this.refreshControls();
			return;
		}
		this.confirmReload = false; this.reload.textContent = '重载外部数据';
		void this.run('正在重载外部数据…', async () => {
			await this.host.reloadRepository?.();
			if (!this.disposed) await this.readStatus();
		});
	}

	private renderRecovery(recovery: RecoveryPanelStatus): void {
		this.clearContents(this.recoveries);
		this.recoveries.append(panelElement('p', `目标待写 ${recovery.pendingTargets.length} · 可恢复已删除标注 ${recovery.deletedAnnotations.length} · 目标待修复 ${recovery.repairs?.length ?? 0}`));
		const groups = [
			{ label: '重试目标写入', items: recovery.pendingTargets, action: this.host.retryTargetWrite },
			{ label: '恢复已删除标注', items: recovery.deletedAnnotations, action: this.host.restoreDeletedAnnotation },
			{ label: '重新检查目标', items: recovery.repairs ?? [], action: this.host.recheckTarget }
		];
		for (const group of groups) {
			const container = panelElement('div'); this.recoveries.append(container);
			this.pagedRows(container, group.items, group.label, item => {
				const row = panelElement('div');
				row.append(panelElement('p', `${item.label}${item.detail ? `：${item.detail}` : ''}`),
					this.button(`${group.label}：${item.label}`, () => void this.run(`正在${group.label}…`, async () => {
						await group.action?.call(this.host, item.id);
						if (!this.disposed) await this.readStatus();
					}), () => !!group.action));
				return row;
			});
		}
	}
}
