import { describe, expect, it } from 'vitest';
import { activeOutlinePath, buildOutlineTree } from '../../src/reader/ReaderNavigation';

describe('Reader navigation outline', () => {
	const outline = [
		{ title: '第一章', page: 0, path: ['第一章'] },
		{ title: '1.1 基础', page: 2, path: ['第一章', '1.1 基础'] },
		{ title: '1.2 反馈', page: 5, path: ['第一章', '1.2 反馈'] },
		{ title: '第二章', page: 12, path: ['第二章'] }
	];

	it('keeps PDF outline hierarchy and page destinations', () => {
		expect(buildOutlineTree(outline)).toEqual([
			{ title: '第一章', page: 0, path: ['第一章'], children: [
				{ title: '1.1 基础', page: 2, path: ['第一章', '1.1 基础'], children: [] },
				{ title: '1.2 反馈', page: 5, path: ['第一章', '1.2 反馈'], children: [] }
			] },
			{ title: '第二章', page: 12, path: ['第二章'], children: [] }
		]);
	});

	it('restores hierarchy when a destination-less parent is represented only in child paths', () => {
		expect(buildOutlineTree([{ title: '1.1 基础', page: 2, path: ['第一章', '1.1 基础'] }])).toEqual([
			{ title: '第一章', page: 2, path: ['第一章'], children: [
				{ title: '1.1 基础', page: 2, path: ['第一章', '1.1 基础'], children: [] }
			] }
		]);
	});

	it('selects the deepest latest chapter at the current page', () => {
		expect(activeOutlinePath(outline, 7)).toEqual(['第一章', '1.2 反馈']);
		expect(activeOutlinePath(outline, 1)).toEqual(['第一章']);
		expect(activeOutlinePath([], 7)).toEqual([]);
	});
});
