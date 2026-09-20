import { describe, expect, it, vi } from 'vitest';
import { TargetPanelDisclosure, type FocusControl } from '../../src/ui/targets/TargetPanelDisclosure';

function control(): FocusControl & { attrs: Record<string, string>; focus: ReturnType<typeof vi.fn> } {
	const attrs: Record<string, string> = {};
	return { attrs, setAttribute: (name, value) => { attrs[name] = value; }, focus: vi.fn() };
}

describe('target panel disclosure', () => {
	it('links toggle and panel, enters the overlay, then restores toggle focus', () => {
		const toggle = control();
		const panel = control();
		const close = control();
		const remove = vi.fn();
		const disclosure = new TargetPanelDisclosure(toggle, 'rd-target-panel-stable');
		expect(toggle.attrs).toMatchObject({ 'aria-controls': 'rd-target-panel-stable', 'aria-expanded': 'false' });
		disclosure.open(panel, close);
		expect(toggle.attrs['aria-expanded']).toBe('true');
		expect(close.focus).toHaveBeenCalledOnce();
		disclosure.close(remove);
		expect(remove).toHaveBeenCalledOnce();
		expect(toggle.attrs['aria-expanded']).toBe('false');
		expect(toggle.focus).toHaveBeenCalledOnce();
	});
});
