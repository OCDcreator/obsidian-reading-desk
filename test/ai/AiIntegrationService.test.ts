import { describe, expect, it, vi } from 'vitest';
import { AiIntegrationService, type AiBridge } from '../../src/ai/AiIntegrationService';

describe('AiIntegrationService', () => {
	it('keeps AI disabled when no supported plugin is enabled', () => {
		const getPlugin = vi.fn();
		const service = new AiIntegrationService({ enabledPlugins: new Set(), getPlugin }, {
			opencodian: () => ({ openWithSelection: vi.fn() })
		});

		expect(service.availability()).toEqual({ available: false, reason: '未检测到兼容 AI 插件；Reading Desk 不会猜测第三方 API。' });
		expect(getPlugin).not.toHaveBeenCalled();
	});

	it('probes the enabled plugin and forwards the source selection through its bridge', async () => {
		const bridge: AiBridge = { openWithSelection: vi.fn().mockResolvedValue(undefined) };
		const plugin = { id: 'opencodian' };
		const getPlugin = vi.fn().mockReturnValue(plugin);
		const service = new AiIntegrationService({ enabledPlugins: new Set(['opencodian']), getPlugin }, {
			opencodian: candidate => candidate === plugin ? bridge : null
		});

		expect(service.availability()).toEqual({ available: true, providerId: 'opencodian', reason: '已检测到兼容 AI 插件：opencodian。' });
		await service.ask('选中的 PDF 原文', 'papers/example.pdf');
		expect(getPlugin).toHaveBeenCalledWith('opencodian');
		expect(bridge.openWithSelection).toHaveBeenCalledWith('选中的 PDF 原文', 'papers/example.pdf');
	});
});
