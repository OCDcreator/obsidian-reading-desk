(async () => {
	const plugin = app.plugins.plugins['obsidian-reading-desk'];
	delete plugin.repository.readHighlights()['qa-pdf-plus-page-empty'];
	const view = app.workspace.getLeavesOfType('reading-desk-reader')[0].view;
	await view.openPdf('Books/原子结构与化学键核心问题详解（Atomic Structure and Chemical Bonding）.pdf', 4);
	const toggle = [...document.querySelectorAll('.rd-reader-toolbar button')].find(button => button.textContent === '高亮列表');
	if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
	app.changeTheme('moonstone');
	await new Promise(resolve => setTimeout(resolve, 250));
	return {
		theme: app.vault.getConfig('theme'), state: view.getState(),
		temporaryHighlightPresent: !!plugin.repository.readHighlights()['qa-pdf-plus-page-empty'],
		drawerOpen: toggle?.getAttribute('aria-expanded')
	};
})()
