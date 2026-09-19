import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base='/Volumes/SDD2T/obsidian-vault-write/testvault/.obsidian/plugins/obsidian-reading-desk';
const hashes=()=>Object.fromEntries(['main.js','styles.css','manifest.json','pdf.worker.mjs'].map(n=>[n,createHash('sha256').update(readFileSync(`${base}/${n}`)).digest('hex')]));
function ev(code){const r=spawnSync('obsidian',['vault=testvault','eval',`code=${code}`],{encoding:'utf8'});if(r.status||r.stdout.startsWith('Error:'))throw Error(r.stdout+r.stderr);const s=r.stdout.trim().replace(/^=>\s*/,'');try{return JSON.parse(s)}catch{return s}}
async function until(code){const end=Date.now()+7000;while(Date.now()<end){if(ev(code)===true)return;await new Promise(r=>setTimeout(r,100))}throw Error('predicate timeout '+code)}
function sample(){const visible=x=>x.getBoundingClientRect().width>0;const reader=[...document.querySelectorAll('.rd-reader')].find(visible);const elements={};for(const s of ['.rd-reader-body','.rd-reader-toolbar','.rd-pdf-page-host','.rd-target-panel']){const x=reader.querySelector(s),r=x?.getBoundingClientRect();elements[s]=x?{rect:r.toJSON(),clientWidth:x.clientWidth,scrollWidth:x.scrollWidth}:null}const host=document.querySelector('.rd-comment-popover-host'),can=document.createElement('canvas'),ctx=can.getContext('2d');const rgb=c=>{ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};const lum=a=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);return {theme:app.getTheme(),viewport:[innerWidth,innerHeight],reader:reader.getBoundingClientRect().toJSON(),elements,popover:{sameNode:host===window.__rdLastPopover,rect:host?.getBoundingClientRect().toJSON(),background:host?getComputedStyle(host).backgroundColor:null},swatches:[...host.querySelectorAll('.rd-swatch')].map(x=>{const c=getComputedStyle(x),f=lum(rgb(c.color)),b=lum(rgb(c.backgroundColor));return{color:x.dataset.color,label:x.textContent,foreground:c.color,background:c.backgroundColor,contrast:(Math.max(f,b)+.05)/(Math.min(f,b)+.05)}})} }
const action=process.argv[2],file='docs/self-check/visual-v03-v06-final.json';
if(action==='light'){
 const identity={buildId:'0.1.1+2026-09-18T17:18:51.094Z',deployed:hashes(),scope:'Only V03 and V06; independent loaded UI, no source/build/reload'};
 identity.initial=ev("JSON.stringify({theme:app.getTheme(),left:app.workspace.leftSplit.collapsed,right:app.workspace.rightSplit.collapsed,rightWidth:app.workspace.getLayout().right.width})");
 ev("app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('reading-desk-reader')[0],{focus:true});app.workspace.rightSplit.expand();app.workspace.rightSplit.setSize(706);app.changeTheme('moonstone');const r=app.workspace.activeLeaf.view.containerEl;const b=[...r.querySelectorAll('.rd-reader-toolbar button')].find(x=>x.textContent==='分栏目标');b?.click();'requested'");
 await until("!!document.querySelector('.rd-reader-body--split .rd-target-panel') && document.querySelector('.rd-reader-body--split .rd-pdf-text-layer')?.children.length>0");
 ev("[...document.querySelectorAll('.rd-reader-toolbar button')].find(x=>x.textContent==='适应宽度').click();'fit'");
 await until("document.querySelector('.rd-pdf-page-host')?.clientWidth===document.querySelector('.rd-pdf-page-host')?.scrollWidth && document.querySelector('.rd-pdf-text-layer')?.children.length>0");
 ev("const b=document.querySelector('.rd-highlight-comment-button');b.click();window.__rdLastPopover=document.querySelector('.rd-comment-popover-host');'opened'");
 identity.light=ev(`JSON.stringify((${sample.toString()})())`);writeFileSync(file,JSON.stringify(identity,null,2)+'\n');
 console.log(JSON.stringify(identity));
 console.log(spawnSync('obsidian',['vault=testvault','dev:screenshot',`path=${process.cwd()}/docs/self-check/visual-v03-v06-final-light.png`],{encoding:'utf8'}).stdout);
}else if(action==='dark'){
 const identity=JSON.parse(readFileSync(file,'utf8'));ev("app.changeTheme('obsidian');'dark'");
 await until("document.body.classList.contains('theme-dark') && getComputedStyle(document.querySelector('.rd-comment-popover .rd-swatch--indigo')).color==='rgb(12, 14, 18)'");
 identity.dark=ev(`JSON.stringify((${sample.toString()})())`);identity.deployedAfter=hashes();identity.hashUnchanged=JSON.stringify(identity.deployed)===JSON.stringify(identity.deployedAfter);
 identity.V03=['light','dark'].every(t=>Object.values(identity[t].elements).every(x=>x&&x.clientWidth===x.scrollWidth));identity.V06=['light','dark'].every(t=>identity[t].popover.sameNode&&identity[t].swatches.length===5&&identity[t].swatches.every(x=>x.contrast>=4.5));writeFileSync(file,JSON.stringify(identity,null,2)+'\n');console.log(JSON.stringify(identity));
 console.log(spawnSync('obsidian',['vault=testvault','dev:screenshot',`path=${process.cwd()}/docs/self-check/visual-v03-v06-final-dark.png`],{encoding:'utf8'}).stdout);
}else if(action==='restore'){
 const d=JSON.parse(readFileSync(file,'utf8'));ev(`document.querySelector('[aria-label="关闭评论"]')?.click();app.changeTheme(${JSON.stringify(d.initial.theme)});app.workspace.rightSplit.setSize(${d.initial.rightWidth});app.workspace.rightSplit.${d.initial.right?'collapse':'expand'}();app.workspace.leftSplit.${d.initial.left?'collapse':'expand'}();delete window.__rdLastPopover;JSON.stringify({theme:app.getTheme(),left:app.workspace.leftSplit.collapsed,right:app.workspace.rightSplit.collapsed})`);console.log('Restored initial theme/sidebar state; no emulation used');
}
