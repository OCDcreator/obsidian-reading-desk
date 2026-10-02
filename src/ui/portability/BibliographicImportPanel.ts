import type { BibliographicImportPlan, BibliographicProvider } from '../../portability/BibliographicImportService';
import type { DataPanelHost } from './DataPanelHost';
import { PanelSection, labelledInput, panelElement, readPanelFile } from './PanelSection';

const KIND_LABEL = { new: '新增', update: '更新', unchanged: '无变化', conflict: '冲突', 'no-attachment': '无附件' } as const;

export class BibliographicImportPanel extends PanelSection {
	private provider: BibliographicProvider = 'csl';
	private text = '';
	private mappings: Record<string, string> = Object.create(null) as Record<string, string>;
	private plan: BibliographicImportPlan | null = null;
	private dirty = false;
	private readonly choices = new Map<string, boolean>();
	private readonly preview = panelElement('div');
	private readonly summary = panelElement('p');

	constructor(private readonly host: DataPanelHost) {
		super('本地文献来源导入', 'rd-bibliographic-panel');
		this.body.append(panelElement('p', '选择 CSL JSON、BibTeX 或 Zotero 导出 JSON。先预览，再确认库内 PDF/EPUB 路径；仅应用已确认且无冲突的条目，无附件、未确认和冲突条目会跳过。手写题名与作者保留。'));
		const label = panelElement('label', '文献来源格式');
		const select = this.control(panelElement('select'));
		select.setAttribute('aria-label', '文献来源格式');
		for (const [value, name] of [['csl', 'CSL JSON'], ['bibtex', 'BibTeX'], ['zotero', 'Zotero JSON']]) {
			const option = panelElement('option', name); option.value = value; select.append(option);
		}
		select.value = 'csl';
		select.addEventListener('change', () => {
			this.provider = select.value as BibliographicProvider;
			this.plan = null; this.choices.clear(); this.mappings = Object.create(null) as Record<string, string>;
			this.clearContents(this.preview); this.summary.textContent = '';
			if (this.text) void this.prepare();
		});
		label.append(select); this.body.append(label);
		this.filePicker('选择文献导出文件', '.json,.bib,.bibtex,application/json,text/plain', file => this.loadFile(file));
		this.body.append(this.summary,
			this.button('选择全部可应用文献', () => this.chooseAll(true), () => !!this.plan && !this.dirty),
			this.button('取消全部文献选择', () => this.chooseAll(false), () => !!this.plan && !this.dirty),
			this.button('批量确认唯一候选附件', () => this.confirmCandidates(), () => !!this.plan && !this.dirty && !this.plan.hasErrors),
			this.preview,
			this.button('确认路径并重新预览', () => void this.prepare(), () => !!this.text && !!this.host.prepareBibliographicImport),
			this.button('确认导入文献', () => void this.apply(), () => !!this.host.applyBibliographicImport && !this.dirty && !!this.selectedKeys().length && !!this.plan && !this.plan.hasErrors));
		this.message('请选择本地文献导出文件。'); this.refreshControls();
	}

	private loadFile(file: File): Promise<void> {
		this.plan = null; this.text = ''; this.choices.clear(); this.mappings = Object.create(null) as Record<string, string>;
		this.clearContents(this.preview); this.summary.textContent = ''; this.dirty = false;
		return this.run('正在读取文献文件…', async () => {
			const text = await readPanelFile(file);
			if (this.disposed) return;
			this.text = text;
			await this.prepareNow();
		});
	}

	private prepare(): Promise<void> {
		this.plan = null;
		return this.run('正在生成文献导入预览…', () => this.prepareNow());
	}

	private async prepareNow(): Promise<void> {
		if (!this.host.prepareBibliographicImport) throw new Error('宿主尚未提供文献导入预览');
		const plan = await this.host.prepareBibliographicImport(this.provider, this.text, { ...this.mappings });
		if (this.disposed) return;
		this.plan = plan; this.dirty = false;
		this.renderPreview(plan);
		this.selectionMessage();
	}

	private renderPreview(plan: BibliographicImportPlan): void {
		this.summary.textContent = Object.entries(plan.summary).map(([kind, count]) => `${KIND_LABEL[kind as keyof typeof KIND_LABEL]} ${count}`).join(' · ');
		this.clearContents(this.preview);
		for (const diagnostic of plan.diagnostics) this.preview.append(panelElement('p', diagnostic.message));
		const entries = panelElement('div'); this.preview.append(entries);
		this.pagedRows(entries, plan.entries, '文献预览', entry => {
			const row = panelElement('div'); row.className = 'rd-data-preview-row';
			row.append(panelElement('p', `${KIND_LABEL[entry.kind]} · ${entry.record.title} · ${entry.key}`));
			const eligible = entry.pathConfirmed && ['new', 'update'].includes(entry.kind) && !plan.hasErrors;
			const label = panelElement('label', '选择导入'); const checkbox = this.control(panelElement('input'), () => eligible && !this.dirty);
			checkbox.type = 'checkbox'; checkbox.setAttribute('aria-label', `选择导入：${entry.record.title}`); checkbox.checked = eligible && this.choices.get(entry.key) !== false;
			checkbox.addEventListener('change', () => { this.choices.set(entry.key, checkbox.checked); this.selectionMessage(); this.refreshControls(); });
			label.append(checkbox); row.append(label);
			if (entry.reason) row.append(panelElement('p', entry.reason));
			if (entry.changes.length) row.append(panelElement('p', `更新字段：${entry.changes.join('、')}`));
			if (entry.protectedFields.length) row.append(panelElement('p', `保留手写字段：${entry.protectedFields.join('、')}`));
			if (entry.suggestedPaths.length) row.append(panelElement('p', `候选文件：${entry.suggestedPaths.join('；')}`));
			const { wrapper, input } = labelledInput(`关联路径：${entry.record.title}`, this.mappings[entry.key] ?? entry.path ?? entry.suggestedPaths[0] ?? '');
			this.control(input);
			input.addEventListener('input', () => {
				if (input.value.trim()) this.mappings[entry.key] = input.value.trim();
				else delete this.mappings[entry.key];
				this.dirty = true; this.refreshControls();
				this.message('路径已更改；请点击“确认路径并重新预览”，再核对导入差异。');
			});
			// Displayed suggestions remain unconfirmed until this explicit action.
			const confirm = this.button(`确认关联：${entry.record.title}`, () => {
				if (!input.value.trim()) { this.message('请输入库内 PDF/EPUB 路径。', true); return; }
				this.mappings[entry.key] = input.value.trim();
				void this.prepare();
			});
			row.append(wrapper, confirm); return row;
		});
	}

	private selectedKeys(): string[] {
		return this.plan?.entries.filter(entry => entry.pathConfirmed && ['new', 'update'].includes(entry.kind) && this.choices.get(entry.key) !== false).map(entry => entry.key) ?? [];
	}
	private selectionMessage(): void {
		const plan = this.plan; if (!plan) return;
		const count = this.selectedKeys().length;
		this.message(plan.hasErrors ? '文献输入无效，请修正后重新选择文件。' : `可应用 ${count} 条；跳过 ${plan.entries.length - count} 条（含未选择、无变化、未确认附件及冲突）。请核对后确认导入。`, plan.hasErrors);
	}
	private chooseAll(selected: boolean): void {
		if (!this.plan) return;
		for (const entry of this.plan.entries) if (entry.pathConfirmed && ['new', 'update'].includes(entry.kind)) this.choices.set(entry.key, selected);
		this.renderPreview(this.plan); this.selectionMessage(); this.refreshControls();
	}
	private confirmCandidates(): void {
		if (!this.plan) return;
		let count = 0;
		for (const entry of this.plan.entries) {
			if (entry.kind === 'conflict' || entry.pathConfirmed || entry.suggestedPaths.length !== 1 || Object.prototype.hasOwnProperty.call(this.mappings, entry.key)) continue;
			this.mappings[entry.key] = entry.suggestedPaths[0]; count++;
		}
		if (count) void this.prepare(); else this.message('没有可批量确认的唯一候选；多个候选或无匹配文件的条目需要逐项核对。');
	}

	private apply(): Promise<void> {
		const plan = this.plan;
		const selected = this.selectedKeys();
		if (!plan || this.dirty || plan.hasErrors || !selected.length || !this.host.applyBibliographicImport) return Promise.resolve();
		return this.run('正在导入文献…', async () => {
			await this.host.applyBibliographicImport?.(plan, selected);
			if (this.disposed) return;
			this.plan = null;
			this.message(`已应用 ${selected.length} 条文献，跳过 ${plan.entries.length - selected.length} 条。再次预览会核对重复导入。`);
		});
	}
}
