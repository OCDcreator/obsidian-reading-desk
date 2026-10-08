import { PluginSettingTab, setIcon, Setting } from 'obsidian';
import { hostThemeDark, marginAnchorIconId, observeHostTheme } from '../ui/icons/ReadingDeskIcons';
import type ReadingDeskPlugin from '../main';
import { ObjectStorageConfigurationError, ObjectStorageRequestError } from '../storage/ObjectStorageService';
import { SettingSaveFeedback } from './SettingSaveFeedback';
import { ImportExportPanel } from '../ui/portability/ImportExportPanel';

const CONNECTION_HINTS: Record<string, string> = {
	'storage-disabled': '对象存储未启用',
	'image-host-disabled': 'Markdown 图床未启用',
	'missing-endpoint': '缺少 Endpoint',
	'missing-region': '腾讯云 COS 缺少 Region',
	'missing-bucket': '缺少 Bucket',
	'missing-access-key-id': '缺少 Access Key',
	'missing-secret-access-key': '缺少 Secret Key'
};

const TAB_STORAGE_KEY = 'reading-desk-settings-tab';

interface SettingsTabDefinition {
	key: string;
	label: string;
	ariaLabel: string;
	icon: string;
}

/** Tab order is the settings information architecture; keys persist per vault. */
const SETTINGS_TABS: readonly SettingsTabDefinition[] = [
	{ key: 'library', label: '书库', ariaLabel: '书库设置', icon: 'library' },
	{ key: 'reader', label: '阅读', ariaLabel: '阅读器设置', icon: 'book-open' },
	{ key: 'storage', label: '存储与图床', ariaLabel: '对象存储与图床设置', icon: 'cloud-upload' },
	{ key: 'ai', label: 'AI 集成', ariaLabel: '可选 AI 集成设置', icon: 'sparkles' },
	{ key: 'data', label: '数据与迁移', ariaLabel: '导入导出与迁移设置', icon: 'arrow-down-up' }
];

export class ReadingDeskSettingTab extends PluginSettingTab {
	private portabilityPanel: ImportExportPanel | null = null;
	private activeTab = 'library';
	private panel?: HTMLElement;
	private tabButtons = new Map<string, HTMLButtonElement>();
	private headingIcon?: HTMLElement;
	private readonly saves = new WeakMap<HTMLElement, SettingSaveFeedback>();
	private stopHeadingIconSync: (() => void) | null = null;

	constructor(private readonly readingDesk: ReadingDeskPlugin) {
		super(readingDesk.app, readingDesk);
		this.activeTab = this.restoreTab();
	}

	display(): void {
		const { containerEl } = this;
		this.portabilityPanel?.destroy();
		this.portabilityPanel = null;
		this.tabButtons.clear();
		const hint = this.readingDesk.consumeSettingsTabHint();
		if (hint && SETTINGS_TABS.some(item => item.key === hint)) this.activeTab = hint;
		containerEl.empty();
		this.stopHeadingIconSync?.();
		this.stopHeadingIconSync = null;
		containerEl.addClass('reading-desk-settings');
		const layout = containerEl.createDiv({ cls: 'rd-settings-layout' });
		const sidebar = layout.createDiv({ cls: 'rd-settings-sidebar' });
		sidebar.createDiv({ cls: 'rd-settings-brand', text: 'Reading Desk' });
		const nav = sidebar.createDiv({ cls: 'rd-settings-nav', attr: { role: 'tablist', 'aria-label': '设置分类' } });
		for (const definition of SETTINGS_TABS) nav.append(this.createTabButton(definition));
		sidebar.createDiv({ cls: 'rd-settings-foot', text: `Margin ${this.readingDesk.manifest.version}` });
		const main = layout.createDiv({ cls: 'rd-settings-main' });
		const head = main.createDiv({ cls: 'rd-settings-main-head' });
		const heading = head.createDiv({ cls: 'rd-setting-heading-row' });
		this.headingIcon = heading.createSpan({ cls: 'rd-setting-heading-icon', attr: { 'aria-hidden': 'true' } });
		this.syncHeadingIcon();
		this.stopHeadingIconSync = observeHostTheme(containerEl.ownerDocument, () => this.syncHeadingIcon());
		heading.createEl('h2', { cls: 'rd-setting-heading', text: 'Reading Desk 设置' });
		head.createEl('p', { cls: 'rd-setting-intro', text: '书架、阅读器和标注共用同一份本地数据。' });
		this.panel = main.createDiv({ cls: 'rd-settings-panel', attr: { role: 'tabpanel', tabindex: '0', id: 'rd-settings-panel' } });
		this.renderActiveTab();
	}

	onClose(): void {
		this.portabilityPanel?.destroy();
		this.portabilityPanel = null;
		this.stopHeadingIconSync?.();
		this.stopHeadingIconSync = null;
	}

	private syncHeadingIcon(): void {
		const icon = this.headingIcon;
		if (!icon) return;
		setIcon(icon, marginAnchorIconId(hostThemeDark(icon.ownerDocument)));
	}

	private createTabButton(definition: SettingsTabDefinition): HTMLButtonElement {
		const selected = this.activeTab === definition.key;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'rd-settings-tab';
		const icon = button.createSpan({ cls: 'rd-settings-tab-icon', attr: { 'aria-hidden': 'true' } });
		setIcon(icon, definition.icon);
		button.createSpan({ cls: 'rd-settings-tab-label', text: definition.label });
		button.id = `rd-settings-tab-${definition.key}`;
		button.setAttribute('role', 'tab');
		button.setAttribute('aria-selected', String(selected));
		button.setAttribute('aria-controls', 'rd-settings-panel');
		button.setAttribute('aria-label', definition.ariaLabel);
		button.tabIndex = selected ? 0 : -1;
		button.addEventListener('click', () => this.switchTab(definition.key));
		button.addEventListener('keydown', event => {
			// The nav stacks vertically in the sidebar and runs horizontally in the
			// narrow fallback, so all four arrows page through the same order.
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			event.preventDefault();
			const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
			const index = SETTINGS_TABS.findIndex(item => item.key === this.activeTab);
			const next = SETTINGS_TABS[(index + delta + SETTINGS_TABS.length) % SETTINGS_TABS.length];
			this.switchTab(next.key);
			this.tabButtons.get(next.key)?.focus();
		});
		this.tabButtons.set(definition.key, button);
		return button;
	}

	private switchTab(key: string): void {
		if (this.activeTab === key) return;
		this.activeTab = key;
		try { window.localStorage.setItem(TAB_STORAGE_KEY, key); } catch { /* Storage can be unavailable in private windows. */ }
		for (const [tabKey, button] of this.tabButtons) {
			const selected = tabKey === key;
			button.setAttribute('aria-selected', String(selected));
			button.tabIndex = selected ? 0 : -1;
		}
		this.renderActiveTab();
	}

	private restoreTab(): string {
		try {
			const saved = window.localStorage.getItem(TAB_STORAGE_KEY);
			if (saved && SETTINGS_TABS.some(item => item.key === saved)) return saved;
		} catch { /* Storage can be unavailable in private windows. */ }
		return 'library';
	}

	private renderActiveTab(): void {
		const panel = this.panel;
		if (!panel) return;
		this.portabilityPanel?.destroy();
		this.portabilityPanel = null;
		panel.replaceChildren();
		panel.setAttribute('aria-labelledby', `rd-settings-tab-${this.activeTab}`);
		switch (this.activeTab) {
			case 'reader': this.renderReaderSection(panel); break;
			case 'storage': this.renderStorageSection(panel); break;
			case 'ai': this.renderAiSection(panel); break;
			case 'data': this.renderDataSection(panel); break;
			default: this.renderLibrarySection(panel); break;
		}
	}

	/** shadcn-style card: bordered group whose rows are divided by hairlines. */
	private createCard(parent: HTMLElement, title: string, description?: string): HTMLElement {
		const card = parent.createDiv({ cls: 'rd-card' });
		const header = card.createDiv({ cls: 'rd-card-header' });
		header.createDiv({ cls: 'rd-card-title', text: title });
		if (description) header.createDiv({ cls: 'rd-card-desc', text: description });
		return card.createDiv({ cls: 'rd-card-content' });
	}

	private renderLibrarySection(panel: HTMLElement): void {
		const content = this.createCard(panel, '书库文件夹', 'Reading Desk 从这些文件夹自动发现 PDF 与 EPUB。');
		new Setting(content)
			.setName('文件夹列表')
			.setDesc('用英文逗号分隔；修改后从书架「扫描书库」或命令面板重新扫描。')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', '书库文件夹');
				return text.setValue(this.readingDesk.repository.readSettings().libraryFolders.join(', ')).onChange(value => this.save(text.inputEl, () => this.readingDesk.repository.updateSettings({ libraryFolders: value.split(',').map(item => item.trim()).filter(Boolean) })));
			});
		this.renderEnrichmentSection(panel);
	}

	private renderEnrichmentSection(panel: HTMLElement): void {
		const settings = { enabled: true, autoNewBooks: true, reviewAll: false, ...this.readingDesk.repository.readSettings().metadataEnrichment };
		const blocked = settings.blockedUntil !== undefined && settings.blockedUntil > Date.now();
		const content = this.createCard(panel, '豆瓣元数据', '从 book.douban.com 补全作者、评分与封面；只补空白字段，从不覆盖人工修改；低置信结果在书卡上标记「待确认」。');
		new Setting(content).setName('启用豆瓣刮削').setDesc('串行低速请求豆瓣公开页面；当日被限流（HTTP 403）后自动暂停，明天恢复。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用豆瓣刮削');
				return toggle.setValue(settings.enabled).onChange(enabled => this.save(toggle.toggleEl, () => this.readingDesk.updateEnrichmentSettings({ enabled })));
			});
		new Setting(content).setName('新书自动刮削').setDesc(settings.enabled ? '扫描入库、缺少书目来源的新书自动进入刮削队列。' : '需先启用豆瓣刮削。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '新书自动刮削');
				return toggle.setValue(settings.autoNewBooks).setDisabled(!settings.enabled).onChange(autoNewBooks => this.save(toggle.toggleEl, () => this.readingDesk.updateEnrichmentSettings({ autoNewBooks })));
			});
		new Setting(content).setName('全部标记待确认').setDesc('即使是高置信命中，也在书卡上标记「待确认」，由你逐本核对。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '全部标记待确认');
				return toggle.setValue(settings.reviewAll).setDisabled(!settings.enabled).onChange(reviewAll => this.save(toggle.toggleEl, () => this.readingDesk.updateEnrichmentSettings({ reviewAll })));
			});
		const action = new Setting(content).setName('刮削缺失信息的书目')
			.setDesc(blocked ? '今日已被豆瓣限流（HTTP 403），明天自动恢复。' : '为缺作者、缺封面或标题仍是文件名的存量书目逐本刮削；已有人工内容不受影响。');
		action.addButton(button => {
			button.buttonEl.setAttribute('aria-label', '刮削缺失信息的书目');
			return button.setButtonText('开始刮削').setDisabled(!settings.enabled || blocked).onClick(async () => {
				button.setDisabled(true).setButtonText('刮削中…');
				try {
					const summary = await this.readingDesk.enrichMissingMetadata();
					action.setDesc(summary.blocked ? '豆瓣限流，今日暂停；已命中的书目已更新。' : `完成：命中 ${summary.matched}，未找到 ${summary.missed}，失败 ${summary.failed}，跳过 ${summary.skipped}。`);
				} catch (error) {
					action.setDesc(`刮削失败：${error instanceof Error ? error.message : String(error)}`);
				} finally {
					button.setDisabled(false).setButtonText('开始刮削');
				}
			});
		});
	}

	private renderReaderSection(panel: HTMLElement): void {
		const viewer = this.readingDesk.repository.readSettings().viewer;
		const content = this.createCard(panel, '阅读偏好', '目录样式即时作用于已打开的 PDF 导航；滚动模式与夜间纸面反相对新打开的阅读器生效，已打开的阅读器可在其工具栏「显示选项」中即时调整。');
		new Setting(content).setName('目录样式').setDesc('控制 PDF 导航中的章节层级呈现，不改变 PDF 或摘录数据。')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', '目录样式');
				return dropdown.addOption('tree', '级联树').addOption('bullet', '子弹线')
					.setValue(viewer.outlineStyle)
					.onChange(outlineStyle => this.save(dropdown.selectEl, () => this.readingDesk.updateViewerSettings({ outlineStyle: outlineStyle as 'tree' | 'bullet' })));
			});
		new Setting(content).setName('滚动模式').setDesc('连续滚动把整本书排成一条虚拟长卷；单页一次只显示一页。')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', '滚动模式');
				return dropdown.addOption('continuous', '连续滚动').addOption('single', '单页')
					.setValue(viewer.scrollMode)
					.onChange(scrollMode => this.save(dropdown.selectEl, () => this.readingDesk.updateViewerSettings({ scrollMode: scrollMode as 'continuous' | 'single' })));
			});
		new Setting(content).setName('夜间纸面反相').setDesc('在深色主题下把 PDF 纸面反相为夜间阅读底色，界面本身不受影响。')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', '夜间纸面反相');
				return dropdown.addOption('auto', '跟随主题').addOption('on', '始终开启').addOption('off', '始终关闭')
					.setValue(viewer.invertPdf)
					.onChange(invertPdf => this.save(dropdown.selectEl, () => this.readingDesk.updateViewerSettings({ invertPdf: invertPdf as 'auto' | 'on' | 'off' })));
			});
	}

	private renderStorageSection(panel: HTMLElement): void {
		const storage = this.readingDesk.repository.readSettings().storage;
		const imageHost = this.createCard(panel, 'Markdown 图床', '开启后在 Markdown 编辑器粘贴图片时自动上传，并以外链插入。');
		new Setting(imageHost).setName('启用对象存储').setDesc('裁剪图片与图床上传的总开关；凭据保存在本地插件数据中。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用对象存储');
				return toggle.setValue(storage.enabled).onChange(enabled => this.save(toggle.toggleEl, async () => { await this.readingDesk.updateStorageSettings({ enabled }); this.refreshStorageAvailability(panel, enabled); }));
			});
		new Setting(imageHost).setName('接管 Markdown 粘贴').setDesc(storage.enabled ? '粘贴图片时上传并插入外链。' : '需先启用对象存储。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用 Markdown 图床');
				return toggle.setValue(storage.imageHostEnabled).setDisabled(!storage.enabled).onChange(imageHostEnabled => this.save(toggle.toggleEl, () => this.readingDesk.updateStorageSettings({ imageHostEnabled })));
			});
		const credentials = this.createCard(panel, '对象存储凭据', '填写 OSS 或 COS 的访问信息，可先用只读请求测试连通。');
		const regionRow = new Setting(credentials).setName('Region').setDesc('仅腾讯云 COS 需要。')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Region');
				text.inputEl.placeholder = 'ap-guangzhou';
				return text.setValue(storage.region).onChange(value => this.save(text.inputEl, () => this.readingDesk.updateStorageSettings({ region: value })));
			});
		regionRow.settingEl.hidden = storage.provider !== 'cos';
		new Setting(credentials).setName('提供商')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', '对象存储提供商');
				return dropdown.addOption('oss', '阿里云 OSS').addOption('cos', '腾讯云 COS')
					.setValue(storage.provider).setDisabled(!storage.enabled)
					.onChange(provider => this.save(dropdown.selectEl, async () => {
						await this.readingDesk.updateStorageSettings({ provider: provider as 'oss' | 'cos' });
						regionRow.settingEl.hidden = provider !== 'cos';
					}));
			});
		this.addStorageText(credentials, 'Endpoint', 'endpoint', false, 'https://oss-cn-hangzhou.aliyuncs.com');
		this.addStorageText(credentials, 'Bucket', 'bucket', false, 'reading-desk');
		this.addStorageText(credentials, '对象存储路径', 'prefix', false, 'reading-desk/');
		this.addStorageText(credentials, 'Access Key', 'accessKeyId');
		this.addStorageText(credentials, 'Secret Key', 'secretAccessKey', true);
		const testSetting = new Setting(credentials).setName('测试连接').setDesc(storage.enabled ? '发送已签名的只读请求；不会上传文件。' : '先启用对象存储并填写凭据后才可测试。');
		testSetting
			.addButton(button => { button.buttonEl.setAttribute('aria-label', '测试连接'); return button.setButtonText('测试连接').setDisabled(!storage.enabled).onClick(async () => {
				button.setDisabled(true).setButtonText('测试中…');
				testSetting.descEl.className = 'rd-setting-desc';
				try {
					const result = await this.readingDesk.testStorageConnection();
					testSetting.setDesc(`连接成功：HTTP ${result.status}，${result.endpoint}`);
					testSetting.descEl.className = 'rd-setting-result is-success';
				} catch (error) {
					testSetting.setDesc(describeConnectionFailure(error));
					testSetting.descEl.className = 'rd-setting-result is-error';
				} finally {
					button.setDisabled(false).setButtonText('测试连接');
				}
			}); });
	}

	private renderAiSection(panel: HTMLElement): void {
		const ai = this.readingDesk.ai.availability();
		const content = this.createCard(panel, 'AI 选区对话', ai.reason);
		new Setting(content).setName('发送当前选区')
			.setDesc('在阅读器中选中原文后，通过命令「将当前 Reading Desk 选区交给 AI」把上下文交给已启用的兼容插件。')
			.addButton(button => button.setButtonText('发送当前选区').setDisabled(!ai.available).onClick(() => this.readingDesk.notice('在阅读器中选中原文后，使用命令面板“将当前 Reading Desk 选区交给 AI”。')));
	}

	private renderDataSection(panel: HTMLElement): void {
		const content = this.createCard(panel, '导入与导出', '导入只读取旧数据并新建文件，不会覆盖仓库内容。');
		const portability = content.createDiv({ cls: 'rd-settings-portability' });
		this.portabilityPanel = new ImportExportPanel(this.readingDesk.dataPanelHost());
		this.portabilityPanel.render(portability);
	}

	private save(control: HTMLElement, operation: () => Promise<unknown>): Promise<void> {
		const row = control.closest<HTMLElement>('.setting-item') ?? control.parentElement ?? control;
		let feedback = this.saves.get(row);
		if (!feedback) { feedback = new SettingSaveFeedback(row); this.saves.set(row, feedback); }
		return feedback.save(operation);
	}

	/** Enable dependent controls in place after the switch was persisted. */
	private refreshStorageAvailability(panel: HTMLElement, enabled: boolean): void {
		for (const label of ['启用 Markdown 图床', '对象存储提供商', '测试连接']) {
			const control = panel.querySelector<HTMLElement>('[aria-label="' + label + '"]');
			if (!control) continue;
			control.setAttribute('aria-disabled', String(!enabled));
			if (control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) control.disabled = !enabled;
			else {
				control.classList.toggle('is-disabled', !enabled);
				const checkbox = control.querySelector<HTMLInputElement>('input'); if (checkbox) checkbox.disabled = !enabled;
			}
		}
	}

	private addStorageText(panel: HTMLElement, label: string, key: 'endpoint' | 'region' | 'bucket' | 'prefix' | 'accessKeyId' | 'secretAccessKey', secret = false, placeholder = ''): void {
		new Setting(panel).setName(label).addText(text => {
			text.inputEl.setAttribute('aria-label', label);
			if (placeholder) text.inputEl.placeholder = placeholder;
			text.setValue(this.readingDesk.repository.readSettings().storage[key]);
			if (secret) text.inputEl.type = 'password';
			text.onChange(value => this.save(text.inputEl, () => this.readingDesk.updateStorageSettings({ [key]: value })));
		});
	}
}

function describeConnectionFailure(error: unknown): string {
	if (error instanceof ObjectStorageConfigurationError) {
		return `连接失败：${CONNECTION_HINTS[error.code] ?? '配置不完整'}。请检查上方设置后重试。`;
	}
	if (error instanceof ObjectStorageRequestError) {
		if (error.status === 401 || error.status === 403) return `连接失败：服务返回 HTTP ${error.status}，通常是 Access Key 或 Secret Key 不正确。请核对密钥后重试。`;
		if (error.status === 404) return '连接失败：服务返回 HTTP 404，没有找到该 Bucket。请检查 Endpoint 与 Bucket 是否匹配。';
		return `连接失败：服务返回 HTTP ${error.status}。请检查 Endpoint、Bucket、Region 与凭据后重试。`;
	}
	return '连接失败：无法访问 Endpoint。请检查网络连接与 Endpoint 地址后重试。';
}
