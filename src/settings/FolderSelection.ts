/** 书库文件夹列表的纯逻辑:解析、格式化与目录树构建,便于脱离 Obsidian 测试。 */

export interface FolderTreeNode {
	path: string;
	name: string;
	children: FolderTreeNode[];
}

/** 逗号分隔 → 去空、去重、去尾部斜杠的路径数组。 */
export function parseFolderList(value: string): string[] {
	const seen = new Set<string>();
	const paths: string[] = [];
	for (const raw of value.split(',')) {
		const path = raw.trim().replace(/\/+$/, '');
		if (path === '' || seen.has(path)) continue;
		seen.add(path);
		paths.push(path);
	}
	return paths;
}

export function formatFolderList(paths: string[]): string {
	return parseFolderList(paths.join(',')).join(', ');
}

/** 输入框当前值的最后一段(模糊建议只匹配正在输入的这段)。 */
export function lastSegment(value: string): string {
	const cut = value.lastIndexOf(',');
	return cut === -1 ? value : value.slice(cut + 1);
}

/** 建议选中后写回:替换最后一个逗号段,并以「, 」收尾方便继续输入下一段。 */
export function replaceLastSegment(value: string, picked: string): string {
	const cut = value.lastIndexOf(',');
	const kept = cut === -1 ? '' : value.slice(0, cut + 1);
	const glue = kept === '' || kept.endsWith(' ') ? '' : ' ';
	return `${kept}${glue}${picked}, `;
}

/** 把路径列表按「/」层级嵌成树;根是虚拟节点,子节点按字母序。 */
export function buildFolderTree(paths: string[]): FolderTreeNode {
	const root: FolderTreeNode = { path: '', name: '', children: [] };
	const dirs = new Map<string, FolderTreeNode>([['', root]]);
	for (const path of parseFolderList([...paths].sort().join(','))) {
		const segments = path.split('/');
		let parent = root;
		let current = '';
		for (const segment of segments) {
			current = current === '' ? segment : `${current}/${segment}`;
			let node = dirs.get(current);
			if (!node) {
				node = { path: current, name: segment, children: [] };
				dirs.set(current, node);
				parent.children.push(node);
			}
			parent = node;
		}
	}
	return root;
}

/** 含有选中项的祖先分支路径,用于打开树时自动展开(选中节点本身不算)。 */
export function collectExpandedPaths(node: FolderTreeNode, selected: ReadonlySet<string>, into: Set<string> = new Set()): Set<string> {
	for (const child of node.children) {
		if (child.children.some(grandchild => containsSelected(grandchild, selected))) {
			into.add(child.path);
			collectExpandedPaths(child, selected, into);
		}
	}
	return into;
}

function containsSelected(node: FolderTreeNode, selected: ReadonlySet<string>): boolean {
	if (selected.has(node.path)) return true;
	return node.children.some(child => containsSelected(child, selected));
}
