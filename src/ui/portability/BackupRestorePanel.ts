import { BACKUP_CAPACITY_MESSAGE, MAX_BACKUP_BYTES } from '../../portability/BackupCapacity';
import type { BackupPanelOptions, BackupPanelPreview, DataPanelHost, ExportContent } from './DataPanelHost';
import { PanelSection, labelledInput, panelElement, readPanelFile } from './PanelSection';

const POLICY_LABEL = { error: '遇到冲突时停止', 'keep-current': '保留当前数据', 'use-backup': '使用备份数据' } as const;

export class BackupRestorePanel extends PanelSection {
	private text = '';
	private mappings: Record<string, string> = Object.create(null) as Record<string, string>;
	private plan: BackupPanelPreview | null = null;
	private dirty = false;
	private confirmPending = false;
	private readonly options: Required<Pick<BackupPanelOptions, 'mode' | 'conflictPolicy'>> = { mode: 'replace', conflictPolicy: 'use-backup' };
	private decisions: NonNullable<BackupPanelOptions['objectDecisions']> = {};
	private readonly preview = panelElement('div');
	private readonly modeNotice = panelElement('p');
	private readonly acknowledgement = panelElement('input');
	private readonly restoreButton: HTMLButtonElement;
	private readonly cancelButton: HTMLButtonElement;

	constructor(private readonly host: DataPanelHost, private readonly download: (content: ExportContent, filename: string) => void) {
		super('完整备份与恢复', 'rd-backup-panel');
		this.body.append(panelElement('p', '完整备份仅包含 Reading Desk 插件数据：书目、标注、评论、摘录状态与必要配置。不包含 PDF/EPUB、原生目标文件或其他插件数据，不是整个 vault 的备份。恢复前请另行备份这些文件，导出当前插件数据并核对差异与路径映射；恢复会先保存当前插件数据备份，失败时停止应用。'));
		this.body.append(this.button('导出完整备份', () => void this.export(), () => !!host.exportBackup));
		this.buildOptions();
		if (host.previewBackup) this.filePicker('选择 Reading Desk 完整备份文件', '.json,application/json', file => this.loadFile(file));
		this.body.append(this.preview, this.button('重新预览恢复差异', () => void this.prepare(), () => !!this.text && !!host.previewBackup));
		const label = panelElement('label', '我已备份当前数据，并核对恢复差异与路径映射');
		this.acknowledgement.type = 'checkbox';
		this.acknowledgement.setAttribute('aria-label', '我已备份当前数据，并核对恢复差异与路径映射');
		this.acknowledgement.addEventListener('change', () => { this.cancelConfirmation(false); this.refreshControls(); });
		this.control(this.acknowledgement); label.append(this.acknowledgement);
		this.restoreButton = this.button('确认恢复完整备份', () => this.requestRestore(),
			() => !!this.host.restoreBackup && !!this.plan?.canApply && !this.dirty && this.acknowledgement.checked);
		this.cancelButton = this.button('取消恢复确认', () => { this.cancelConfirmation(); this.message('已取消恢复确认。'); this.refreshControls(); }, () => this.confirmPending);
		this.cancelButton.hidden = true;
		this.body.append(label, this.restoreButton, this.cancelButton);
		this.message('选择完整备份文件后会先显示恢复预览。'); this.refreshControls();
	}

	/** Recovery-index selection only previews; the existing double confirmation still applies. */
	loadSnapshot(text: string): Promise<void> {
		this.plan = null; this.text = text; this.dirty = false; this.cancelConfirmation(); this.decisions = {};
		this.mappings = Object.create(null) as Record<string, string>; this.clearContents(this.preview);
		return this.run('正在预览所选恢复快照…', () => this.prepareNow());
	}

	private buildOptions(): void {
		const mode = this.select('恢复模式', [['replace', '完整替换当前插件数据'], ['merge', '合并到当前插件数据']], this.options.mode);
		const policy = this.select('恢复冲突处理', [['error', '遇到冲突时停止'], ['keep-current', '保留当前数据'], ['use-backup', '使用备份数据']], this.options.conflictPolicy);
		mode.addEventListener('change', () => {
			this.options.mode = mode.value as Required<BackupPanelOptions>['mode'];
			this.options.conflictPolicy = this.options.mode === 'merge' ? 'error' : 'use-backup';
			policy.value = this.options.conflictPolicy;
			this.optionsChanged();
		});
		policy.addEventListener('change', () => {
			this.options.conflictPolicy = policy.value as Required<BackupPanelOptions>['conflictPolicy'];
			this.optionsChanged();
		});
		this.body.append(this.modeNotice); this.updateModeNotice();
	}

	private select(label: string, values: string[][], selected: string): HTMLSelectElement {
		const wrapper = panelElement('label', label);
		const select = this.control(panelElement('select'), () => !!this.host.previewBackup);
		select.setAttribute('aria-label', label);
		for (const [value, text] of values) { const option = panelElement('option', text); option.value = value; select.append(option); }
		select.value = selected; wrapper.append(select); this.body.append(wrapper);
		return select;
	}

	private optionsChanged(): void {
		this.plan = null; this.dirty = true; this.cancelConfirmation(); this.updateModeNotice();
		if (this.text) void this.prepare();
		else { this.message('请选择备份文件，随后按当前模式生成恢复差异。'); this.refreshControls(); }
	}

	private updateModeNotice(): void {
		const mode = this.options.mode === 'replace'
			? '完整替换将覆盖当前插件数据，包括移除仅存在于当前数据的项目。'
			: '合并将保留当前数据并导入备份项目；同 ID 内容不同视为冲突。';
		this.modeNotice.textContent = `${mode}冲突处理：${POLICY_LABEL[this.options.conflictPolicy]}。应用前自动备份本机当前插件数据，备份失败则停止；请在预览中核对实际新增、更新、删除。`;
	}

	private cancelConfirmation(clearAcknowledgement = true): void {
		this.confirmPending = false;
		if (clearAcknowledgement) this.acknowledgement.checked = false;
		this.restoreButton.textContent = '确认恢复完整备份';
		this.restoreButton.setAttribute('aria-label', '确认恢复完整备份');
		this.cancelButton.hidden = true;
	}

	private export(): Promise<void> {
		return this.run('正在导出完整备份…', async () => {
			const content = await this.host.exportBackup?.();
			if (content === undefined || this.disposed) return;
			this.download(content, `reading-desk-完整备份-${new Date().toISOString().slice(0, 10)}.json`);
			this.message('完整备份已开始下载。请确认文件已保存，再进行恢复。');
		});
	}

	private loadFile(file: File): Promise<void> {
		this.plan = null; this.text = ''; this.dirty = false; this.cancelConfirmation(); this.decisions = {};
		this.mappings = Object.create(null) as Record<string, string>; this.clearContents(this.preview);
		return this.run('正在读取完整备份…', async () => {
			const text = await readPanelFile(file, { bytes: MAX_BACKUP_BYTES, message: BACKUP_CAPACITY_MESSAGE });
			if (this.disposed) return;
			this.text = text; await this.prepareNow();
		});
	}

	private prepare(): Promise<void> {
		this.plan = null; this.cancelConfirmation();
		return this.run('正在生成恢复预览…', () => this.prepareNow());
	}

	private async prepareNow(): Promise<void> {
		if (!this.host.previewBackup) throw new Error('宿主尚未提供完整备份预览');
		const plan = await this.host.previewBackup(this.text, { ...this.mappings }, { ...this.options, ...(Object.keys(this.decisions).length ? { objectDecisions: { ...this.decisions } } : {}) });
		if (this.disposed) return;
		this.plan = plan; this.dirty = false; this.clearContents(this.preview);
		for (const text of [...plan.summary, ...plan.warnings]) this.preview.append(panelElement('p', text));
		this.renderObjects(plan);
		const paths = panelElement('div'); this.preview.append(paths);
		this.pagedRows(paths, plan.paths, '恢复路径预览', path => {
			const row = panelElement('div'); row.className = 'rd-data-preview-row';
			row.append(panelElement('p', `${path.kind ?? '路径'}：${path.originalPath} → ${path.mappedPath ?? path.originalPath}`));
			const { wrapper, input } = labelledInput(`恢复路径：${path.originalPath}`, this.mappings[path.key] ?? path.mappedPath ?? path.originalPath);
			this.control(input);
			input.addEventListener('input', () => {
				if (input.value.trim()) this.mappings[path.key] = input.value.trim(); else delete this.mappings[path.key];
				this.dirty = true; this.cancelConfirmation(); this.refreshControls();
				this.message('路径已更改，请重新预览恢复差异。');
			});
			row.append(wrapper); return row;
		});
		this.message(plan.canApply ? '请核对恢复差异，备份当前数据并勾选确认后应用。' : '存在阻止恢复的冲突或无效数据，请选择冲突处理规则或修正后重新预览。', !plan.canApply);
	}

	private renderObjects(plan: BackupPanelPreview): void {
		if (!plan.objects?.length) return;
		this.preview.append(panelElement('p', '逐项恢复决策：同一标注的高亮、评论、卡片、待写意图和删除记录一起选择，避免引用断开。'));
		const rows = panelElement('div'); this.preview.append(rows);
		const labels: Record<string, string> = { books: '图书', annotations: '标注与评论', categories: '分类', lists: '阅读列表', settings: '设置' };
		this.pagedRows(rows, plan.objects, '恢复对象差异', object => {
			const row = panelElement('div'); row.className = 'rd-data-preview-row';
			row.append(panelElement('p', `${labels[object.collection] ?? object.collection} · ${object.label} · ${object.fields.join('、')}`));
			const select = this.control(panelElement('select')); select.setAttribute('aria-label', `恢复决策：${object.key}`);
			for (const [value, text] of [['', '按整体规则'], ['keep-current', '保留当前对象'], ['use-backup', '使用备份对象']]) { const option = panelElement('option', text); option.value = value; select.append(option); }
			select.value = this.decisions[object.key] ?? '';
			select.addEventListener('change', () => {
				if (select.value) this.decisions[object.key] = select.value as 'keep-current' | 'use-backup'; else delete this.decisions[object.key];
				this.dirty = true; this.cancelConfirmation(); this.refreshControls(); this.message('逐项决策已更改，请重新预览恢复差异。');
			});
			const details = panelElement('details'); details.append(panelElement('summary', '查看当前与备份内容'), panelElement('p', '当前'), panelElement('pre', object.currentSummary), panelElement('p', '备份'), panelElement('pre', object.backupSummary));
			row.append(select, details); return row;
		});
	}

	private requestRestore(): void {
		if (!this.plan?.canApply || this.dirty || !this.acknowledgement.checked || !this.host.restoreBackup) return;
		if (!this.confirmPending) {
			this.confirmPending = true;
			this.restoreButton.textContent = '再次确认恢复完整备份';
			this.restoreButton.setAttribute('aria-label', '再次确认恢复完整备份');
			this.cancelButton.hidden = false;
			this.message(`即将${this.options.mode === 'replace' ? '完整替换当前插件数据' : '合并插件数据'}；冲突按“${POLICY_LABEL[this.options.conflictPolicy]}”处理。应用前会自动备份，请再次点击确认或取消。`);
			this.refreshControls(); return;
		}
		void this.restore();
	}

	private restore(): Promise<void> {
		const plan = this.plan;
		if (!plan?.canApply || this.dirty || !this.acknowledgement.checked || !this.confirmPending || !this.host.restoreBackup) return Promise.resolve();
		this.cancelConfirmation(false);
		return this.run('正在备份当前数据并恢复…', async () => {
			await this.host.restoreBackup?.(plan);
			if (this.disposed) return;
			this.plan = null; this.cancelConfirmation();
			this.message('已自动备份恢复前的本机插件数据，Reading Desk 插件数据恢复完成。PDF/EPUB 与原生目标文件需另行准备；请刷新书架并核对文件、标注与目标状态。');
		});
	}
}
