import fs from 'node:fs';
import path from 'node:path';

const phase = process.argv[2] ?? 'baseline';
const output = path.resolve('.obsidian-debug/reader-layout-20260920');
fs.mkdirSync(output, { recursive: true });
const targets = (await (await fetch('http://127.0.0.1:9222/json/list')).json())
	.filter(tab => tab.type === 'page' && tab.url === 'app://obsidian.md/index.html' && tab.title.includes('testvault'));
if (targets.length !== 1) throw new Error(`Expected exactly one testvault app://obsidian.md target, found ${targets.length}`);
const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
socket.addEventListener('message', event => {
	const message = JSON.parse(event.data);
	const task = pending.get(message.id);
	if (!task) return;
	pending.delete(message.id);
	message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
	const key = ++id;
	pending.set(key, { resolve, reject });
	socket.send(JSON.stringify({ id: key, method, params }));
});
const evaluate = async expression => {
	const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
	return result.result.value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const geometry = `(() => {
	const root = [...document.querySelectorAll('.rd-reader')].find(el => el.getBoundingClientRect().width > 0);
	if (!root) throw Error('Reader leaf not visible');
	const rect = el => { const r = el?.getBoundingClientRect(); return r ? { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom } : null; };
	const toolbar = root.querySelector('.rd-reader-toolbar');
	const nav = [...document.querySelectorAll('.rd-reader-navigation')].find(el => el.getBoundingClientRect().width > 0);
	const stage = root.querySelector('.rd-pdf-stage');
	const panel = nav?.querySelector('.rd-reader-navigation__panel');
	const thumbs = [...(panel?.querySelectorAll('.rd-reader-thumbnail') ?? [])];
	const canvas = root.querySelector('.rd-pdf-canvas');
	return { width: rect(root).width, size: root.dataset.rdSize, mode: nav?.querySelector('[aria-selected="true"]')?.textContent,
		root:rect(root), toolbar:rect(toolbar), body:rect(root.querySelector('.rd-reader-body')),
		nav:rect(nav), navInReader:root.contains(nav), tabs:rect(nav?.querySelector('.rd-reader-navigation__tabs')), panel:rect(panel), stage:rect(stage), pdf:rect(canvas),
		groups:[...toolbar.querySelectorAll('[data-rd-toolbar-group]')].map(el=>({name:el.dataset.rdToolbarGroup, rect:el.getClientRects().length?rect(el):null})),
		controls:[...toolbar.querySelectorAll('button,select,input')].filter(el=>el.getClientRects().length).map(el=>({name:el.getAttribute('aria-label')||el.textContent, title:el.getAttribute('title'), text:el.textContent, rect:rect(el)})),
		hiddenControls:[...toolbar.querySelectorAll('[data-rd-overflow]')].filter(el=>!el.getClientRects().length).map(el=>el.getAttribute('aria-label')),
		more:rect(toolbar.querySelector('.rd-reader-toolbar__more')),
		thumbnails:thumbs.slice(0,4).map(el=>({button:rect(el), canvas:rect(el.querySelector('canvas'))})),
		ready:!!canvas && [...(panel?.querySelectorAll('canvas') ?? [])].every(el=>el.width>0&&el.height>0),
		nativeCanvasLeaves:app.workspace.getLeavesOfType('canvas').length };
})()`;
const failures = [];
const samples = [];
const inside = (outer, inner, pad = 1) => !!outer && !!inner && inner.x >= outer.x-pad && inner.y >= outer.y-pad && inner.right <= outer.right+pad && inner.bottom <= outer.bottom+pad;
const intersects = (a,b) => a && b && a.x < b.right-1 && a.right > b.x+1 && a.y < b.bottom-1 && a.bottom > b.y+1;
const check = (sample, target, mode, expanded) => {
	const label = `${target}px ${mode}${expanded?' expanded':''}`;
	if (Math.abs(sample.width-target)>12) failures.push(`${label}: actual width ${sample.width}`);
	if (sample.groups.map(g=>g.name).join(',') !== 'target,annotation,fit,page,color') failures.push(`${label}: toolbar semantic groups missing/out of order`);
	if (sample.toolbar.height > 64 || new Set(sample.groups.filter(group=>group.rect).map(group=>Math.round(group.rect.y+group.rect.height/2))).size!==1) failures.push(`${label}: toolbar is not a single row (${Math.round(sample.toolbar.height)}px)`);
	if (target<=574 && (!sample.more || !sample.hiddenControls.length)) failures.push(`${label}: compact toolbar has no working overflow affordance`);
	if (target<=574 && sample.controls.some(control=>!control.name.startsWith('以') && control.rect.width<28 && !control.name.startsWith('当前页'))) failures.push(`${label}: icon buttons squeezed below 28px`);
	for (const control of sample.controls) if (!inside(sample.toolbar,control.rect)) failures.push(`${label}: clipped toolbar control ${control.name}`);
	for (const control of sample.controls.filter(control=>control.text && control.title)) if (control.text.trim()) failures.push(`${label}: text button ${control.name}`);
	for (const group of sample.groups.filter(group=>group.rect)) if (!inside(sample.toolbar,group.rect)) failures.push(`${label}: clipped toolbar group ${group.name}`);
	if (sample.navInReader) failures.push(`${label}: navigation still consumes Reader body`);
	if (intersects(sample.nav,sample.stage)) failures.push(`${label}: navigation overlaps PDF stage`);
	if (!sample.tabs || sample.tabs.height<28) failures.push(`${label}: navigation tabs missing`);
	if (mode==='缩略图') {
		if (!sample.ready || !sample.thumbnails.length) failures.push(`${label}: thumbnail previews not painted`);
		for (let i=0;i<sample.thumbnails.length;i++) {
			const item=sample.thumbnails[i];
			if (!inside(item.button,item.canvas)) failures.push(`${label}: thumbnail ${i+1} canvas outside button`);
			if (i && intersects(sample.thumbnails[i-1].button,item.button)) failures.push(`${label}: thumbnails ${i} and ${i+1} intersect`);
		}
	}
};
async function runCanvasAcceptance() {
	const initial = await evaluate(`({leftCollapsed:app.workspace.leftSplit.collapsed,rightCollapsed:app.workspace.rightSplit.collapsed,leftWidth:app.workspace.leftSplit.containerEl.getBoundingClientRect().width,rightWidth:app.workspace.rightSplit.containerEl.getBoundingClientRect().width,readerIds:app.workspace.getLeavesOfType('reading-desk-reader').map(leaf=>leaf.id)})`);
	let setup;
	let sourceJump;
	let reverseDelete;
	let cleanup;
	try {
		setup = await evaluate(`(async()=>{
			if(app.workspace.getLeavesOfType('canvas').length) throw Error('Close existing Canvas leaves before acceptance');
			const plugin=app.plugins.plugins['obsidian-reading-desk'];
			const path='Reading Desk Fixtures/layout-native-canvas-'+Date.now()+'.canvas';
			await app.vault.create(path,JSON.stringify({nodes:[],edges:[]}));
			const now=Date.now(),id='layout-highlight-'+now,pdfPath='Reading Desk Fixtures/functional-excal-source.pdf';
			const highlight={id,pdfPath,page:0,rotation:0,rects:[{left:.08,top:.14,width:.34,height:.05}],text:'Reader 与原生 Canvas 布局验收摘录',color:'moss',chapterPath:['Introduction'],tags:['布局验收'],createdAt:now,updatedAt:now};
			await plugin.targets.syncOutline(path,pdfPath,[{title:'Introduction',page:0,path:['Introduction']}]);
			const written=await plugin.targets.writeExcerpt({type:'canvas',path},highlight,{title:'布局验收摘录'});
			highlight.target=written.target;await plugin.annotations.save(highlight);
			const reader=app.workspace.getLeavesOfType('reading-desk-reader')[0];app.workspace.setActiveLeaf(reader,{focus:true});
			await plugin.openTargetInSplit(path,written.target.objectId);await new Promise(resolve=>setTimeout(resolve,700));
			app.workspace.leftSplit.expand();app.workspace.rightSplit.collapse();await new Promise(resolve=>setTimeout(resolve,300));
			const leaf=app.workspace.getLeavesOfType('canvas').find(item=>item.view.file?.path===path);leaf.view.canvas.zoomToFit();await new Promise(resolve=>setTimeout(resolve,500));
			const canvasData=leaf.view.canvas.getData();
			window.__rdLayoutCanvas={path,id,objectId:written.target.objectId,canvasLeafId:leaf.id};
			return {path,id,objectId:written.target.objectId,readerWidth:document.querySelector('.rd-reader')?.getBoundingClientRect().width,canvasWidth:leaf.view.containerEl.getBoundingClientRect().width,viewType:leaf.view.getViewType(),nodeCount:canvasData.nodes.length,chapterCount:canvasData.nodes.filter(node=>node.readingDesk?.kind==='chapter').length,excerptCount:canvasData.nodes.filter(node=>node.readingDesk?.kind==='excerpt').length,excerptEdgeCount:canvasData.edges.filter(edge=>edge.readingDesk?.kind==='excerpt-edge').length,sourceLink:canvasData.nodes.find(node=>node.id===written.target.objectId)?.readingDesk?.sourceLink};
		})()`);
		const shot = await send('Page.captureScreenshot',{format:'png'});
		fs.writeFileSync(path.join(output,'reader-native-canvas.png'),Buffer.from(shot.data,'base64'));
		sourceJump = await evaluate(`(async()=>{
			const state=window.__rdLayoutCanvas,leaf=app.workspace.getLeavesOfType('canvas').find(item=>item.id===state.canvasLeafId);
			const anchor=[...leaf.view.containerEl.querySelectorAll('a')].find(item=>item.href.includes('reading-desk-highlight'));
			if(!anchor)return {ok:false,reason:'source anchor not rendered'};
			anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));await new Promise(resolve=>setTimeout(resolve,900));
			const readers=app.workspace.getLeavesOfType('reading-desk-reader');
			return {ok:readers.some(item=>item.view.getState().pdfPath==='Reading Desk Fixtures/functional-excal-source.pdf'&&item.view.containerEl.querySelector('[data-highlight-id="'+state.id+'"]')),href:anchor.getAttribute('href'),readerCount:readers.length};
		})()`);
		reverseDelete = await evaluate(`(async()=>{
			const state=window.__rdLayoutCanvas,plugin=app.plugins.plugins['obsidian-reading-desk'];
			const leaf=app.workspace.getLeavesOfType('canvas').find(item=>item.id===state.canvasLeafId),node=leaf.view.canvas.nodes.get(state.objectId);
			leaf.view.canvas.removeNode(node);leaf.view.canvas.requestSave();leaf.view.requestSave();
			const end=Date.now()+5000;while(Date.now()<end&&plugin.annotations.get(state.id))await new Promise(resolve=>setTimeout(resolve,100));
			const content=await app.vault.read(app.vault.getAbstractFileByPath(state.path));
			return {annotationRemoved:!plugin.annotations.get(state.id),nodeRemoved:!content.includes(state.objectId)};
		})()`);
	} finally {
		cleanup = await evaluate(`(async()=>{
			const state=window.__rdLayoutCanvas;if(state){
				app.workspace.getLeavesOfType('canvas').filter(leaf=>leaf.id===state.canvasLeafId).forEach(leaf=>leaf.detach());
				const file=app.vault.getAbstractFileByPath(state.path);if(file)await app.vault.trash(file,false);
				for(const leaf of app.workspace.getLeavesOfType('reading-desk-reader'))if(!${JSON.stringify(initial.readerIds)}.includes(leaf.id))leaf.detach();
			}
			app.workspace.leftSplit.${initial.leftCollapsed?'collapse':'expand'}();app.workspace.rightSplit.${initial.rightCollapsed?'collapse':'expand'}();app.workspace.leftSplit.setSize(${initial.leftWidth});app.workspace.rightSplit.setSize(${initial.rightWidth});delete window.__rdLayoutCanvas;
			return {canvasLeaves:app.workspace.getLeavesOfType('canvas').length,tempFilePresent:!!state&&!!app.vault.getAbstractFileByPath(state.path),restoredReaderIds:app.workspace.getLeavesOfType('reading-desk-reader').map(leaf=>leaf.id)};
		})()`);
		socket.close();
	}
	const result={target:targets[0].id,title:targets[0].title,initial,setup,sourceJump,reverseDelete,cleanup};
	if(setup?.viewType!=='canvas'||setup.chapterCount!==1||setup.excerptCount!==1||setup.excerptEdgeCount!==1||!setup.sourceLink)failures.push('native Canvas chapter/excerpt/source-link contract failed');
	if(!sourceJump?.ok)failures.push(`Canvas source jump failed: ${sourceJump?.reason??'no matching Reader highlight'}`);
	if(!reverseDelete?.annotationRemoved||!reverseDelete?.nodeRemoved)failures.push('native Canvas reverse deletion did not reconcile AnnotationStore');
	if(cleanup?.canvasLeaves||cleanup?.tempFilePresent)failures.push('temporary native Canvas cleanup failed');
	fs.writeFileSync(path.join(output,'canvas.json'),JSON.stringify({...result,failures},null,2));
	console.log(JSON.stringify({...result,failures},null,2));
}

if (phase === 'menu') {
	const initial = await evaluate(`({rightCollapsed:app.workspace.rightSplit.collapsed,rightWidth:app.workspace.rightSplit.containerEl.getBoundingClientRect().width})`);
	try {
		await evaluate(`app.workspace.rightSplit.expand();true`);
		await delay(250);
		await evaluate(`app.workspace.rightSplit.setSize(828);true`);
		await delay(250);
		const rect = await evaluate(`document.querySelector('.rd-reader-toolbar__more').getBoundingClientRect().toJSON()`);
		const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
		await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
		await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
		await delay(200);
		const result=await evaluate(`({reader:document.querySelector('.rd-reader').getBoundingClientRect().width,menu:[...document.querySelectorAll('.menu-item')].map(el=>el.textContent),allMenus:document.querySelectorAll('.menu').length})`);
		const shot=await send('Page.captureScreenshot',{format:'png'});
		fs.writeFileSync(path.join(output,'overflow-menu.png'),Buffer.from(shot.data,'base64'));
		result.cropOpened=await evaluate(`(async()=>{[...document.querySelectorAll('.menu-item')].find(el=>el.textContent==='裁剪')?.click();await new Promise(resolve=>setTimeout(resolve,100));return !!document.querySelector('.rd-crop-overlay')})()`);
		result.cropClosed=await evaluate(`(()=>{const overlay=document.querySelector('.rd-crop-overlay');overlay?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return !document.querySelector('.rd-crop-overlay')})()`);
		fs.writeFileSync(path.join(output,'menu.json'),JSON.stringify(result,null,2));
		console.log(JSON.stringify(result,null,2));
		if(!result.menu.includes('裁剪')||!result.menu.includes('缩小')||!result.menu.includes('复制本页链接')||!result.cropOpened||!result.cropClosed)process.exitCode=1;
	} finally {
		await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
		await evaluate(`app.workspace.rightSplit.setSize(${initial.rightWidth});app.workspace.rightSplit.${initial.rightCollapsed?'collapse':'expand'}();true`);
		socket.close();
	}
} else if (phase === 'canvas') {
	await runCanvasAcceptance();
	if (failures.length) process.exitCode=1;
} else {
const initial = await evaluate(`({leftCollapsed:app.workspace.leftSplit.collapsed,rightCollapsed:app.workspace.rightSplit.collapsed,leftWidth:app.workspace.leftSplit.containerEl.getBoundingClientRect().width,rightWidth:app.workspace.rightSplit.containerEl.getBoundingClientRect().width})`);
try {
	for (const width of [428,574,754,1214]) {
		await evaluate(`(async()=>{app.workspace.leftSplit.expand();app.workspace.rightSplit.expand();await app.plugins.plugins['obsidian-reading-desk'].openPdfNavigation();await new Promise(resolve=>setTimeout(resolve,180));return true})()`);
		for (let attempt=0;attempt<5;attempt++) {
			const measurement = await evaluate(`({reader:document.querySelector('.rd-reader')?.getBoundingClientRect().width,right:app.workspace.rightSplit.containerEl.getBoundingClientRect().width})`);
			if (Math.abs(measurement.reader-width)<3) break;
			const next = Math.round(measurement.right+measurement.reader-width);
			await evaluate(`app.workspace.rightSplit.setSize(${next});true`);
			await delay(180);
			if (phase==='baseline') console.log(`resize ${width}: reader ${measurement.reader}, right ${measurement.right} -> ${next}`);
		}
		// The right sidebar's size sets the real Obsidian main leaf width.
		for (const mode of ['目录','缩略图']) {
			await evaluate(`(() => {const tab=[...document.querySelectorAll('.reading-desk-pdf-navigation-host .rd-reader-navigation__tab')].find(x=>x.textContent===${JSON.stringify(mode)});if(!tab)throw Error('PDF navigation sidebar tab missing');tab.click();return true})()`);
			await delay(mode==='缩略图'?1300:300);
			let sample = await evaluate(geometry);
			check(sample,width,mode,false);
			samples.push({target:width,...sample});
			if (phase==='after') {
				const shot = await send('Page.captureScreenshot',{format:'png'});
				fs.writeFileSync(path.join(output,`${width}-${mode}.png`),Buffer.from(shot.data,'base64'));
			}
		}
	}
} finally {
	await evaluate(`app.workspace.leftSplit.${initial.leftCollapsed?'collapse':'expand'}();app.workspace.rightSplit.${initial.rightCollapsed?'collapse':'expand'}();app.workspace.leftSplit.setSize(${initial.leftWidth});app.workspace.rightSplit.setSize(${initial.rightWidth});true`);
	socket.close();
}
fs.writeFileSync(path.join(output,`${phase}.json`),JSON.stringify({target:targets[0].id,title:targets[0].title,initial,samples,failures},null,2));
console.log(JSON.stringify({phase, widths:samples.map(s=>`${s.target}:${Math.round(s.width)}:${s.mode}${s.expanded?'+':''}`),failures},null,2));
if (failures.length) process.exitCode=1;
}
