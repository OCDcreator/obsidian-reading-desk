import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingSaveFeedback } from '../../src/settings/SettingSaveFeedback';
import { flush, installDom } from './shelf/ShelfTestDom';
afterEach(() => vi.unstubAllGlobals());
describe('local setting save feedback', () => {
	it('announces saving/failure/retry/success without replacing draft or focus', async () => {
		const document = installDom(vi.stubGlobal); const row = document.body.createDiv(); const input = row.createEl('input'); input.value = 'draft'; input.focus();
		const save = vi.fn().mockRejectedValueOnce(new Error('磁盘不可写')).mockResolvedValueOnce(undefined); const feedback = new SettingSaveFeedback(row as unknown as HTMLElement);
		const pending = feedback.save(save); expect(row.querySelector('[role="status"]')?.textContent).toBe('保存中…'); await pending;
		expect(row.querySelector('[role="status"]')?.textContent).toContain('保存失败'); expect(input.value).toBe('draft'); expect(document.activeElement).toBe(input);
		const retry = row.querySelector('[aria-label="重试保存此设置"]'); expect(retry?.hidden).toBe(false); retry?.click(); await flush();
		expect(save).toHaveBeenCalledTimes(2); expect(row.querySelector('[role="status"]')?.textContent).toBe('已保存'); expect(retry?.hidden).toBe(true); expect(document.activeElement).toBe(input);
	});
	it('persists the latest queued draft and ignores an obsolete failure', async () => {
		const document = installDom(vi.stubGlobal); const row = document.body.createDiv(); const feedback = new SettingSaveFeedback(row as unknown as HTMLElement);
		let reject: (error: Error) => void = () => undefined; const old = feedback.save(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; })); await flush();
		const latest = vi.fn(async () => undefined); const pending = feedback.save(latest); reject(new Error('旧请求失败')); await old; await pending;
		expect(latest).toHaveBeenCalledOnce(); expect(row.querySelector('[role="status"]')?.textContent).toBe('已保存');
	});
});
