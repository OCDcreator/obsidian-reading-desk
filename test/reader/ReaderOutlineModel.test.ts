import { describe, expect, it } from 'vitest';
import {
	activeOutlinePath,
	ancestorKeys,
	buildDisplayTree,
	buildOutlineTree,
	chapterPathForPage,
	matchTypeahead,
	outlineKey,
	outlineRows,
	resolveOutlineKey
} from '../../src/reader/ReaderOutlineModel';
import type { PdfOutlineEntry } from '../../src/reader/PdfRenderer';

const nativeNested: PdfOutlineEntry[] = [
	{ title: 'Part One', page: 0, path: ['Part One'] },
	{ title: 'Chapter 1 Alpha', page: 0, path: ['Part One', 'Chapter 1 Alpha'] },
	{ title: 'Chapter 2 Beta', page: 4, path: ['Part One', 'Chapter 2 Beta'] },
	{ title: 'Chapter 3 Gamma', page: 11, path: ['Part One', 'Chapter 3 Gamma'] },
	{ title: 'Part Two', page: 19, path: ['Part Two'] },
	{ title: 'Chapter 4 Delta', page: 19, path: ['Part Two', 'Chapter 4 Delta'] },
	{ title: 'Chapter 5 Epsilon', page: 25, path: ['Part Two', 'Chapter 5 Epsilon'] }
];

const flatNumbered: PdfOutlineEntry[] = [
	{ title: 'Cover', page: 0, path: ['Cover'] },
	{ title: '1 Why Ionic Solids Crack', page: 0, path: ['1 Why Ionic Solids Crack'] },
	{ title: '1.1 The Energy Landscape', page: 0, path: ['1.1 The Energy Landscape'] },
	{ title: '1.2 Slip and Cleavage', page: 0, path: ['1.2 Slip and Cleavage'] },
	{ title: '2 Lattice Energy and the Born-Haber Cycle', page: 0, path: ['2 Lattice Energy and the Born-Haber Cycle'] },
	{ title: '2.1 Measuring What Cannot Be Measured', page: 0, path: ['2.1 Measuring What Cannot Be Measured'] },
	{ title: '2.2 Where the Model Bends', page: 0, path: ['2.2 Where the Model Bends'] },
	{ title: '3 Defects, Conductivity and Colour', page: 1, path: ['3 Defects, Conductivity and Colour'] },
	{ title: '3.1 Schottky and Frenkel Pairs', page: 1, path: ['3.1 Schottky and Frenkel Pairs'] }
];

describe('ReaderOutlineModel display tree', () => {
	it('keeps native multi-level paths and never re-infers or double-indents', () => {
		const tree = buildDisplayTree(nativeNested);
		expect(tree).toEqual(buildOutlineTree(nativeNested));
		expect(tree.map(node => node.title)).toEqual(['Part One', 'Part Two']);
		expect(tree[0].children.map(node => node.title)).toEqual(['Chapter 1 Alpha', 'Chapter 2 Beta', 'Chapter 3 Gamma']);
		expect(tree[0].children.every(node => node.children.length === 0)).toBe(true);
	});

	it('restores native hierarchy when a destination-less parent is only implied by child paths', () => {
		expect(buildOutlineTree([{ title: '1.1 基础', page: 2, path: ['第一章', '1.1 基础'] }])).toEqual([
			{ title: '第一章', page: 2, path: ['第一章'], children: [
				{ title: '1.1 基础', page: 2, path: ['第一章', '1.1 基础'], children: [] }
			] }
		]);
	});

	it('nests flat numbered headings under their exact parents and keeps the original titles', () => {
		const snapshot = JSON.stringify(flatNumbered);
		const tree = buildDisplayTree(flatNumbered);
		expect(JSON.stringify(flatNumbered)).toBe(snapshot);
		expect(tree.map(node => node.title)).toEqual(['Cover', '1 Why Ionic Solids Crack', '2 Lattice Energy and the Born-Haber Cycle', '3 Defects, Conductivity and Colour']);
		expect(tree[1].children.map(node => node.title)).toEqual(['1.1 The Energy Landscape', '1.2 Slip and Cleavage']);
		expect(tree[2].children.map(node => node.title)).toEqual(['2.1 Measuring What Cannot Be Measured', '2.2 Where the Model Bends']);
		expect(tree[3].children.map(node => node.title)).toEqual(['3.1 Schottky and Frenkel Pairs']);
	});

	it('supports three numbered levels without inventing missing parents', () => {
		const tree = buildDisplayTree([
			{ title: '1 章', page: 0, path: ['1 章'] },
			{ title: '1.1 节', page: 1, path: ['1.1 节'] },
			{ title: '1.1.1 小节', page: 2, path: ['1.1.1 小节'] },
			{ title: '1.2.1 孤儿小节', page: 3, path: ['1.2.1 孤儿小节'] }
		]);
		expect(tree.map(node => node.title)).toEqual(['1 章', '1.2.1 孤儿小节']);
		expect(tree[0].children[0].children.map(node => node.title)).toEqual(['1.1.1 小节']);
	});

	it('keeps orphan numbered entries at the top level when the exact parent is absent', () => {
		const orphan = buildDisplayTree([
			{ title: '2024.1 Report', page: 0, path: ['2024.1 Report'] },
			{ title: '2024.2 Report', page: 1, path: ['2024.2 Report'] }
		]);
		expect(orphan.map(node => node.title)).toEqual(['2024.1 Report', '2024.2 Report']);
		const withParent = buildDisplayTree([
			{ title: '2024 Annual Report', page: 0, path: ['2024 Annual Report'] },
			{ title: '2024.1 Report', page: 1, path: ['2024.1 Report'] }
		]);
		expect(withParent.map(node => node.title)).toEqual(['2024 Annual Report']);
		expect(withParent[0].children.map(node => node.title)).toEqual(['2024.1 Report']);
	});

	it('leaves unnumbered flat outlines completely flat', () => {
		const tree = buildDisplayTree([
			{ title: 'Introduction', page: 0, path: ['Introduction'] },
			{ title: 'Methods and Materials', page: 2, path: ['Methods and Materials'] },
			{ title: 'Appendix', page: 9, path: ['Appendix'] }
		]);
		expect(tree.map(node => node.title)).toEqual(['Introduction', 'Methods and Materials', 'Appendix']);
		expect(tree.every(node => node.children.length === 0)).toBe(true);
	});

	it('still nests chapters that all start on the same page', () => {
		const tree = buildDisplayTree([
			{ title: '1 主题', page: 0, path: ['1 主题'] },
			{ title: '1.1 子题甲', page: 0, path: ['1.1 子题甲'] },
			{ title: '1.2 子题乙', page: 0, path: ['1.2 子题乙'] },
			{ title: '2 主题', page: 0, path: ['2 主题'] },
			{ title: '2.1 子题丙', page: 0, path: ['2.1 子题丙'] }
		]);
		expect(tree.map(node => node.title)).toEqual(['1 主题', '2 主题']);
		expect(tree[0].children.map(node => node.title)).toEqual(['1.1 子题甲', '1.2 子题乙']);
		expect(tree[1].children.map(node => node.title)).toEqual(['2.1 子题丙']);
	});

	it('reads explicit Chinese chapter/section frames conservatively', () => {
		const tree = buildDisplayTree([
			{ title: '第一章 概论', page: 0, path: ['第一章 概论'] },
			{ title: '第1节 背景', page: 1, path: ['第1节 背景'] },
			{ title: '第2节 方法', page: 2, path: ['第2节 方法'] },
			{ title: '附录', page: 3, path: ['附录'] },
			{ title: '第3节 结果', page: 4, path: ['第3节 结果'] }
		]);
		expect(tree.map(node => node.title)).toEqual(['第一章 概论', '附录', '第3节 结果']);
		expect(tree[0].children.map(node => node.title)).toEqual(['第1节 背景', '第2节 方法']);
		const loose = buildDisplayTree([
			{ title: '第二节 市场回顾', page: 0, path: ['第二节 市场回顾'] },
			{ title: '第一部分 说明', page: 1, path: ['第一部分 说明'] }
		]);
		expect(loose.map(node => node.title)).toEqual(['第二节 市场回顾', '第一部分 说明']);
		expect(loose.every(node => node.children.length === 0)).toBe(true);
	});

	it('prefers real PDF nesting whenever any entry carries a multi-level path', () => {
		const tree = buildDisplayTree([
			{ title: 'Part', page: 0, path: ['Part'] },
			{ title: '1.1 Nested Numbering', page: 1, path: ['Part', '1.1 Nested Numbering'] }
		]);
		expect(tree.map(node => node.title)).toEqual(['Part']);
		expect(tree[0].children.map(node => node.title)).toEqual(['1.1 Nested Numbering']);
	});
});

describe('ReaderOutlineModel current item and chapter attribution', () => {
	it('keeps the native range highlight selection', () => {
		expect(activeOutlinePath(nativeNested, 0)).toEqual(['Part One', 'Chapter 1 Alpha']);
		expect(activeOutlinePath(nativeNested, 7)).toEqual(['Part One', 'Chapter 2 Beta']);
		expect(activeOutlinePath(nativeNested, 24)).toEqual(['Part Two', 'Chapter 4 Delta']);
		expect(activeOutlinePath([], 3)).toEqual([]);
	});

	it('lets inferred depth outrank same-page parents so Cover never wins', () => {
		expect(activeOutlinePath(flatNumbered, 0)).toEqual(['1.1 The Energy Landscape']);
		expect(activeOutlinePath(flatNumbered, 1)).toEqual(['3.1 Schottky and Frenkel Pairs']);
	});

	it('keeps excerpt chapter attribution semantics unchanged', () => {
		expect(chapterPathForPage(flatNumbered, 0)).toEqual(['Cover']);
		expect(chapterPathForPage(nativeNested, 7)).toEqual(['Part One', 'Chapter 2 Beta']);
		expect(chapterPathForPage(nativeNested, 1)).toEqual(['Part One', 'Chapter 1 Alpha']);
		expect(chapterPathForPage([], 4)).toEqual([]);
	});
});

describe('ReaderOutlineModel visible rows and keyboard contract', () => {
	const tree = buildDisplayTree(nativeNested);
	const rows = outlineRows(tree);

	it('excludes collapsed subtrees from the keyboard order', () => {
		expect(rows.map(row => row.node.title)).toEqual([
			'Part One', 'Chapter 1 Alpha', 'Chapter 2 Beta', 'Chapter 3 Gamma', 'Part Two', 'Chapter 4 Delta', 'Chapter 5 Epsilon'
		]);
		const collapsed = outlineRows(tree, new Set([outlineKey(tree[0])]));
		expect(collapsed.map(row => row.node.title)).toEqual(['Part One', 'Part Two', 'Chapter 4 Delta', 'Chapter 5 Epsilon']);
		expect(collapsed[0].expanded).toBe(false);
		expect(collapsed[0].hasChildren).toBe(true);
	});

	it('exposes ancestor chains for the active path', () => {
		expect(ancestorKeys(rows, outlineKey(tree[0].children[1]))).toEqual([outlineKey(tree[0])]);
		expect(ancestorKeys(rows, outlineKey(tree[0]))).toEqual([]);
	});

	it('resolves tree-style arrow keys into expand, fold and movement', () => {
		expect(resolveOutlineKey('ArrowRight', rows, 0, 'tree')).toEqual({ kind: 'move', index: 1 });
		expect(resolveOutlineKey('ArrowRight', rows, 4, 'tree')).toEqual({ kind: 'move', index: 5 });
		expect(resolveOutlineKey('ArrowLeft', rows, 0, 'tree')).toEqual({ kind: 'toggle', index: 0, expand: false });
		expect(resolveOutlineKey('ArrowLeft', rows, 1, 'tree')).toEqual({ kind: 'move', index: 0 });
		expect(resolveOutlineKey('ArrowLeft', rows, 4, 'tree')).toEqual({ kind: 'toggle', index: 4, expand: false });
		expect(resolveOutlineKey(' ', rows, 0, 'tree')).toEqual({ kind: 'toggle', index: 0, expand: false });
		expect(resolveOutlineKey(' ', rows, 1, 'tree')).toEqual({ kind: 'none' });
		expect(resolveOutlineKey('ArrowRight', rows, 1, 'tree')).toEqual({ kind: 'none' });
	});

	it('expands a closed parent with ArrowRight and opens Space toggles', () => {
		const closed = outlineRows(tree, new Set([outlineKey(tree[0])]));
		expect(resolveOutlineKey('ArrowRight', closed, 0, 'tree')).toEqual({ kind: 'toggle', index: 0, expand: true });
		expect(resolveOutlineKey(' ', closed, 0, 'tree')).toEqual({ kind: 'toggle', index: 0, expand: true });
		expect(resolveOutlineKey('ArrowDown', closed, 0, 'tree')).toEqual({ kind: 'move', index: 1 });
		expect(resolveOutlineKey('ArrowUp', closed, 1, 'tree')).toEqual({ kind: 'move', index: 0 });
		expect(resolveOutlineKey('Home', closed, 1, 'tree')).toEqual({ kind: 'move', index: 0 });
		expect(resolveOutlineKey('End', closed, 0, 'tree')).toEqual({ kind: 'move', index: 3 });
		expect(resolveOutlineKey('Enter', closed, 2, 'tree')).toEqual({ kind: 'activate' });
	});

	it('moves focus without folding in bullet style', () => {
		expect(resolveOutlineKey('ArrowRight', rows, 0, 'bullet')).toEqual({ kind: 'move', index: 1 });
		expect(resolveOutlineKey('ArrowLeft', rows, 1, 'bullet')).toEqual({ kind: 'move', index: 0 });
		expect(resolveOutlineKey('ArrowLeft', rows, 0, 'bullet')).toEqual({ kind: 'none' });
		expect(resolveOutlineKey(' ', rows, 0, 'bullet')).toEqual({ kind: 'none' });
		expect(resolveOutlineKey('Enter', rows, 0, 'bullet')).toEqual({ kind: 'activate' });
	});

	it('finds typeahead targets with wrap-around', () => {
		expect(matchTypeahead(rows, 'chapter 2', 0)).toBe(2);
		expect(matchTypeahead(rows, 'part', 4)).toBe(0);
		expect(matchTypeahead(rows, 'zzz', 0)).toBeNull();
		expect(matchTypeahead(rows, '', 0)).toBeNull();
	});
});
