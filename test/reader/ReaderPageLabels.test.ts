import { describe, expect, it } from 'vitest';
import { ReaderPageLabels } from '../../src/reader/ReaderPageLabels';
describe('printed PDF page labels', () => {
	it('resolves roman labels and numeric labels without changing physical IDs', () => {
		const labels = new ReaderPageLabels(['i', 'ii', '1', '2']);
		expect(labels.resolve('ii', 4)).toEqual({ page: 2 }); expect(labels.resolve('1', 4)).toEqual({ page: 3 });
		expect(labels.resolve('#1', 4)).toEqual({ page: 1 }); expect(labels.description(3)).toBe('第 1 页（PDF 第 3 页）');
	});
	it('gives visible physical alternatives for duplicate labels and rejects out of range pages', () => {
		const labels = new ReaderPageLabels(['1', '1']);
		expect(labels.resolve('1', 2).message).toContain('#1、#2'); expect(labels.resolve('#2', 2).page).toBe(2);
		expect(labels.resolve('#3', 2).message).toBeTruthy(); expect(labels.resolve('missing', 2).message).toBeTruthy();
	});
	it('falls back to physical labels for ordinary old documents', () => {
		const labels = new ReaderPageLabels(); expect(labels.label(5)).toBe('5'); expect(labels.resolve('5', 10).page).toBe(5);
	});
});
