import { createReaderTargetPanel, type ReaderTargetPanelOptions } from './ReaderTargetPanel';
import { TargetPanelDisclosure } from './TargetPanelDisclosure';

export function toggleReaderTargetPanel(root: HTMLElement, disclosure: TargetPanelDisclosure, options: ReaderTargetPanelOptions, onPanel: (panel: HTMLElement, excerptContainer: HTMLElement) => void, onClose: () => void): void {
	if (disclosure.isOpen()) { closeReaderTargetPanel(disclosure, root.querySelector<HTMLElement>(`#${options.id}`), onClose); return; }
	const created = createReaderTargetPanel(options);
	root.append(created.panel);
	onPanel(created.panel, created.excerptContainer);
	disclosure.open(created.panel, created.closeButton);
}

export function closeReaderTargetPanel(disclosure: TargetPanelDisclosure | null, panel: HTMLElement | null, onClose: () => void): void {
	disclosure?.close(() => panel?.remove());
	onClose();
}
