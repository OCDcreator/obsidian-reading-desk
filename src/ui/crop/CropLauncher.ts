import { Notice } from 'obsidian';
import { CropSelectionOverlay, type CropSelectionPayload } from './CropSelectionOverlay';
import type { PreparedCropDrag } from './CropDragTransport';

export interface CropLauncherIO {
	/** The rendered page host that should carry the overlay. */
	ensureRenderedHost(): Promise<HTMLElement | null>;
	prepareCrop(payload: CropSelectionPayload): Promise<PreparedCropDrag>;
	commit(token: string): Promise<void>;
	discard(token: string): Promise<void>;
}

/** Mounts and replaces the crop overlay for the current page, keeping ReaderView thin. */
export class CropLauncher {
	private overlay: CropSelectionOverlay | null = null;

	async enter(io: CropLauncherIO): Promise<void> {
		const host = await io.ensureRenderedHost();
		if (!host) {
			new Notice('当前页尚未渲染完成，请稍候再进入裁剪。');
			return;
		}
		this.overlay?.destroy();
		this.overlay = new CropSelectionOverlay(host, {
			page: Number(host.dataset.page ?? 1) - 1,
			host: {
				prepareCrop: payload => io.prepareCrop(payload),
				commitPreparedCrop: token => io.commit(token),
				discardPreparedCrop: token => io.discard(token),
				onCancel: () => { this.overlay = null; }
			}
		});
	}

	destroy(): void {
		this.overlay?.destroy();
		this.overlay = null;
	}

	isActive(): boolean { return this.overlay !== null; }
}
