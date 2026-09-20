import { PluginSettingTab, Setting } from 'obsidian';
import type ReadingDeskPlugin from '../main';
import { ObjectStorageConfigurationError, ObjectStorageRequestError } from '../storage/ObjectStorageService';
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
}

/** Tab order is the settings information architecture; keys persist per vault. */
const SETTINGS_TABS: readonly SettingsTabDefinition[] = [
	{ key: 'library', label: '书库', ariaLabel: '书库设置' },
	{ key: 'reader', label: '阅读', ariaLabel: '阅读器设置' },
	{ key: 'storage', label: '存储与图床', ariaLabel: '对象存储与图床设置' },
	{ key: 'ai', label: 'AI 集成', ariaLabel: '可选 AI 集成设置' },
	{ key: 'data', label: '数据与迁移', ariaLabel: '导入导出与迁移设置' }
];

export class ReadingDeskSettingTab extends PluginSettingTab {
	private portabilityPanel: ImportExportPanel | null = null;
	private activeTab = 'library';
	private panel?: HTMLElement;
	private tabButtons = new Map<string, HTMLButtonElement>();

	constructor(private readonly readingDesk: ReadingDeskPlugin) {
		super(readingDesk.app, readingDesk);
		this.activeTab = this.restoreTab();
	}

	display(): void {
		const { containerEl } = this;
		this.portabilityPanel?.destroy();
		this.portabilityPanel = null;
		this.tabButtons.clear();
		containerEl.empty();
		containerEl.addClass('reading-desk-settings');
		containerEl.createEl('h2', { cls: 'rd-setting-heading', text: 'Reading Desk 设置' });
		containerEl.createEl('p', { cls: 'rd-setting-intro', text: '书架、阅读器和标注共用同一份本地数据；凭据仅保存在此插件的本地设置中。' });
		const tabs = containerEl.createDiv({ cls: 'rd-settings-tabs', attr: { role: 'tablist', 'aria-label': '设置分类' } });
		for (const definition of SETTINGS_TABS) tabs.append(this.createTabButton(definition));
		this.panel = containerEl.createDiv({ cls: 'rd-settings-panel', attr: { role: 'tabpanel', tabindex: '0' } });
		this.renderActiveTab();
	}

	onClose(): void {
		this.portabilityPanel?.destroy();
		this.portabilityPanel = null;
	}

	private createTabButton(definition: SettingsTabDefinition): HTMLButtonElement {
		const selected = this.activeTab === definition.key;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'rd-settings-tab';
		button.textContent = definition.label;
		button.id = `rd-settings-tab-${definition.key}`;
		button.setAttribute('role', 'tab');
		button.setAttribute('aria-selected', String(selected));
		button.setAttribute('aria-controls', 'rd-settings-panel');
		button.setAttribute('aria-label', definition.ariaLabel);
		button.tabIndex = selected ? 0 : -1;
		button.addEventListener('click', () => this.switchTab(definition.key));
		button.addEventListener('keydown', event => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			const delta = event.key === 'ArrowLeft' ? -1 : 1;
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

	private renderLibrarySection(panel: HTMLElement): void {
		panel.createEl('h3', { text: '书库文件夹' });
		new Setting(panel)
			.setName('书库文件夹')
			.setDesc('用英文逗号分隔；会自动扫描其中的 PDF 和 EPUB。')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', '书库文件夹');
				return text.setValue(this.readingDesk.repository.readSettings().libraryFolders.join(', ')).onChange(async value => {
					await this.readingDesk.repository.updateSettings({ libraryFolders: value.split(',').map(item => item.trim()).filter(Boolean) });
				});
			});
		panel.createEl('p', { cls: 'rd-setting-note', text: '修改后可从书架的「扫描书库」或命令面板重新扫描。' });
	}

	private renderReaderSection(panel: HTMLElement): void {
		const viewer = this.readingDesk.repository.readSettings().viewer;
		panel.createEl('h3', { text: '阅读器' });
		new Setting(panel).setName('滚动模式').setDesc('连续滚动把整本书排成一条虚拟长卷；单页一次只显示一页。阅读器工具栏也可随时切换。')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', '滚动模式');
				return dropdown.addOption('continuous', '连续滚动').addOption('single', '单页')
					.setValue(viewer.scrollMode)
					.onChange(async scrollMode => this.readingDesk.updateViewerSettings({ scrollMode: scrollMode as 'continuous' | 'single' }));
			});
		new Setting(panel).setName('夜间纸面反相').setDesc('在深色主题下把 PDF 纸面反相为夜间阅读底色，界面本身不受影响。')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', '夜间纸面反相');
				return dropdown.addOption('auto', '跟随主题').addOption('on', '始终开启').addOption('off', '始终关闭')
					.setValue(viewer.invertPdf)
					.onChange(async invertPdf => this.readingDesk.updateViewerSettings({ invertPdf: invertPdf as 'auto' | 'on' | 'off' }));
			});
		panel.createEl('p', { cls: 'rd-setting-note', text: '以上偏好对新打开的阅读器生效；已打开的阅读器可在其工具栏「显示选项」中即时调整。' });
	}

	private renderStorageSection(panel: HTMLElement): void {
		panel.createEl('h3', { text: '对象存储与图床' });
		const storage = this.readingDesk.repository.readSettings().storage;
		new Setting(panel).setName('启用对象存储').setDesc('裁剪图片上传到 OSS 或 COS。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用对象存储');
				return toggle.setValue(storage.enabled).onChange(async enabled => this.readingDesk.updateStorageSettings({ enabled }));
			});
		new Setting(panel).setName('启用 Markdown 图床').setDesc(storage.enabled ? '在 Markdown 编辑器粘贴图片时上传并插入外链。' : '需先启用对象存储，图床才会接管 Markdown 图片粘贴。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用 Markdown 图床');
				return toggle.setValue(storage.imageHostEnabled).setDisabled(!storage.enabled).onChange(async imageHostEnabled => this.readingDesk.updateStorageSettings({ imageHostEnabled }));
			});
		new Setting(panel).setName('提供商').addDropdown(dropdown => {
			dropdown.selectEl.setAttribute('aria-label', '对象存储提供商');
			return dropdown.addOption('oss', '阿里云 OSS').addOption('cos', '腾讯云 COS')
				.setValue(storage.provider).setDisabled(!storage.enabled)
				.onChange(async provider => this.readingDesk.updateStorageSettings({ provider: provider as 'oss' | 'cos' }));
		});
		this.addStorageText(panel, 'Endpoint', 'endpoint');
		this.addStorageText(panel, 'Region（COS 必填）', 'region');
		this.addStorageText(panel, 'Bucket', 'bucket');
		this.addStorageText(panel, '对象存储路径', 'prefix');
		this.addStorageText(panel, 'Access Key', 'accessKeyId');
		this.addStorageText(panel, 'Secret Key', 'secretAccessKey', true);
		const testSetting = new Setting(panel).setName('测试连接').setDesc(storage.enabled ? '发送已签名的只读请求；不会上传文件。' : '先启用对象存储并填写凭据后才可测试。');
		testSetting
			.addButton(button => button.setButtonText('测试连接').setDisabled(!storage.enabled).onClick(async () => {
				button.setDisabled(true).setButtonText('测试中…');
				try {
					const result = await this.readingDesk.testStorageConnection();
					testSetting.setDesc(`连接成功：HTTP ${result.status}，${result.endpoint}`);
				} catch (error) {
					testSetting.setDesc(describeConnectionFailure(error));
				} finally {
					button.setDisabled(false).setButtonText('测试连接');
				}
			}));
	}

	private renderAiSection(panel: HTMLElement): void {
		panel.createEl('h3', { text: '可选 AI 集成' });
		const ai = this.readingDesk.ai.availability();
		new Setting(panel).setName('AI 选区对话').setDesc(ai.reason)
			.addButton(button => button.setButtonText('发送当前选区').setDisabled(!ai.available).onClick(() => this.readingDesk.notice('在阅读器中选中原文后，使用命令面板“将当前 Reading Desk 选区交给 AI”。')));
	}

	private renderDataSection(panel: HTMLElement): void {
		panel.createEl('h3', { text: '数据与迁移' });
		const portability = panel.createDiv({ cls: 'rd-settings-portability' });
		this.portabilityPanel = new ImportExportPanel({
			importLegacy: () => this.readingDesk.importLegacyBookshelf(),
			exportMarkdown: () => this.readingDesk.exportMarkdown(),
			exportJson: () => this.readingDesk.exportJson(),
			status: () => this.readingDesk.portabilityStatus()
		});
		this.portabilityPanel.render(portability);
	}

	private addStorageText(panel: HTMLElement, label: string, key: 'endpoint' | 'region' | 'bucket' | 'prefix' | 'accessKeyId' | 'secretAccessKey', secret = false): void {
		new Setting(panel).setName(label).addText(text => {
			text.inputEl.setAttribute('aria-label', label);
			text.setValue(this.readingDesk.repository.readSettings().storage[key]);
			if (secret) text.inputEl.type = 'password';
			text.onChange(async value => this.readingDesk.updateStorageSettings({ [key]: value }));
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
