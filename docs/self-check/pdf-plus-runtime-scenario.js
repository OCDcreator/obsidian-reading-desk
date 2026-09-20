(async () => {
	const plugin = app.plugins.plugins['obsidian-reading-desk'];
	const originalLeaf = app.workspace.activeLeaf;
	const originalLeaves = new Set(app.workspace.getLeavesOfType('reading-desk-reader'));
	const fixturePath = 'Reading Desk Fixtures/reader-text-fixture.pdf';
	const book = plugin.library.getByPath(fixturePath);
	const highlight = plugin.annotations.list(fixturePath)[0];
	const createdLeaves = [];
	const result = { buildId: '0.1.1+2026-09-19T17:29:13.259Z' };
	const latestCreatedReader = () => app.workspace.getLeavesOfType('reading-desk-reader').find(leaf => !originalLeaves.has(leaf) && !createdLeaves.includes(leaf));
	try {
		await plugin.openReaderHighlight({ file: 'stale.pdf', page: '1', book: book.id });
		const pageLeaf = latestCreatedReader();
		if (!pageLeaf) throw new Error('Page route did not create a Reader leaf');
		createdLeaves.push(pageLeaf);
		result.pageRoute = {
			state: pageLeaf.view.getState(),
			aria: pageLeaf.view.containerEl.querySelector('.rd-pdf-page-host')?.getAttribute('aria-label'),
			usedStableBookPath: pageLeaf.view.getState().pdfPath === fixturePath
		};

		await plugin.openReaderHighlight({ file: 'stale.pdf', highlight: highlight.id });
		const highlightLeaf = latestCreatedReader();
		if (!highlightLeaf) throw new Error('Highlight route did not create a Reader leaf');
		createdLeaves.push(highlightLeaf);
		result.highlightRoute = {
			state: highlightLeaf.view.getState(),
			aria: highlightLeaf.view.containerEl.querySelector('.rd-pdf-page-host')?.getAttribute('aria-label'),
			focusedMarks: highlightLeaf.view.containerEl.querySelectorAll(`[data-highlight-id="${highlight.id}"]`).length,
			usedStoredPath: highlightLeaf.view.getState().pdfPath === fixturePath
		};

		const command = app.commands.commands['obsidian-reading-desk:copy-current-reader-page-link'];
		const shelfLeaf = app.workspace.getLeavesOfType('reading-desk-shelf')[0];
		app.workspace.setActiveLeaf(shelfLeaf, { focus: true });
		result.commandDisabledOutsideReader = command.checkCallback(true) === false;
		app.workspace.setActiveLeaf(originalLeaf, { focus: true });

		const clipboard = navigator.clipboard;
		const originalWrite = clipboard.writeText;
		clipboard.writeText = async () => { throw new Error('qa denied'); };
		const copyButton = [...originalLeaf.view.containerEl.querySelectorAll('.rd-reader-toolbar button')].find(button => button.textContent === '复制本页链接');
		copyButton.click();
		await new Promise(resolve => setTimeout(resolve, 80));
		result.clipboardFailureNotice = [...document.querySelectorAll('.notice')].map(node => node.textContent).find(text => text?.includes('复制失败')) ?? null;
		clipboard.writeText = originalWrite;
	} finally {
		for (const leaf of createdLeaves.reverse()) leaf.detach();
		if (originalLeaf) app.workspace.setActiveLeaf(originalLeaf, { focus: true });
	}
	return result;
})()
