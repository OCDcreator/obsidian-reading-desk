import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('docs/self-check');
function cli(...args) {
 const run = spawnSync('obsidian', ['vault=testvault', ...args], { encoding: 'utf8' });
 if (run.status) throw new Error(run.stderr || run.stdout);
 return run.stdout.trim();
}
function evaluate(code) {
 const raw = cli('eval', `code=${code}`);
 if (raw.startsWith('Error:')) throw new Error(raw);
 const result = raw.replace(/^=>\s*/, '');
 try { return JSON.parse(result); } catch { return result; }
}
function measure() {
 const visible = el => { const r = el.getBoundingClientRect(); const c=getComputedStyle(el);return r.width>0 && r.height>0 && c.visibility!=='hidden' && c.display!=='none'; };
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
 const rgb = value => {ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);};
 const blend=(front,back)=>{const a=front[3]/255;return [0,1,2].map(i=>front[i]*a+back[i]*(1-a)).concat(255);};
 const background=el=>{let layers=[];for(let p=el;p;p=p.parentElement)layers.push(rgb(getComputedStyle(p).backgroundColor));return layers.reverse().reduce((back,front)=>blend(front,back),[255,255,255,255]);};
 const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const metrics=el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect(),bg=background(el),fg=blend(rgb(c.color),bg),L=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);ctx.font=c.font;const ch=ctx.measureText('0').width;return {tag:el.tagName,cls:el.className,text:el.textContent?.trim().slice(0,120),aria:el.getAttribute('aria-label'),rect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},padding:c.padding,margin:c.margin,gap:c.gap,fontSize:c.fontSize,fontWeight:c.fontWeight,lineHeight:c.lineHeight,letterSpacing:c.letterSpacing,maxWidth:c.maxWidth,measureCh:ch?r.width/ch:null,color:c.color,background:c.backgroundColor,resolvedForeground:fg,resolvedBackground:bg,contrast:(L[0]+.05)/(L[1]+.05),outline:c.outline,outlineOffset:c.outlineOffset,overflowX:c.overflowX,overflowY:c.overflowY,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,disabled:el.disabled??null,focusVisible:el.matches(':focus-visible'),inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};};
 const selectors=['.rd-reader-heading','.rd-book-cover','.rd-setting-heading','.rd-settings-heading','.rd-excerpt-card','.rd-excerpt-card__title','.rd-excerpt-card__text','.rd-excerpt-card__controls','.rd-shelf','.rd-shelf-header','.rd-shelf-heading','.rd-shelf-toolbar','.rd-shelf-search','.rd-section-title','.rd-continue-reading-list','.rd-shelf-grid','.rd-shelf-card','.rd-book-title','.rd-book-author','.rd-book-meta','.rd-category-panel','.rd-category-manager','.rd-library-table','.rd-reader','.rd-reader-toolbar','.rd-reader-body','.rd-pdf-page-host','.rd-target-panel','.rd-target-panel h3','.rd-target-panel p','.rd-highlight-drawer:not(.is-hidden)','.rd-highlight-row','.rd-highlight-row__target','.rd-highlight-row__jump','.rd-comment-popover-host','.rd-comment-popover','.rd-comment-popover h3','.rd-comment-popover__excerpt','.rd-comment-popover__comment','.rd-comment-popover textarea','.rd-swatch','.rd-highlight-comment-button','.rd-empty','.rd-error','.rd-shelf-empty','.reading-desk-settings','.reading-desk-settings h2','.reading-desk-settings h3','.reading-desk-settings .setting-item-name','.reading-desk-settings .setting-item-description'];
 const samples={};for(const selector of selectors){const els=[...document.querySelectorAll(selector)].filter(visible);if(els.length)samples[selector]={count:els.length,items:els.slice(0,4).map(metrics)};}
 const roots=[...document.querySelectorAll('.rd-shelf,.rd-reader,.reading-desk-settings,.rd-comment-popover-host')].filter(visible);
 const controls=roots.flatMap(root=>[...root.querySelectorAll('button,input,select,textarea,[role=button]')].filter(visible).map(metrics));
 const overflow=roots.flatMap(root=>[root,...root.querySelectorAll('*')].filter(el=>visible(el)&&el.scrollWidth>el.clientWidth+2&&el.clientWidth>0).map(metrics));
 const images=roots.flatMap(root=>[...root.querySelectorAll('img')].map(im=>({src:im.getAttribute('src'),complete:im.complete,naturalWidth:im.naturalWidth,naturalHeight:im.naturalHeight,rect:im.getBoundingClientRect().toJSON()})));
 return {time:new Date().toISOString(),title:document.title,url:location.href,theme:document.body.className,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},samples,controls,overflow,images,activeElement:document.activeElement?metrics(document.activeElement):null};
}
const [verb,arg]=process.argv.slice(2);
if(verb==='settings') {
 const probe=JSON.parse(readFileSync(resolve(out,'visual-settings-probe.json'),'utf8'));
 if(probe.status!=='selected') throw new Error('No selected Settings target');
 const socket=new WebSocket(probe.target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
 const call=(method,params={})=>new Promise(resolve=>{const id=++seq;pending.set(id,resolve);socket.send(JSON.stringify({id,method,params}));});
 if(arg==='scroll-bottom') console.log(await call('Runtime.evaluate',{expression:"document.querySelector('.reading-desk-settings').scrollTop=9999; JSON.stringify({scroll:document.querySelector('.reading-desk-settings').scrollTop})",returnByValue:true}));
 else {
  const r=await call('Runtime.evaluate',{expression:`(${measure.toString()})()`,returnByValue:true});const result=r.result.result.value;
  const p=resolve(out,arg?.startsWith('confirm-')?'measurements-confirmation.json':'measurements.json');const data=existsSync(p)?JSON.parse(readFileSync(p,'utf8')):{kind:'real-obsidian-ui',round:2,captures:[]};data.captures.push({id:arg,screenshot:`docs/self-check/visual-${arg}.png`,targetId:probe.target.id,...result});writeFileSync(p,JSON.stringify(data,null,2)+'\n');
  const screen=await call('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,`visual-${arg}.png`),Buffer.from(screen.result.data,'base64'));
  console.log(JSON.stringify({id:arg,viewport:result.viewport,samples:Object.keys(result.samples).length,controls:result.controls.length,overflow:result.overflow.length}));
 }
 socket.close();
} else if(verb==='eval') console.log(JSON.stringify(evaluate(arg)));
else if(verb==='measure') {
 const result=evaluate(`JSON.stringify((${measure.toString()})())`);
 const path=resolve(out,arg?.startsWith('confirm-')?'measurements-confirmation.json':'measurements.json');
 const data=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{kind:'real-obsidian-ui',round:arg?.startsWith('confirm-')?2:1,captures:[]};
 data.captures.push({id:arg,screenshot:`docs/self-check/visual-${arg}.png`,...result});
 writeFileSync(path,JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({id:arg,sampleGroups:Object.keys(result.samples??{}).length,overflowCount:result.overflow?.length,viewport:result.viewport}));
 console.log(cli('dev:screenshot',`path=${resolve(out,`visual-${arg}.png`)}`));
} else if(verb==='viewport') {
 const [width,height]=arg.split('x').map(Number);
 console.log(cli('dev:cdp','method=Emulation.setDeviceMetricsOverride',`params=${JSON.stringify({width,height,deviceScaleFactor:1,mobile:false})}`));
} else throw new Error('Use eval <code> | measure <id> | viewport <width>x<height>');
