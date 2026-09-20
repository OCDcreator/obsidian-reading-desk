import { describe, expect, it } from 'vitest';
import { findPageHits } from '../../src/reader/ReaderSearchService';

describe('findPageHits', () => {
	it('finds case-insensitive matches with snippets and page numbers', () => {
		const hits = findPageHits(4, '量子力学描述微观世界的物理规律基础说明，而 QUANTUM 叠加态承载量子比特信息。Quantum 纠缠。', 'quantum');
		expect(hits.map(hit => hit.page)).toEqual([4, 4]);
		expect(hits[0].snippet).toContain('quantum');
		expect(hits[0].snippet.startsWith('…')).toBe(true);
	});

	it('caps hits per page to keep the list scannable', () => {
		const text = Array.from({ length: 20 }, () => '关键词').join(' ');
		expect(findPageHits(1, text, '关键词')).toHaveLength(3);
	});

	it('returns nothing for blank queries or missing text', () => {
		expect(findPageHits(1, '任意文本', '')).toEqual([]);
		expect(findPageHits(1, '任意文本', '   ')).toEqual([]);
		expect(findPageHits(1, '', '词')).toEqual([]);
	});
});
