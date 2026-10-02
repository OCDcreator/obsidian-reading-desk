import fs from 'node:fs';
import path from 'node:path';

export async function runUiScenarios({ evaluate, send, output }) {
	const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
	const screenshot = async name => { const image = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, name), Buffer.from(image.data, 'base64')); };
	const initial = await evaluate(`({active:app.workspace.activeLeaf?.id,leafIds:app.workspace.getLeavesOfType('reading-desk-shelf').map(l=>l.id),reader:app.workspace.getLeavesOfType('reading-desk-reader')[0]?.id,leftCollapsed:app.workspace.leftSplit.collapsed,rightCollapsed:app.workspace.rightSplit.collapsed,leftWidth:app.workspace.leftSplit.containerEl.getBoundingClientRect().width,rightWidth:app.workspace.rightSplit.containerEl.getBoundingClientRect().width,dark:document.body.classList.contains('theme-dark'),light:document.body.classList.contains('theme-light'),tab:localStorage.getItem('reading-desk-settings-tab')})`);
	const failures = [], samples = {};
	try {
		await evaluate(`app.setting.close();true`); await pause(500);
		await evaluate(`app.plugins.plugins['obsidian-reading-desk'].openShelf()`); await pause(300);
		samples.shelf = await evaluate(`(()=>{const root=[...document.querySelectorAll('.rd-shelf')].find(e=>e.getBoundingClientRect().width>0);const cards=[...root.querySelectorAll('.rd-shelf-card')];return {cards:cards.length,categoryFormVisible:!!root.querySelector('[aria-label="新分类名称"]'),continueHorizontal:!!root.querySelector('.rd-shelf-card--continue'),filters:root.querySelectorAll('.rd-shelf-filters select').length,batch:!!root.querySelector('[aria-label="批量整理已选图书"]')};})()`);
		if (!samples.shelf.cards || samples.shelf.categoryFormVisible || !samples.shelf.batch) failures.push('shelf controls/density failed');
		await evaluate(`document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');true`); await pause(250);
		await screenshot('shelf-light.png');
		samples.categories = await evaluate(`(()=>{const trigger=[...document.querySelectorAll('.rd-shelf button')].find(e=>e.getAttribute('aria-label')==='管理分类');trigger.click();const dialog=document.querySelector('.rd-shelf-dialog');const opened=!!dialog;dialog?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return {opened,closed:!document.querySelector('.rd-shelf-dialog'),focusReturned:document.activeElement===trigger};})()`);
		if (!samples.categories.opened || !samples.categories.closed || !samples.categories.focusReturned) failures.push('category disclosure/focus failed');
		await evaluate(`document.body.classList.remove('theme-light');document.body.classList.add('theme-dark');true`); await pause(250); await screenshot('shelf-dark.png');
		await evaluate(`document.body.classList.toggle('theme-dark',${initial.dark});document.body.classList.toggle('theme-light',${initial.light});true`);
		samples.annotationSearch = await evaluate(`(async()=>{const root=[...document.querySelectorAll('.rd-shelf')].find(e=>e.getBoundingClientRect().width>0);root.querySelector('[data-shelf-mode="annotations"]').click();root.querySelector('[aria-label="检索全库摘录与评论"]').click();await new Promise(r=>setTimeout(r,180));return {results:root.querySelectorAll('.rd-shelf-annotation-hit').length,zeroPage:[...root.querySelectorAll('.rd-shelf-annotation-hit button')].some(e=>e.textContent.includes('第 0 页'))};})()`);
		if (!samples.annotationSearch.results || samples.annotationSearch.zeroPage) failures.push('annotation search results/page display failed');
		await screenshot('annotation-search.png');
		if (initial.reader) {
			await evaluate(`(async()=>{const leaf=app.workspace.getLeavesOfType('reading-desk-reader').find(l=>l.id===${JSON.stringify(initial.reader)});await app.workspace.revealLeaf(leaf);app.workspace.setActiveLeaf(leaf,{focus:true});app.workspace.leftSplit.expand();app.workspace.rightSplit.expand();return true;})()`); await pause(300);
			samples.readerWidths = []; samples.widthAttempts = [];
			for (const width of [480,640,900]) {
				await evaluate(`(async()=>{const leaf=app.workspace.getLeavesOfType('reading-desk-reader').find(l=>l.id===${JSON.stringify(initial.reader)});await app.workspace.revealLeaf(leaf);return true;})()`); await pause(150);
				for (let attempt=0;attempt<6;attempt++) {
					const sizes = await evaluate(`({reader:[...document.querySelectorAll('.rd-reader')].find(e=>e.getBoundingClientRect().width>0)?.getBoundingClientRect().width,right:app.workspace.rightSplit.containerEl.getBoundingClientRect().width})`);
					samples.widthAttempts.push({ requested: width, ...sizes });
					if (!Number.isFinite(sizes.reader)) throw new Error('Reader is hidden during width setup');
					if (Math.abs(sizes.reader-width)<5) break;
					await evaluate(`app.workspace.rightSplit.setSize(${Math.round(sizes.right+sizes.reader-width)});true`); await pause(180);
				}
				const sample = await evaluate(`(()=>{const root=[...document.querySelectorAll('.rd-reader')].find(e=>e.getBoundingClientRect().width>0);const bar=root.querySelector('.rd-reader-toolbar'),rect=bar.getBoundingClientRect();return {width:root.getBoundingClientRect().width,height:rect.height,clipped:[...bar.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<rect.left-1||r.right>rect.right+1}).map(e=>e.getAttribute('aria-label'))};})()`);
				samples.readerWidths.push(sample); if (sample.clipped.length || sample.height>70) failures.push(`reader toolbar clipping at ${width}`);
				if (width===480) {
					const rect=await evaluate(`document.querySelector('.rd-reader-toolbar__more').getBoundingClientRect().toJSON()`), x=rect.x+rect.width/2,y=rect.y+rect.height/2;
					await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await pause(100);
					samples.more=await evaluate(`([...document.querySelectorAll('.menu-item')].map(e=>({text:e.textContent,disabled:e.classList.contains('is-disabled')})))`);
					for(const action of ['旋转','适合整页','反相']) if(!samples.more.some(item=>item.text.includes(action))) failures.push(`overflow action missing: ${action}`);
					if(!samples.more.some(item=>item.text.includes('单页模式')||item.text.includes('连续滚动'))) failures.push('overflow scroll mode missing');
					await screenshot('reader-480-more.png');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(300);
				}
				await screenshot(`reader-${width}.png`);
			}
		}
		await evaluate(`app.plugins.plugins['obsidian-reading-desk'].openPluginSettings('data')`); await pause(600);
		const { inspectSettingsWindow } = await import('./enhancement-settings-window.mjs');
		samples.dataPanel = await inspectSettingsWindow(output);
		if (!samples.dataPanel.exists || !samples.dataPanel.buttons.some(text=>text.includes('完整备份'))) failures.push('data panel missing backup entry');
	} catch (error) {
		failures.push(error.message);
		samples.failureState = await evaluate(`({active:app.workspace.activeLeaf?.id,readers:app.workspace.getLeavesOfType('reading-desk-reader').map(l=>({id:l.id,leaf:l.view.containerEl.getBoundingClientRect().toJSON(),root:l.view.containerEl.querySelector('.rd-reader')?.getBoundingClientRect().toJSON()})),left:app.workspace.leftSplit.containerEl.getBoundingClientRect().toJSON(),right:app.workspace.rightSplit.containerEl.getBoundingClientRect().toJSON()})`);
	} finally {
		await evaluate(`(()=>{app.setting?.close();app.workspace.leftSplit.setSize(${initial.leftWidth});app.workspace.rightSplit.setSize(${initial.rightWidth});app.workspace.leftSplit.${initial.leftCollapsed?'collapse':'expand'}();app.workspace.rightSplit.${initial.rightCollapsed?'collapse':'expand'}();document.body.classList.toggle('theme-dark',${initial.dark});document.body.classList.toggle('theme-light',${initial.light});app.workspace.getLeavesOfType('reading-desk-shelf').filter(l=>!${JSON.stringify(initial.leafIds)}.includes(l.id)).forEach(l=>l.detach());${initial.tab===null?"localStorage.removeItem('reading-desk-settings-tab');":`localStorage.setItem('reading-desk-settings-tab',${JSON.stringify(initial.tab)});`}let leaf;app.workspace.iterateAllLeaves(item=>{if(item.id===${JSON.stringify(initial.active)})leaf=item;});if(leaf)app.workspace.setActiveLeaf(leaf,{focus:true});return true;})()`);
	}
	const result={checkedAt:new Date().toISOString(),samples,failures};fs.writeFileSync(path.join(output,'ui-scenarios.json'),JSON.stringify(result,null,2));
	if(failures.length)throw new Error(JSON.stringify(result));
	return result;
}
