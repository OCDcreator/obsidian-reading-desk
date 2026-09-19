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

export class ReadingDeskSettingTab extends PluginSettingTab {
	private portabilityPanel: ImportExportPanel | null = null;
	constructor(private readonly readingDesk: ReadingDeskPlugin) {
		super(readingDesk.app, readingDesk);
	}

	display(): void {
		const { containerEl } = this;
		this.portabilityPanel?.destroy();
		containerEl.empty();
		containerEl.addClass('reading-desk-settings');
		containerEl.createEl('h2', { cls: 'rd-setting-heading', text: 'Reading Desk 设置' });
		containerEl.createEl('p', { cls: 'rd-setting-intro', text: '书架、阅读器和标注共用同一份本地数据；凭据仅保存在此插件的本地设置中。' });
		containerEl.createEl('h3', { text: '书库' });
		new Setting(containerEl)
			.setName('书库文件夹')
			.setDesc('用英文逗号分隔；会自动扫描其中的 PDF 和 EPUB。')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', '书库文件夹');
				return text.setValue(this.readingDesk.repository.readSettings().libraryFolders.join(', ')).onChange(async value => {
					await this.readingDesk.repository.updateSettings({ libraryFolders: value.split(',').map(item => item.trim()).filter(Boolean) });
				});
			});
		containerEl.createEl('h3', { text: '对象存储与图床' });
		const storage = this.readingDesk.repository.readSettings().storage;
		new Setting(containerEl).setName('启用对象存储').setDesc('裁剪图片上传到 OSS 或 COS。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用对象存储');
				return toggle.setValue(storage.enabled).onChange(async enabled => this.readingDesk.updateStorageSettings({ enabled }));
			});
		new Setting(containerEl).setName('启用 Markdown 图床').setDesc(storage.enabled ? '在 Markdown 编辑器粘贴图片时上传并插入外链。' : '需先启用对象存储，图床才会接管 Markdown 图片粘贴。')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', '启用 Markdown 图床');
				return toggle.setValue(storage.imageHostEnabled).setDisabled(!storage.enabled).onChange(async imageHostEnabled => this.readingDesk.updateStorageSettings({ imageHostEnabled }));
			});
		new Setting(containerEl).setName('提供商').addDropdown(dropdown => {
			dropdown.selectEl.setAttribute('aria-label', '对象存储提供商');
			return dropdown.addOption('oss', '阿里云 OSS').addOption('cos', '腾讯云 COS')
				.setValue(storage.provider).setDisabled(!storage.enabled)
				.onChange(async provider => this.readingDesk.updateStorageSettings({ provider: provider as 'oss' | 'cos' }));
		});
		this.addStorageText('Endpoint', 'endpoint');
		this.addStorageText('Region（COS 必填）', 'region');
		this.addStorageText('Bucket', 'bucket');
		this.addStorageText('对象存储路径', 'prefix');
		this.addStorageText('Access Key', 'accessKeyId');
		this.addStorageText('Secret Key', 'secretAccessKey', true);
		const testSetting = new Setting(containerEl).setName('测试连接').setDesc(storage.enabled ? '发送已签名的只读请求；不会上传文件。' : '先启用对象存储并填写凭据后才可测试。');
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
		containerEl.createEl('h3', { text: '可选 AI 集成' });
		const ai = this.readingDesk.ai.availability();
		new Setting(containerEl).setName('AI 选区对话').setDesc(ai.reason)
			.addButton(button => button.setButtonText('发送当前选区').setDisabled(!ai.available).onClick(() => this.readingDesk.notice('在阅读器中选中原文后，使用命令面板“将当前 Reading Desk 选区交给 AI”。')));
		const portability = containerEl.createDiv({ cls: 'rd-settings-portability' });
		this.portabilityPanel = new ImportExportPanel({
			importLegacy: () => this.readingDesk.importLegacyBookshelf(),
			exportMarkdown: () => this.readingDesk.exportMarkdown(),
			exportJson: () => this.readingDesk.exportJson(),
			status: () => this.readingDesk.portabilityStatus()
		});
		this.portabilityPanel.render(portability);
	}

	private addStorageText(label: string, key: 'endpoint' | 'region' | 'bucket' | 'prefix' | 'accessKeyId' | 'secretAccessKey', secret = false): void {
		new Setting(this.containerEl).setName(label).addText(text => {
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
