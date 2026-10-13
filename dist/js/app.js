import {commands,defaults} from './commands.js';
import {match} from './matcher.js';
import {validate} from './validation.js';
import {generateScript} from './generator.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let category='All commands',script='',steps=[{id:crypto.randomUUID(),actionId:'disk',values:defaults(commands.find(c=>c.id==='disk'))}];
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
function renderSteps(){$('mobile-step-count').textContent=steps.length;$('step-count').textContent=`${steps.length} step${steps.length===1?'':'s'}`;$('clear').disabled=!steps.length;$('steps').innerHTML=steps.map((s,i)=>{const a=commands.find(c=>c.id===s.actionId);return `<article class="script-step" data-step="${s.id}"><div class="step-top"><span class="step-num">${String(i+1).padStart(2,'0')}</span><strong>${escape(a.name)}</strong><div class="step-actions"><button data-move="-1" ${i===0?'disabled':''} aria-label="Move step ${i+1} up">↑</button><button data-move="1" ${i===steps.length-1?'disabled':''} aria-label="Move step ${i+1} down">↓</button><button data-remove aria-label="Remove step ${i+1}">×</button></div></div><p class="step-description">${escape(a.description)}</p><span class="cmdlet">${escape(a.cmdlets)}</span>${a.parameters.filter(p=>p.type!=='boolean').map(p=>renderField(s,p)).join('')}<fieldset class="command-flags"><legend>Command flags</legend><p class="flags-help">Check an option to include it in this step.</p>${a.parameters.filter(p=>p.type==='boolean').map(p=>renderField(s,p)).join('')}</fieldset><details class="requirements"><summary>Requirements & compatibility</summary><p>${escape(a.requirements)}</p></details>${a.risk==='modify'?'<div class="risk-note">⚠ This step changes your system. Restarting a service may interrupt active users. Review before running.</div>':''}</article>`;}).join('');renderPreview();}
// Tokenize first, then escape each token. User values never become HTML.
function highlight(line){const pattern=/(#[^\n]*$|'(?:[^']|'')*'|\$[\w_.]+|\b[A-Za-z]+-[A-Za-z]+\b|-[A-Za-z]+\b)/g;let html='',last=0;for(const m of line.matchAll(pattern)){html+=escape(line.slice(last,m.index));const token=m[0],kind=token.startsWith('#')?'comment':token.startsWith("'")?'string':token.startsWith('$')?'variable':token.startsWith('-')?'param':'cmdlet';html+=`<span class="syntax-${kind}">${escape(token)}</span>`;last=m.index+token.length;}return html+escape(line.slice(last));}
function renderPreview(){let invalid=false;for(const s of steps){const a=commands.find(c=>c.id===s.actionId);const errors=validate(a,s.values);invalid ||= Object.keys(errors).length>0;for(const p of a.parameters){const input=$(`${s.id}-${p.name}`);const error=$(`${s.id}-${p.name}-error`);if(input){input.classList.toggle('invalid',Boolean(errors[p.name]));input.setAttribute('aria-invalid',String(Boolean(errors[p.name])));}if(error)error.textContent=errors[p.name]||'';}}script=invalid?'# Fix the highlighted parameters to generate your script.\n':generateScript(steps);$('code').innerHTML=script.trimEnd().split('\n').map((line,i)=>`<div class="code-line"><span class="line-number" aria-hidden="true">${i+1}</span><span>${highlight(line)||' '}</span></div>`).join('');const modify=steps.some(s=>commands.find(c=>c.id===s.actionId).risk==='modify');$('script-status').textContent=invalid?'⚠ Fix parameter errors to export':!steps.length?'＋ Add your first command':modify?'⚠ Includes a system-modifying action':`● ${steps.length} read-only step${steps.length===1?'':'s'} · Ready to review`;$('script-status').classList.toggle('error',invalid);$('copy').disabled=$('download').disabled=invalid||!steps.length;}
$('search').addEventListener('input',renderCatalog);
$('categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;renderCategories();renderCatalog();}});
document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>{category='All commands';$('search').value=b.dataset.query;renderCategories();renderCatalog();}));
$('results').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;const a=commands.find(c=>c.id===b.dataset.add);const s={id:crypto.randomUUID(),actionId:a.id,values:defaults(a)};steps.push(s);renderSteps();showPane('configure');const card=document.querySelector(`[data-step="${s.id}"]`);card.scrollIntoView({behavior:'smooth',block:'nearest'});(card.querySelector('input')||card.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});toast(`${a.name} added`);});
$('steps').addEventListener('input',e=>{const input=e.target.closest('[data-param]');if(!input)return;const s=steps.find(s=>s.id===input.closest('[data-step]').dataset.step);s.values[input.dataset.param]=input.type==='checkbox'?input.checked:input.value;renderPreview();});
$('steps').addEventListener('click',e=>{const b=e.target.closest('[data-move], [data-remove]');if(!b)return;const id=b.closest('[data-step]').dataset.step,index=steps.findIndex(s=>s.id===id);if(b.hasAttribute('data-remove')){steps.splice(index,1);}else{const other=index+Number(b.dataset.move);if(other<0||other>=steps.length)return;[steps[index],steps[other]]=[steps[other],steps[index]];}renderSteps();});
$('clear').addEventListener('click',()=>{steps=[];renderSteps();toast('Script cleared');});
$('browse').addEventListener('click',()=>{showPane('discover');$('search').focus();$('catalog').scrollIntoView({behavior:'smooth',block:'start'});});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('guide').open){e.preventDefault();showPane('discover');$('search').focus();}});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(script);toast('Script copied to clipboard');}catch{toast('Clipboard unavailable. Select the preview text to copy it manually.');}});
$('download').addEventListener('click',()=>{const blob=new Blob(['\ufeff'+script.replaceAll('\n','\r\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shellify-script.ps1';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PowerShell script downloaded');});
$('guide-button').addEventListener('click',()=>$('guide').showModal());$('close-guide').addEventListener('click',()=>$('guide').close());
renderCategories();renderCatalog();renderSteps();



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
