import { PluginSettingTab, Setting } from 'obsidian';
import type ReadingDeskPlugin from '../main';
import { ImportExportPanel } from '../ui/portability/ImportExportPanel';

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
			.addText(text => text.setValue(this.readingDesk.repository.readSettings().libraryFolders.join(', ')).onChange(async value => {
				await this.readingDesk.repository.updateSettings({ libraryFolders: value.split(',').map(item => item.trim()).filter(Boolean) });
			}));
		containerEl.createEl('h3', { text: '对象存储与图床' });
		const storage = this.readingDesk.repository.readSettings().storage;
		new Setting(containerEl).setName('启用对象存储').setDesc('裁剪图片上传到 OSS 或 COS。')
			.addToggle(toggle => toggle.setValue(storage.enabled).onChange(async enabled => this.readingDesk.updateStorageSettings({ enabled })));
		new Setting(containerEl).setName('启用 Markdown 图床').setDesc(storage.enabled ? '在 Markdown 编辑器粘贴图片时上传并插入外链。' : '需先启用对象存储，图床才会接管 Markdown 图片粘贴。')
			.addToggle(toggle => {
				toggle.setValue(storage.imageHostEnabled).setDisabled(!storage.enabled).onChange(async imageHostEnabled => this.readingDesk.updateStorageSettings({ imageHostEnabled }));
			});
		new Setting(containerEl).setName('提供商').addDropdown(dropdown => dropdown.addOption('oss', '阿里云 OSS').addOption('cos', '腾讯云 COS')
			.setValue(storage.provider).onChange(async provider => this.readingDesk.updateStorageSettings({ provider: provider as 'oss' | 'cos' })));
		this.addStorageText('Endpoint', 'endpoint');
		this.addStorageText('Region（COS 必填）', 'region');
		this.addStorageText('Bucket', 'bucket');
		this.addStorageText('对象存储路径', 'prefix');
		this.addStorageText('Access Key', 'accessKeyId');
		this.addStorageText('Secret Key', 'secretAccessKey', true);
		const testSetting = new Setting(containerEl).setName('测试连接').setDesc(storage.enabled ? '发送已签名的只读请求；不会上传文件。' : '先启用对象存储并填写凭据后才可测试。');
		testSetting
			.addButton(button => button.setButtonText('测试连接').onClick(async () => {
				button.setDisabled(true).setButtonText('测试中…');
				try {
					const result = await this.readingDesk.testStorageConnection();
					testSetting.setDesc(`连接成功：HTTP ${result.status}，${result.endpoint}`);
				} catch (error) {
					testSetting.setDesc(error instanceof Error ? `连接失败：${error.message}` : '连接失败：请检查 Endpoint、Bucket、Region 与凭据。');
				} finally { button.setDisabled(false).setButtonText('测试连接'); }
			}).setDisabled(!storage.enabled));
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
			text.setValue(this.readingDesk.repository.readSettings().storage[key]);
			if (secret) text.inputEl.type = 'password';
			text.onChange(async value => this.readingDesk.updateStorageSettings({ [key]: value }));
		});
	}
}
