export interface AiBridge {
	openWithSelection(text: string, sourcePath: string): Promise<void>;
}

export interface AiPluginRegistry {
	enabledPlugins: Set<string>;
	getPlugin(id: string): unknown;
}

export interface AiAvailability {
	available: boolean;
	reason: string;
	providerId?: string;
}

export class AiIntegrationService {
	constructor(private readonly plugins: AiPluginRegistry, private readonly supported: Record<string, (plugin: unknown) => AiBridge | null> = {}) { }

	availability(): AiAvailability {
		const resolved = this.resolve();
		return resolved?.bridge
			? { available: true, providerId: resolved.id, reason: `已检测到兼容 AI 插件：${resolved.id}。` }
			: { available: false, reason: '未检测到兼容 AI 插件；Reading Desk 不会猜测第三方 API。' };
	}

	async ask(text: string, sourcePath: string): Promise<void> {
		const resolved = this.resolve();
		if (!resolved?.bridge) throw new Error(this.availability().reason);
		await resolved.bridge.openWithSelection(text, sourcePath);
	}

	private resolve(): { id: string; bridge: AiBridge } | null {
		for (const [id, createBridge] of Object.entries(this.supported)) {
			if (!this.plugins.enabledPlugins.has(id)) continue;
			const bridge = createBridge(this.plugins.getPlugin(id));
			if (bridge) return { id, bridge };
		}
		return null;
	}
}
