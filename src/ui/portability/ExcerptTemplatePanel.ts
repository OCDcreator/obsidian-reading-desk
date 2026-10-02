import type { DataPanelHost } from './DataPanelHost';
import { PanelSection, panelElement } from './PanelSection';

export class ExcerptTemplatePanel extends PanelSection {
	private readonly input = this.control(panelElement('textarea'));
	private readonly placeholders = panelElement('p');
	private readonly preview = panelElement('pre');
	private validated: string | null = null;

	constructor(private readonly host: DataPanelHost) {
		super('摘录模板预览', 'rd-template-panel');
		this.body.append(panelElement('p', '使用固定占位符生成摘录。预览只替换占位符；模板内容不执行脚本。留空使用内置模板。'), this.placeholders);
		const label = panelElement('label', '摘录模板');
		this.input.rows = 5; this.input.maxLength = 4000;
		this.input.setAttribute('aria-label', '摘录模板');
		this.input.addEventListener('input', () => { this.validated = null; this.refreshControls(); });
		label.append(this.input);
		this.body.append(label, this.button('预览摘录模板', () => void this.renderPreview(), () => !!host.previewExcerptTemplate), this.preview,
			this.button('保存摘录模板', () => void this.save(), () => !!host.saveExcerptTemplate && this.validated === this.input.value));
		this.refreshControls(); void this.load();
	}

	private load(): Promise<void> {
		return this.run('正在读取摘录模板…', async () => {
			const state = await this.host.excerptTemplate?.();
			if (!state || this.disposed) return;
			this.input.value = state.template;
			this.placeholders.textContent = `可用占位符：${state.placeholders.map(key => `{{${key}}}`).join('、')}`;
			this.message('编辑模板后先预览，再保存。');
		});
	}

	private renderPreview(): Promise<void> {
		const template = this.input.value;
		this.validated = null;
		return this.run('正在预览摘录模板…', async () => {
			if (template.length > 4000) throw new Error('模板最多 4000 字符');
			const preview = await this.host.previewExcerptTemplate?.(template);
			if (!preview || this.disposed) return;
			this.preview.textContent = preview.text;
			if (preview.unknownPlaceholders.length) {
				this.message(`不支持的占位符：${preview.unknownPlaceholders.join('、')}。请修正后再次预览。`, true);
				return;
			}
			this.validated = template;
			this.message('模板预览通过，可以保存。');
		});
	}

	private save(): Promise<void> {
		if (this.validated !== this.input.value) return Promise.resolve();
		return this.run('正在保存摘录模板…', async () => {
			await this.host.saveExcerptTemplate?.(this.input.value);
			this.message('摘录模板已保存。');
		});
	}
}
