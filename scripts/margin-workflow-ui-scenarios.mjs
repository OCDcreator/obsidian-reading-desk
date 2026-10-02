/** DRAFT QA harness: not wired into the smoke runner. Finish margin-workflow-settings.mjs and review cleanup before running; see docs/continue-on-mac-0.5.0.md. */
import fs from 'node:fs';
import path from 'node:path';
import { withFunctionalFixture, buildFixturePdf } from './enhancement-functional-scenarios.mjs';

const remote = (evaluate, fn, ...args) => evaluate('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const assert = (value, message) => { if (!value) throw Error(message); };
async function poll(read, message, timeout = 12000) {
 const end = Date.now() + timeout;
 while (Date.now() < end) { const value = await read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 40)); }
 throw Error(message);
}
function controls({ evaluate, send }, root) {
 return {
  async click(label) {
   const rect = await remote(evaluate, (root, label) => { const base = eval(root); const e = [...base.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === label); if (!e || e.disabled) throw Error('Missing/disabled ' + label); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}; }, root, label);
   if (!rect.w || !rect.h) throw Error('Hidden ' + label);
   await send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x,y:rect.y,button:'left',clickCount:1});
  },
  async type(label,value) { await this.click(label); await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:4,windowsVirtualKeyCode:65}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:4,windowsVirtualKeyCode:65}); await send('Input.insertText',{text:value}); },
  async tab() { await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); }
 };
}
async function prepareRemote(key) {
 const s=globalThis[key],p=s.plugin;
 s.workflow={originalShelf:structuredClone(p.repository.readSettings().shelf),lastShelf:undefined,listIds:new Set(),originalTab:localStorage.getItem('reading-desk-settings-tab')};
 const w=s.workflow;w.listName='Margin QA '+s.fixture.runId; w.leaf=app.workspace.getLeaf(true);
 await w.leaf.setViewState({type:'reading-desk-shelf',state:{},active:true});app.workspace.setActiveLeaf(w.leaf,{focus:true});
 return {name:w.listName,book:p.library.getByPath(s.fixture.pdf)};
}
async function cleanupRemote(key) {
 const s=globalThis[key];if(!s?.workflow)return {skipped:true};const w=s.workflow,p=s.plugin;
 app.setting.close();
 if(w.originalUpdate){p.library.updateBook=w.originalUpdate;w.releaseTitle?.();delete w.originalUpdate;}
 if(w.leaf&&s.findLeaf(w.leaf.id)){await w.leaf.setViewState({type:'empty',state:{},active:false});w.leaf.detach();}
 const current=p.repository.readSettings().shelf;const restore=current?.query?.query===s.fixture.runId||JSON.stringify(current)===JSON.stringify(w.lastShelf);
 await p.repository.commit(()=>{
  const lists=p.repository.readLists();for(const id of w.listIds){const position=lists.findIndex(l=>l.id===id&&l.name.startsWith(w.listName));if(position>=0){lists.splice(position,1);for(const b of Object.values(p.repository.readBooks()))if(b.path===s.fixture.pdf)b.listIds=b.listIds?.filter(i=>i!==id);}}
  if(restore)p.repository.readSettings().shelf=w.originalShelf;
 });
 if(w.originalTab===null)localStorage.removeItem('reading-desk-settings-tab');else localStorage.setItem('reading-desk-settings-tab',w.originalTab);
 return {fixtureListsRemain:p.repository.readLists().filter(l=>w.listIds.has(l.id)).length,shelfRestored:restore,unrelatedShelfPreserved:!restore};
}
async function shot(send,output,name){const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name),Buffer.from(s.data,'base64'));}

export async function runWorkflowScenarios({evaluate,send,output}) {
 return withFunctionalFixture({evaluate,send,output,buildPdf:buildFixturePdf,pageCount:2,scenario:async({key,result,fixture})=>{
  const root='globalThis['+JSON.stringify(key)+'].workflow.leaf.view.containerEl';const ui=controls({evaluate,send},root);
  try {
   const initial=await remote(evaluate,prepareRemote,key);
   await ui.type('搜索书架',fixture.runId);await ui.click('新建阅读列表');await ui.type('阅读列表名称',initial.name);await ui.click('创建阅读列表');
   const list=await poll(()=>remote(evaluate,(key)=>{const s=globalThis[key];return s.plugin.library.listLists().find(l=>l.name===s.workflow.listName);},key),'Create list failed');
   await remote(evaluate,(key,id)=>globalThis[key].workflow.listIds.add(id),key,list.id);
   await ui.click('管理阅读列表');await ui.type('阅读列表名称：'+initial.name,initial.name+' renamed');await ui.click('保存阅读列表名称：'+initial.name);
   await poll(()=>remote(evaluate,(key,id)=>globalThis[key].plugin.library.listLists().find(l=>l.id===id)?.name.endsWith(' renamed'),key,list.id),'Rename failed');
   await ui.click('删除阅读列表：'+initial.name+' renamed');
   assert(await remote(evaluate,(key,id)=>globalThis[key].plugin.library.listLists().some(l=>l.id===id),key,list.id),'Premature delete');
   await ui.click('确认删除阅读列表：'+initial.name+' renamed');await poll(()=>remote(evaluate,(key,id)=>!globalThis[key].plugin.library.listLists().some(l=>l.id===id),key,list.id),'Delete failed');
   await ui.click('关闭管理阅读列表');await ui.click('表格视图');
   await poll(()=>remote(evaluate,key=>globalThis[key].plugin.repository.readSettings().shelf?.mode==='table',key),'Shelf state save failed');
   await remote(evaluate,async key=>{const s=globalThis[key],w=s.workflow;w.lastShelf=structuredClone(s.plugin.repository.readSettings().shelf);await w.leaf.setViewState({type:'empty',state:{},active:false});w.leaf.detach();w.leaf=app.workspace.getLeaf(true);await w.leaf.setViewState({type:'reading-desk-shelf',state:{},active:true});app.workspace.setActiveLeaf(w.leaf,{focus:true});},key);
   assert(await remote(evaluate,key=>globalThis[key].workflow.leaf.view.containerEl.querySelector('[aria-label="搜索书架"]').value===globalThis[key].fixture.runId,key),'Reopen query mismatch');
   await remote(evaluate,key=>{const s=globalThis[key],index=s.plugin.library,original=index.updateBook;s.workflow.originalUpdate=original;index.updateBook=async function(id,patch){if(id===index.getByPath(s.fixture.pdf).id&&Object.hasOwn(patch,'title'))await new Promise(r=>s.workflow.releaseTitle=r);return original.call(this,id,patch);};},key);
   await ui.type(initial.book.title+' 的标题',initial.book.title+' QA');await ui.tab();await ui.type(initial.book.title+' 的作者','Fixture author draft');
   await remote(evaluate,key=>globalThis[key].workflow.releaseTitle?.(),key);
   await poll(()=>remote(evaluate,(key,title)=>globalThis[key].workflow.leaf.view.containerEl.querySelector('[aria-label="'+title+' QA 的作者"]')?.value==='Fixture author draft',key,initial.book.title),'Draft lost');
   await ui.tab();await poll(()=>remote(evaluate,key=>globalThis[key].plugin.library.getByPath(globalThis[key].fixture.pdf)?.author==='Fixture author draft',key),'Draft not persisted');
   await remote(evaluate,key=>{const s=globalThis[key];s.plugin.library.updateBook=s.workflow.originalUpdate;delete s.workflow.originalUpdate;},key);
   result.samples.shelf={actionSource:'CDP mouse/key/insertText; internal fixture setup and artificial delayed persistence',listCrud:true,reopen:true,draft:true};await shot(send,output,'workflow-shelf.png');
   const {runSettingsWorkflow}=await import('./margin-workflow-settings.mjs');result.samples.settings=await runSettingsWorkflow({evaluate,output,key,fixture});
   await remote(evaluate,async key=>{const s=globalThis[key],f=app.vault.getAbstractFileByPath(s.fixture.pdf),id='anchor-qa-'+s.fixture.runId;await s.plugin.annotations.save({id,pdfPath:s.fixture.pdf,page:0,pageLabel:'i',rotation:0,rects:[{x:.05,y:.05,width:.2,height:.05}],text:'cross span phrase',color:'moss',chapterPath:[],tags:[],createdAt:Date.now(),updatedAt:Date.now(),sourceFingerprint:{mtime:f.stat.mtime-1,size:f.stat.size}});await s.collect();await app.workspace.revealLeaf(s.leaf);app.workspace.setActiveLeaf(s.leaf,{focus:true});s.view().setDrawerVisible(true);await s.view().refreshAnnotations();s.view().containerEl.querySelector('.rd-source-anchor-diagnostics summary').setAttribute('aria-label','展开源文件核验');},key);
   const rui=controls({evaluate,send},'globalThis['+JSON.stringify(key)+'].view().containerEl');await rui.click('展开源文件核验');await rui.click('查找引文：PDF 第 1 页');
   result.samples.source=await poll(()=>remote(evaluate,key=>{const v=globalThis[key].view(),input=v.containerEl.querySelector('[aria-label="搜索关键词"]');return input?.value==='cross span phrase'?{changed:v.containerEl.querySelector('.rd-source-anchor-diagnostics').textContent.includes('文件信息变化'),query:input.value}:null;},key),'Quote search failed');
  } finally {result.samples.workflowCleanup=await remote(evaluate,cleanupRemote,key);}
 }});
}
export {controls,poll,remote,shot};
