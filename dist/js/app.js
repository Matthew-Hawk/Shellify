import {commands,defaults} from './commands.js';
import {match} from './matcher.js';
import {validate} from './validation.js';
import {generateScript} from './generator.js';
import {copy,createStep,freshWorkspace,readDraft,saveDraft,readLibrary,saveLibrary,filenameFor,stepSummary,stepImpact,workflows,History} from './workspace.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const draft=readDraft(storage);
let workspace=draft.workspace,steps=workspace.steps,category='All commands',script='';
const history=new History();
let editingInput=null;
function remember(){history.remember(workspace);editingInput=null;$('undo').disabled=false;}
function persist(){workspace.steps=steps;const saved=saveDraft(storage,workspace);$('autosave-status').textContent=saved?'Saved on this browser':'Autosave unavailable';$('autosave-status').classList.toggle('error',!saved);}
function syncWorkspace(){steps=workspace.steps;$('script-title').value=workspace.title;$('script-description').value=workspace.description;$('script-filename').value=workspace.filename;$('target-version').value=workspace.version;renderSteps();}
function updateSummary(step){const card=document.querySelector(`[data-step="${step.id}"]`);if(!card)return;const impact=stepImpact(step);card.querySelector('[data-summary]').textContent=stepSummary(step);const badge=card.querySelector('[data-impact]');badge.textContent=impact==='preview'?'PREVIEW ONLY':impact==='modify'?'MODIFIES SYSTEM':'READ ONLY';badge.className=`tag ${impact==='modify'?'modify':''}`;const risk=card.querySelector('[data-risk]');if(risk)risk.textContent=impact==='preview'?'Preview only: -WhatIf reports the planned restart without changing the service.':'⚠ Restarting a service may interrupt active users. Review before running.';}

let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function renderCatalog(){const found=match(commands,$('search').value).filter(c=>category==='All commands'||c.category===category);$('result-count').textContent=`${found.length} command${found.length===1?'':'s'}`;$('results').innerHTML=found.length?found.map(c=>`<button class="command-card" data-add="${c.id}" aria-label="Add ${escape(c.name)}"><span class="command-icon" aria-hidden="true">${c.icon}</span><span><strong>${escape(c.name)}</strong><p>${escape(c.description)}</p><span class="tag ${c.risk==='modify'?'modify':''}">${c.risk==='read'?'● READ ONLY':'● MODIFIES SYSTEM'}</span></span><span class="command-plus" aria-hidden="true">＋</span></button>`).join(''):'<div class="empty"><strong>No supported commands found.</strong>Try “disk space,” “restart service,” or browse a category. Shellify only generates commands from its catalog.</div>';}
function renderCategories(){const categories=['All commands',...new Set(commands.map(c=>c.category))];$('categories').innerHTML=categories.map(c=>`<button data-category="${escape(c)}" aria-pressed="${category===c}" class="${category===c?'selected':''}">${escape(c)}</button>`).join('');}
function renderField(step,parameter){
  const p=parameter,s=step,id=`${s.id}-${p.name}`;
  const describedBy=`${id}-help ${id}-error`;
  if(p.type==='boolean')return `<label class="field check" for="${id}"><input id="${id}" data-param="${p.name}" type="checkbox" ${s.values[p.name]?'checked':''} aria-describedby="${describedBy}"><span><span class="flag-title">${escape(p.label)} <code>${escape(p.flag)}</code></span><small id="${id}-help">${escape(p.help)}</small><small class="error" id="${id}-error"></small></span></label>`;
  return `<label class="field" for="${id}">${escape(p.label)}${!p.required?' <span>(optional)</span>':''}<input id="${id}" data-param="${p.name}" type="${p.type}" value="${escape(s.values[p.name])}" ${p.required?'required':''} ${p.type==='number'?`min="${p.min}" max="${p.max}" step="1"`:'maxlength="500"'} aria-describedby="${describedBy}"><small id="${id}-help">${escape(p.help)}</small><small class="error" id="${id}-error"></small></label>`;
}
function renderSteps(){
  $('mobile-step-count').textContent=steps.length;$('step-count').textContent=`${steps.length} step${steps.length===1?'':'s'}`;$('clear').disabled=!steps.length;$('undo').disabled=!history.available;
  $('steps').innerHTML=steps.map((s,i)=>{
    const a=commands.find(c=>c.id===s.actionId);
    return `<article class="script-step" data-step="${s.id}"><div class="step-top"><span class="step-num">${String(i+1).padStart(2,'0')}</span><button class="step-title" data-collapse aria-expanded="${!s.collapsed}" aria-controls="${s.id}-body">${escape(a.name)} <span aria-hidden="true">${s.collapsed?'▸':'▾'}</span></button><div class="step-actions"><button data-move="-1" ${i===0?'disabled':''} aria-label="Move step ${i+1} up">↑</button><button data-move="1" ${i===steps.length-1?'disabled':''} aria-label="Move step ${i+1} down">↓</button><button data-remove aria-label="Remove step ${i+1}">×</button></div></div><p class="step-summary" data-summary></p><span data-impact class="tag"></span><span data-step-error class="error step-validation"></span><div class="step-tools"><button data-duplicate class="text-button" aria-label="Duplicate step ${i+1}">Duplicate</button><button data-reset class="text-button" aria-label="Reset step ${i+1} to defaults">Reset defaults</button></div><div id="${s.id}-body" ${s.collapsed?'hidden':''}><p class="step-description">${escape(a.description)}</p><span class="cmdlet">${escape(a.cmdlets)}</span>${a.parameters.filter(p=>p.type!=='boolean').map(p=>renderField(s,p)).join('')}<fieldset class="command-flags"><legend>Command flags</legend><p class="flags-help">Choose options for this step.</p>${a.parameters.filter(p=>p.type==='boolean').map(p=>renderField(s,p)).join('')}</fieldset><details class="requirements"><summary>Requirements & compatibility</summary><p>${escape(a.requirements)}</p><p data-compatibility>${a.versions.includes(workspace.version)?`Supports PowerShell ${workspace.version} on Windows.`:'Unavailable for the selected version.'}</p></details>${a.risk==='modify'?'<div class="risk-note" data-risk></div>':''}</div></article>`;
  }).join('');renderPreview();persist();
}
// Tokenize first, then escape each token. User values never become HTML.
function highlight(line){const pattern=/(#[^\n]*$|'(?:[^']|'')*'|\$[\w_.]+|\b[A-Za-z]+-[A-Za-z]+\b|-[A-Za-z]+\b)/g;let html='',last=0;for(const m of line.matchAll(pattern)){html+=escape(line.slice(last,m.index));const token=m[0],kind=token.startsWith('#')?'comment':token.startsWith("'")?'string':token.startsWith('$')?'variable':token.startsWith('-')?'param':'cmdlet';html+=`<span class="syntax-${kind}">${escape(token)}</span>`;last=m.index+token.length;}return html+escape(line.slice(last));}
function renderPreview(){
  let invalid=false;
  for(const s of steps){
    const a=commands.find(c=>c.id===s.actionId),errors=validate(a,s.values),compatible=a.versions.includes(workspace.version);
    invalid ||= Object.keys(errors).length>0||!compatible;
    const card=document.querySelector(`[data-step="${s.id}"]`);
    card.querySelector('[data-compatibility]').textContent=compatible?`Supports PowerShell ${workspace.version} on Windows.`:'Unavailable for the selected version.';
    card.querySelector('[data-step-error]').textContent=!compatible?'Choose a compatible PowerShell version.':Object.keys(errors).length?'Fix fields in this step':'';
    for(const p of a.parameters){const input=$(`${s.id}-${p.name}`),error=$(`${s.id}-${p.name}-error`);if(input){input.classList.toggle('invalid',Boolean(errors[p.name]));input.setAttribute('aria-invalid',String(Boolean(errors[p.name])));}if(error)error.textContent=errors[p.name]||'';}
    updateSummary(s);
  }
  script=invalid?'# Fix the highlighted parameters to generate your script.\n':generateScript(steps,workspace);
  $('code').innerHTML=script.trimEnd().split('\n').map((line,i)=>`<div class="code-line"><span class="line-number" aria-hidden="true">${i+1}</span><span>${highlight(line)||' '}</span></div>`).join('');
  const modifying=steps.filter(s=>stepImpact(s)==='modify').length,previews=steps.filter(s=>stepImpact(s)==='preview').length;
  $('script-status').textContent=invalid?'⚠ Fix step errors to export':!steps.length?'＋ Add your first command':modifying?`⚠ ${modifying} system-modifying step${modifying===1?'':'s'}`:previews?`● ${previews} preview-only restart${previews===1?'':'s'} · No system changes`:`● ${steps.length} read-only step${steps.length===1?'':'s'} · Ready to review`;
  $('script-status').classList.toggle('error',invalid);$('copy').disabled=$('download').disabled=$('save-script').disabled=invalid||!steps.length;
  $('export-filename').textContent=filenameFor(workspace.filename);
}
$('search').addEventListener('input',renderCatalog);
$('categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;renderCategories();renderCatalog();}});
document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>{category='All commands';$('search').value=b.dataset.query;renderCategories();renderCatalog();}));
$('results').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;if(steps.length>=200){toast('A script can contain up to 200 steps.');return;}const a=commands.find(c=>c.id===b.dataset.add);const s=createStep(a.id);remember();steps.push(s);renderSteps();showPane('configure');const card=document.querySelector(`[data-step="${s.id}"]`);card.scrollIntoView({behavior:'smooth',block:'nearest'});(card.querySelector('input')||card.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});toast(`${a.name} added`);});
$('steps').addEventListener('input',e=>{const input=e.target.closest('[data-param]');if(!input)return;const s=steps.find(s=>s.id===input.closest('[data-step]').dataset.step);if(input.type==='checkbox'||editingInput!==input){remember();editingInput=input;}s.values[input.dataset.param]=input.type==='checkbox'?input.checked:input.value;renderPreview();persist();});
$('steps').addEventListener('focusout',()=>{editingInput=null;});
$('steps').addEventListener('click',e=>{
  const b=e.target.closest('[data-move], [data-remove], [data-duplicate], [data-reset], [data-collapse]');if(!b)return;
  const id=b.closest('[data-step]').dataset.step,index=steps.findIndex(s=>s.id===id),step=steps[index];
  if(b.hasAttribute('data-collapse')){step.collapsed=!step.collapsed;const body=$(`${id}-body`);body.hidden=step.collapsed;b.setAttribute('aria-expanded',String(!step.collapsed));b.querySelector('span').textContent=step.collapsed?'▸':'▾';persist();return;}
  if(b.hasAttribute('data-duplicate')&&steps.length>=200){toast('A script can contain up to 200 steps.');return;}
  remember();
  if(b.hasAttribute('data-remove')){steps.splice(index,1);toast('Step removed. Use Undo to restore it.');}
  else if(b.hasAttribute('data-duplicate')){steps.splice(index+1,0,{...copy(step),id:crypto.randomUUID(),collapsed:false});toast('Step duplicated');}
  else if(b.hasAttribute('data-reset')){step.values=defaults(commands.find(c=>c.id===step.actionId));step.collapsed=false;toast('Step reset. Use Undo to restore your settings.');}
  else{const other=index+Number(b.dataset.move);if(other<0||other>=steps.length)return;[steps[index],steps[other]]=[steps[other],steps[index]];}
  renderSteps();
  const focusId=b.hasAttribute('data-duplicate')?steps[index+1].id:b.hasAttribute('data-remove')?steps[Math.min(index,steps.length-1)]?.id:id;
  const focusButton=document.querySelector(`[data-step="${focusId}"] [data-collapse]`);
  focusButton?.focus({preventScroll:true});focusButton?.scrollIntoView({block:'nearest'});
});
$('clear').addEventListener('click',()=>{remember();steps.length=0;renderSteps();toast('Script cleared. Use Undo to restore it.');});
$('undo').addEventListener('click',()=>{const previous=history.undo();if(previous){workspace=previous;editingInput=null;syncWorkspace();toast('Last change undone');}});
$('start-fresh').addEventListener('click',()=>{remember();workspace=freshWorkspace();workspace.steps=[];syncWorkspace();toast('Fresh script started. Use Undo to restore your draft.');});
$('browse').addEventListener('click',()=>{showPane('discover');$('search').focus();$('catalog').scrollIntoView({behavior:'smooth',block:'start'});});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();showPane('discover');$('search').focus();}});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(script);toast('Script copied to clipboard');}catch{toast('Clipboard unavailable. Select the preview text to copy it manually.');}});
$('download').addEventListener('click',()=>{const blob=new Blob(['\ufeff'+script.replaceAll('\n','\r\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filenameFor(workspace.filename);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PowerShell script downloaded');});
$('guide-button').addEventListener('click',()=>$('guide').showModal());$('close-guide').addEventListener('click',()=>$('guide').close());
for(const [id,key] of [['script-title','title'],['script-description','description'],['script-filename','filename'],['target-version','version']]){
  $(id).addEventListener('input',e=>{if(editingInput!==e.target){remember();editingInput=e.target;}workspace[key]=e.target.value;renderPreview();persist();});
  $(id).addEventListener('focusout',()=>{editingInput=null;});
}
$('options-button').addEventListener('click',()=>$('script-options').showModal());
$('close-options').addEventListener('click',()=>$('script-options').close());
let library=readLibrary(storage).items;
function renderLibrary(){
  $('saved-scripts').innerHTML=library.length?library.map(item=>`<div class="library-item"><div><strong>${escape(item.name)}</strong><small>${item.workspace.steps.length} steps · PowerShell ${item.workspace.version}</small></div><button class="text-button" data-load="${escape(item.id)}" aria-label="Open ${escape(item.name)}">Open</button><button class="text-button" data-delete="${escape(item.id)}" aria-label="Delete ${escape(item.name)}">Delete</button></div>`).join(''):'<p class="dialog-help">No saved scripts yet. Give your script a name and select Save current.</p>';
  $('workflow-list').innerHTML=workflows.map(w=>`<button class="workflow-card" data-workflow="${w.id}"><strong>${escape(w.name)}</strong><span>${escape(w.description)}</span><small>Add ${w.actions.length} steps</small></button>`).join('');
}
$('library-button').addEventListener('click',()=>{library=readLibrary(storage).items;$('library-name').value=workspace.title;renderLibrary();$('script-library').showModal();});
$('close-library').addEventListener('click',()=>$('script-library').close());
$('save-script').addEventListener('click',()=>{
  const name=$('library-name').value.trim();if(!name){$('library-name').focus();toast('Enter a name for your saved script');return;}
  if($('copy').disabled){toast('Fix step errors before saving to the library');return;}
  const items=readLibrary(storage).items;
  if(items.length>=50){toast('The library holds 50 scripts. Delete one to make room.');return;}
  const next=[{id:crypto.randomUUID(),name,workspace:copy(workspace)},...items];
  if(!saveLibrary(storage,next)){toast('Unable to save: browser storage is unavailable or full.');return;}
  library=next;renderLibrary();toast('Script saved to your browser library');
});
let deletedScript=null;
$('saved-scripts').addEventListener('click',e=>{
  const b=e.target.closest('[data-load], [data-delete]');if(!b)return;
  const item=library.find(item=>item.id===(b.dataset.load||b.dataset.delete));if(!item)return;
  if(b.hasAttribute('data-load')){remember();workspace=copy(item.workspace);workspace.steps=workspace.steps.map(s=>({...s,id:crypto.randomUUID()}));syncWorkspace();$('script-library').close();showPane('configure');toast('Saved script opened. Use Undo to restore the previous draft.');}
  else{const next=library.filter(s=>s.id!==item.id);if(!saveLibrary(storage,next)){toast('Unable to update the library');return;}deletedScript=item;library=next;renderLibrary();$('restore-deleted').hidden=false;toast('Saved script deleted. Restore is available in this library.');}
});
$('restore-deleted').addEventListener('click',()=>{if(!deletedScript)return;const latest=readLibrary(storage).items;if(latest.length>=50){toast('The library is full. Delete a script before restoring.');return;}const next=[deletedScript,...latest];if(!saveLibrary(storage,next)){toast('Unable to restore saved script');return;}library=next;deletedScript=null;$('restore-deleted').hidden=true;renderLibrary();toast('Saved script restored');});
$('workflow-list').addEventListener('click',e=>{const b=e.target.closest('[data-workflow]');if(!b)return;const workflow=workflows.find(w=>w.id===b.dataset.workflow);if(steps.length+workflow.actions.length>200){toast('A script can contain up to 200 steps.');return;}remember();steps.push(...workflow.actions.map(createStep));renderSteps();$('script-library').close();showPane('configure');toast(`${workflow.name} added. Use Undo to remove it.`);});
renderCategories();renderCatalog();syncWorkspace();
if(draft.restored)toast('Your previous draft was restored');
else if(draft.error)toast('The previous draft could not be restored. A fresh script is ready.');



// Wrapping changes only the displayed layout, never copied or downloaded code.
let wrapEnabled=true;
try{wrapEnabled=localStorage.getItem('shellify.wrap')!=='off';}catch{}
function renderWrap(){ $('code').classList.toggle('wrap-enabled',wrapEnabled);$('wrap-toggle').setAttribute('aria-pressed',String(wrapEnabled));$('wrap-toggle').textContent=`↵ Word wrap: ${wrapEnabled?'on':'off'}`; }
$('wrap-toggle').addEventListener('click',()=>{wrapEnabled=!wrapEnabled;renderWrap();try{localStorage.setItem('shellify.wrap',wrapEnabled?'on':'off');}catch{}});
renderWrap();

// Small screens show one full-size pane without discarding any working state.
const compactLayout=window.matchMedia('(max-width: 1100px)');
let activePane='discover';
const paneTabs=[...document.querySelectorAll('[data-pane]')];
function showPane(name){
  activePane=name;
  document.querySelectorAll('[data-workspace-pane]').forEach(panel=>{
    panel.hidden=compactLayout.matches&&panel.dataset.workspacePane!==name;
    panel.setAttribute('role',compactLayout.matches?'tabpanel':'region');
    panel.setAttribute('aria-labelledby',compactLayout.matches?`tab-${panel.dataset.workspacePane}`:`${panel.dataset.workspacePane}-heading`);
  });
  paneTabs.forEach(tab=>{const selected=tab.dataset.pane===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
}
paneTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>showPane(tab.dataset.pane));
  tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight')next=(index+1)%paneTabs.length;
    if(event.key==='ArrowLeft')next=(index+paneTabs.length-1)%paneTabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=paneTabs.length-1;
    if(next!==undefined){event.preventDefault();showPane(paneTabs[next].dataset.pane);paneTabs[next].focus();}
  });
});
compactLayout.addEventListener('change',()=>showPane(activePane));
showPane(activePane);
