(async () => {
	const plugin = app.plugins.plugins['obsidian-reading-desk'];
	const path = 'Books/原子结构与化学键核心问题详解（Atomic Structure and Chemical Bonding）.pdf';
	const id = 'qa-pdf-plus-page-empty';
	plugin.repository.readHighlights()[id] = {
		id, pdfPath: path, page: 0, rotation: 0,
		rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
		text: '这是用于验证超长中文摘录在窄抽屉中不会造成横向溢出的临时实机文本。'.repeat(5),
		color: 'moss', chapterPath: [], tags: ['非常非常长的标签名称用于换行验证'], createdAt: 1, updatedAt: 1
	};
	const view = app.workspace.getLeavesOfType('reading-desk-reader')[0].view;
	await view.openPdf(path, 4);
	const toggle = [...document.querySelectorAll('.rd-reader-toolbar button')].find(button => button.textContent === '高亮列表');
	if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
	const current = [...document.querySelectorAll('.rd-highlight-list__scope button')].find(button => button.textContent === '当前页');
	current.click();
	return {
		state: view.getState(), count: document.querySelector('.rd-highlight-list__count')?.textContent,
		empty: document.querySelector('.rd-highlight-list__page-empty')?.textContent,
		rows: document.querySelectorAll('.rd-highlight-row').length
	};
})()
