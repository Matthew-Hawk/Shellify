import {effectiveStep,effectiveWorkspace,behaviorErrors,behaviorPresets,behaviorOrigin,planBehaviorChange,moveStepToGroup} from './group-behavior.js';
import {renderBehaviorOrigin,renderEffectiveBehavior,renderEffectiveBehaviorContent,renderProposal} from './group-controls.js';
import {renderInputSource} from './input-source-controls.js';
import {relationshipsFor} from './relationship-view.js';
import {conditionSourceIndex} from './relationships.js';
import {scriptScope} from './script-context.js';
import {renderResults,sampleMarkup,renderCondition,renderStepParameters} from './builder-controls.js';
import {schemaFor,settingsFor,operators,resultErrors} from './results.js';
import {parameterErrors,parameterDefinitions,validationValues,invocation} from './parameters.js';
import {conditionErrors} from './conditions.js';
import {commands,defaults} from './commands.js';
import {search as searchCatalog} from './search.js';
import {searchIndex} from './search-index.js';
import {sourceValues,hasResultSource,resultSourceIndex,sourceErrors,scopeErrors,scopeAcknowledged,acknowledgeScope,sourceScopeText} from './composition.js';
import {troubleshooting,runtimeErrors} from './runtime.js';
import {saveEntry,renameEntry,restoreEntry} from './library.js';
import {resolveStep,executionErrors,sharedInputErrors} from './execution.js';
import {generateScript} from './generator.js';
import {createShareHash,restoreShareHash} from './share.js';
import {MAX_PROJECT_BYTES,exportProject,importProject,projectFilename,outputErrors,readDiscovery,saveDiscovery,markRecent,reviewWorkspace} from './projects.js';
import {copy,createStep,freshWorkspace,readDraft,saveDraft,readLibrary,saveLibrary,filenameFor,stepSummary,stepImpact,workflows,insertWorkflow,History} from './workspace.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let editingGroupId=null,pendingBehaviorChange=null;
const displayGroupName=group=>group.name||workflows.find(w=>w.id===group.workflowId)?.name||'Workflow group';
function openGroupSettings(id){
  const group=workspace.groups?.find(g=>g.id===id);if(!group)return;editingGroupId=id;
  const b=group.behavior||{},members=steps.filter(s=>s.groupId===id),supportsComputer=members.some(s=>commands.find(c=>c.id===s.actionId).parameters.some(p=>p.name==='computer'));
  $('group-settings-error').textContent='';
  $('group-settings-content').innerHTML=`<label class="field">Group name<input id="group-name" type="text" maxlength="100" value="${escape(displayGroupName(group))}" required></label><label class="field">Shared intent<textarea id="group-intent" maxlength="500" rows="2">${escape(group.intent||workflows.find(w=>w.id===group.workflowId)?.description||'')}</textarea></label><p>Members: ${members.map(s=>`Step ${steps.indexOf(s)+1}: ${escape(commands.find(c=>c.id===s.actionId).name)}`).join('; ')}</p><label class="field">Behavior preset<select id="group-preset"><option value="">Current / custom settings</option>${behaviorPresets.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select><small>Presets set change behavior, failure handling and verbose evidence. Explicit step overrides are retained. Force, targets and output paths remain as configured.</small></label><fieldset class="command-flags"><legend>Targeting</legend><label class="field">Default computer input<select id="group-computer-input" ${supportsComputer?'':'disabled'}><option value="">Keep per-step targeting</option>${b.computerInputId&&!workspace.sharedInputs.some(i=>i.id===b.computerInputId)?`<option value="${escape(b.computerInputId)}" selected>Missing shared input</option>`:''}${workspace.sharedInputs.map(i=>`<option value="${escape(i.id)}" ${b.computerInputId===i.id?'selected':''}>${escape(i.name)}</option>`).join('')}</select><small>${supportsComputer?'Applies only to commands with a computer field; unsupported commands keep their own targeting. Step overrides take precedence.':'No member exposes a computer field. Per-step sources and script-wide fleet settings determine targeting.'}</small></label></fieldset><fieldset class="command-flags"><legend>Change behavior</legend><label class="field">Group change behavior<select id="group-change-mode">${[['preserve','Keep per-step change settings'],['preview','Preview supported changes'],['confirm','Apply with confirmation']].map(([v,label])=>`<option value="${v}" ${(b.changeMode||'preserve')===v?'selected':''}>${label}</option>`).join('')}</select><small>Unsupported modifying commands block export. Preview groups reject live overrides; confirmation groups require confirmation. Script-wide dry run takes precedence.</small></label></fieldset><fieldset class="command-flags"><legend>Failure handling</legend><label class="field">Group failure policy<select id="group-on-error">${[['','Keep per-step defaults'],['stop','Stop on error'],['continue','Record error and continue']].map(([v,label])=>`<option value="${v}" ${(b.onError||'')===v?'selected':''}>${label}</option>`).join('')}</select><small>Combined reports retain their own policy. Required module imports still stop. Succeeded, Failed and Skipped describe command attempts, not health.</small></label></fieldset><fieldset class="command-flags"><legend>Evidence</legend><label class="field">Verbose messages<select id="group-verbose">${[['','Keep per-step defaults'],['true','On'],['false','Off']].map(([v,label])=>`<option value="${v}" ${(b.verbose===undefined?'':String(b.verbose))===v?'selected':''}>${label}</option>`).join('')}</select></label><p>Transcript, preflight checks and execution summaries are configured for the whole script in Script settings.</p></fieldset><fieldset class="command-flags"><legend>Results</legend><p>Existing report steps, fields, filters, limits and output destinations are retained. Report, result and transcript files have file effects when the exported script runs. Writable folders and no-overwrite checks still apply.</p></fieldset>`;
  $('group-settings').showModal();
}
function stageBehaviorChange(after,label,affectedIds){
  const before={...workspace,steps},proposal=planBehaviorChange(before,after,label,[...new Set(affectedIds)]);
  proposal.errors=[...new Set([...proposal.errors,...reviewWorkspace(after).errors])];
  proposal.returnToGroup=$('group-settings').open;proposal.focusGroupId=proposal.returnToGroup?editingGroupId:null;proposal.returnFocusStep=affectedIds[0];
  if(proposal.returnToGroup)$('group-settings').close();
  pendingBehaviorChange=proposal;$('behavior-review-heading').textContent=label;
  $('behavior-review-content').innerHTML=renderProposal(proposal,before);
  $('behavior-live-label').hidden=!proposal.requiresAcknowledgement;$('behavior-live-ack').checked=false;
  $('apply-behavior-change').disabled=proposal.requiresAcknowledgement;$('behavior-review-error').textContent='';
  $('behavior-review').showModal();
}
const cloneCurrentWorkspace=()=>copy({...workspace,steps});
$('group-settings-content').addEventListener('change',e=>{
  if(e.target.id!=='group-preset'){$('group-preset').value='';return;}
  const preset=behaviorPresets.find(p=>p.id===e.target.value);if(!preset)return;
  $('group-change-mode').value=preset.settings.changeMode;$('group-on-error').value=preset.settings.onError;$('group-verbose').value=String(preset.settings.verbose);
});
$('close-group-settings').addEventListener('click',()=>$('group-settings').close());
$('review-group-settings').addEventListener('click',()=>{
  if(!$('group-name').value.trim()){$('group-settings-error').textContent='Enter a group name.';$('group-name').focus();return;}
  const after=cloneCurrentWorkspace(),group=after.groups.find(g=>g.id===editingGroupId);if(!group)return;
  group.name=$('group-name').value.trim();group.intent=$('group-intent').value;group.behavior={changeMode:$('group-change-mode').value};
  if($('group-on-error').value)group.behavior.onError=$('group-on-error').value;
  if($('group-verbose').value)group.behavior.verbose=$('group-verbose').value==='true';
  if($('group-computer-input').value)group.behavior.computerInputId=$('group-computer-input').value;
  stageBehaviorChange(after,'Review group behavior',after.steps.filter(s=>s.groupId===group.id).map(s=>s.id));
});
$('close-behavior-review').addEventListener('click',()=>$('behavior-review').close());
$('behavior-review').addEventListener('close',()=>{if(pendingBehaviorChange?.returnToGroup){$('group-settings').showModal();$('review-group-settings').focus();}else if(pendingBehaviorChange?.returnFocusStep)document.querySelector(`[data-step="${pendingBehaviorChange.returnFocusStep}"] [data-collapse]`)?.focus({preventScroll:true});pendingBehaviorChange=null;});
$('behavior-live-ack').addEventListener('change',()=>$('apply-behavior-change').disabled=!!pendingBehaviorChange?.requiresAcknowledgement&&!$('behavior-live-ack').checked);
$('apply-behavior-change').addEventListener('click',()=>{
  const proposal=pendingBehaviorChange;if(!proposal||proposal.requiresAcknowledgement&&!$('behavior-live-ack').checked)return;
  if(JSON.stringify({...workspace,steps})!==proposal.before){$('behavior-review-error').textContent='The workflow changed. Cancel and review the current settings again.';return;}
  remember();pendingBehaviorChange=null;$('behavior-review').close();workspace=proposal.after;syncWorkspace({preservePreview:true});
  $('dry-run').checked=workspace.dryRun===true;$('fleet-targets').value=(workspace.targets||[]).join('\n');
  if($('script-options').open)$('dry-run').focus();else if(proposal.focusGroupId)document.querySelector(`[data-group-settings="${CSS.escape(proposal.focusGroupId)}"]`)?.focus({preventScroll:true});else if(proposal.returnFocusStep)focusBenchStep(proposal.returnFocusStep);
  toast('Behavior configuration applied. Use Undo to restore it.');
});
$('steps').addEventListener('click',e=>{
  const settings=e.target.closest('[data-group-settings]');if(settings){openGroupSettings(settings.dataset.groupSettings);return;}
  const reset=e.target.closest('[data-reset-behavior]'),target=e.target.closest('[data-override-target]');if(!reset&&!target)return;
  const stepId=(reset||target).closest('[data-step]').dataset.step,after=cloneCurrentWorkspace(),step=after.steps.find(s=>s.id===stepId);step.behaviorOverrides||={};
  if(reset){
    const key=reset.dataset.resetBehavior;delete step.behaviorOverrides[key];
    if(behaviorOrigin(step,key,after)!=='Group default'){
      if(key==='onError'){const group=after.groups.find(g=>g.id===step.groupId),recipe=workflows.find(w=>w.id===group?.workflowId);step.onError=recipe?.inputs&&step.actionId!=='report'?'continue':'stop';}
      else if(key==='computer'){step.values.computer='';delete step.bindings.computer;if(step.bulk.field==='computer')step.bulk.field='';delete step.parameterFields.computer;}
      else step.values[key]=defaults(commands.find(c=>c.id===step.actionId))[key];
    }
  }else step.behaviorOverrides.computer=true;
  stageBehaviorChange(after,reset?'Review reset to inherited value':'Review computer target override',[stepId]);
});
$('steps').addEventListener('change',e=>{
  const input=e.target.closest('[data-step-group]');if(!input)return;
  const step=steps.find(s=>s.id===input.closest('[data-step]').dataset.step),choice=input.value;input.value=step.groupId||'';
  const after=cloneCurrentWorkspace();let groupId=choice;
  if(choice==='__new__'){groupId=crypto.randomUUID();after.groups.push({id:groupId,name:'Custom workflow',intent:'Steps sharing an operational purpose.',collapsed:false});}
  moveStepToGroup(after,step.id,groupId||undefined);
  const affected=after.steps.filter(s=>s.id===step.id||s.groupId===groupId||s.groupId===step.groupId).map(s=>s.id);
  stageBehaviorChange(after,'Review workflow group membership',affected);
});
let inspectedRelationship=null;
function relationshipButtons(step){
  return relationshipsFor({...workspace,steps},step).map(edge=>{
    const source=steps.find(s=>s.id===edge.sourceId),from=source?` · Step ${steps.indexOf(source)+1} → ${steps.indexOf(step)+1}`:edge.kind==='results'||edge.kind==='condition'&&step.condition?.type==='connectivity'?' · Missing source':edge.field?' · '+edge.field:'';
    return `<button class="relationship-button ${edge.errors.length?'blocked-relationship':''}" data-relationship="${edge.kind}" data-relationship-target="${step.id}" ${edge.field?`data-relationship-field="${escape(edge.field)}"`:''} aria-label="${escape(edge.label+from+(edge.errors.length?' · Needs attention':''))} — Inspect for step ${steps.indexOf(step)+1}${edge.field?' '+escape(edge.field):''}">${edge.label}${escape(from)}${edge.errors.length?' · Needs attention':''}</button>`;
  }).join('');
}
function refreshRelationships(){
  for(const row of document.querySelectorAll('[data-relationships]')){
    const step=steps.find(s=>s.id===row.dataset.relationships);if(!step)continue;
    const markup=(steps.indexOf(step)>0?'<span class="sequence-label">Then <small>· execution order</small></span>':'')+relationshipButtons(step);
    if(row.relationshipMarkup!==markup){row.innerHTML=markup;row.relationshipMarkup=markup;}
  }
  for(const row of document.querySelectorAll('[data-group-relationships]')){
    const markup='<span>Connections in collapsed workflow</span>'+steps.filter(s=>s.groupId===row.dataset.groupRelationships).map(relationshipButtons).join('');
    if(row.relationshipMarkup!==markup){row.innerHTML=markup;row.relationshipMarkup=markup;}
  }
}
function inspectedEdge(){const step=steps.find(s=>s.id===inspectedRelationship?.targetId);return step&&relationshipsFor({...workspace,steps},step).find(e=>e.kind===inspectedRelationship.kind&&e.field===inspectedRelationship.field);}
function openRelationship(button){
  inspectedRelationship={targetId:button.dataset.relationshipTarget,kind:button.dataset.relationship,field:button.dataset.relationshipField};
  const edge=inspectedEdge();if(!edge)return;
  $('relationship-heading').textContent=edge.label;
  $('relationship-content').innerHTML=`<p>${escape(edge.detail)}</p>${edge.errors.length?`<p class="error">${escape(edge.errors.join(' '))}</p>`:''}<p class="dialog-help">This describes the exported script. Nothing has executed here.</p>`;
  $('remove-relationship').hidden=edge.kind==='report';$('relationship-details').showModal();
}
$('close-relationship').addEventListener('click',()=>$('relationship-details').close());
$('edit-relationship').addEventListener('click',()=>{
  const edge=inspectedEdge();if(!edge)return;$('relationship-details').close();
  if(edge.groupDefault){openGroupSettings(steps.find(s=>s.id===edge.targetId).groupId);return;}focusBenchStep(edge.targetId);
  const card=document.querySelector(`[data-step="${edge.targetId}"]`);
  if(edge.kind==='condition'){card.querySelector('.advanced-options').open=true;card.querySelector('[data-condition="type"]').focus();}
  else if(edge.kind!=='report')card.querySelector(`[data-value-source="${edge.field||'service'}"]`)?.focus();
});
$('remove-relationship').addEventListener('click',()=>{
  const edge=inspectedEdge(),step=steps.find(s=>s.id===edge?.targetId);if(!step)return;
  if(edge.groupDefault){const after=cloneCurrentWorkspace(),changed=after.steps.find(s=>s.id===step.id);changed.behaviorOverrides||={};changed.behaviorOverrides.computer=true;delete changed.bindings.computer;$('relationship-details').close();stageBehaviorChange(after,'Review computer target override',[step.id]);return;}remember();
  if(edge.kind==='results'){delete step.inputSourceId;delete step.inputStep;delete step.scopeAcknowledgement;}
  if(edge.kind==='condition')step.condition={type:'none'};
  if(edge.kind==='shared')delete step.bindings[edge.field];
  $('relationship-details').close();renderSteps();focusBenchStep(step.id);toast('Relationship removed. Use Undo to restore it.');
});
$('steps').addEventListener('click',e=>{
  const connection=e.target.closest('[data-relationship]');if(connection){openRelationship(connection);return;}
  const change=e.target.closest('[data-change-source]');if(change)change.closest('[data-step]').querySelector(`[data-value-source="${change.dataset.changeSource}"]`)?.focus();
  const source=e.target.closest('[data-edit-source]');if(source)focusBenchStep(source.dataset.editSource);
});
$('steps').addEventListener('input',e=>{
  const input=e.target.closest('[data-value-source],[data-source-targets],[data-acknowledge-scope]');if(!input)return;
  const step=steps.find(s=>s.id===input.closest('[data-step]').dataset.step);if(!step)return;
  if(input.matches('[data-source-targets]')){if(editingInput!==input){remember();editingInput=input;}step.bulk.targets=input.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);renderPreview();persist();return;}
  remember();
  if(input.matches('[data-acknowledge-scope]')){if(input.checked)acknowledgeScope(step,steps,workspace);else delete step.scopeAcknowledgement;renderPreview();persist();return;}
  const field=input.dataset.valueSource,mode=input.value;if(field==='computer'){step.behaviorOverrides||={};step.behaviorOverrides.computer=true;}
  delete step.bindings[field];if(step.bulk?.field===field)step.bulk.field='';
  if(field==='service'){delete step.inputSourceId;delete step.inputStep;delete step.scopeAcknowledgement;}
  if(mode.startsWith('shared:')){step.bindings[field]=mode.slice(7);delete step.parameterFields[field];}
  if(mode.startsWith('results:')){step.inputSourceId=mode.slice(8);step.bulk.field='';delete step.parameterFields.service;}
  if(mode==='bulk'){step.bulk={field,targets:step.bulk?.targets||[]};delete step.parameterFields[field];}
  renderSteps();document.querySelector(`[data-step="${step.id}"] [data-value-source="${field}"]`)?.focus({preventScroll:true});
});
function highlightSelectedStep(){
  const selected=steps.find(s=>!s.collapsed);
  document.querySelectorAll('[data-code-step]').forEach(line=>line.classList.toggle('selected-code',line.dataset.codeStep===selected?.id));
  document.querySelectorAll('[data-step]').forEach(card=>card.classList.toggle('selected-step',card.dataset.step===selected?.id));
  $('preview-selection').textContent=!$('preview-stale').hidden?(lastValidPreview?'Previous preview · Out of date':'Draft incomplete · No valid preview'):selected?'Step '+(steps.indexOf(selected)+1)+' · '+commands.find(c=>c.id===selected.actionId).name:'Full script';
  $('locate-code').disabled=!document.querySelector('.selected-code');
}
function focusBenchStep(id){
  const step=steps.find(s=>s.id===id);if(!step)return;
  const group=workspace.groups?.find(g=>g.id===step.groupId);if(group)group.collapsed=false;
  steps.forEach(s=>s.collapsed=s.id!==id);renderSteps();showPane('configure');
  const card=document.querySelector(`[data-step="${id}"]`);card.scrollIntoView({block:'nearest'});
  card.querySelector('[aria-invalid="true"],input:not(:disabled),select:not(:disabled),[data-collapse]')?.focus({preventScroll:true});
}
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const draft=readDraft(storage);
const initialShareHash=location.hash;
let sharedProject=null,shareError='';
function clearShareHash(){
  const cleanURL=new URL(location.href);cleanURL.hash='';cleanURL.searchParams.delete('workflow');cleanURL.searchParams.delete('category');
  window.history.replaceState(null,'',cleanURL);
}
if(initialShareHash){
  try{sharedProject=await restoreShareHash(initialShareHash);}catch(error){shareError=error.message;}
  clearShareHash();
}
let workspace=draft.workspace,steps=workspace.steps,category='All commands',script='';
let lastValidPreview=null;
const pristineSteps=new Set(),touchedFields=new Set();
const history=new History();
let discovery=readDiscovery(storage),collection='all';
let activeResult=-1,searchHistory=[],missedSearches=[],searchAddExpanded=true;
try{searchHistory=JSON.parse(localStorage.getItem('shellify.searches')||'[]').filter(s=>typeof s==='string').slice(0,8);missedSearches=JSON.parse(localStorage.getItem('shellify.missed-searches')||'[]').filter(s=>typeof s==='string').slice(0,20);}catch{}
const searchDebug=new URLSearchParams(location.search).get('debug')==='search';
const searchStats={queries:0,zero:0};
document.querySelector('.search-wrap').insertAdjacentHTML('afterend','<details class="search-help-menu"><summary>Search tips</summary><p>Use a task, symptom, event ID or flag. Arrow keys select results; Enter adds; Shift+Enter adds and opens; Escape clears.</p><div class="search-examples"><button data-search-example="cat:ad">cat:ad</button><button data-search-example="is:readonly">is:readonly</button><button data-search-example="is:disruptive">is:disruptive</button><button data-search-example="fav:">fav:</button><button data-search-example="needs:admin">needs:admin</button><button data-search-example="ps:5.1">ps:5.1</button><button data-search-example="makes:users">makes:users</button></div><p>Also: takes:services, quotes for exact phrases, or -Force for a flag. Filters can be combined.</p></details>');
if(searchDebug)$('catalog').insertAdjacentHTML('beforeend','<details class="search-debug"><summary>Local search diagnostics</summary><pre id="search-debug"></pre></details>');
document.body.insertAdjacentHTML('beforeend','<dialog id="workflow-inputs" aria-labelledby="workflow-input-title"><button id="close-workflow-inputs" class="close-button" aria-label="Close workflow inputs">×</button><h2 id="workflow-input-title">Workflow inputs</h2><form id="workflow-input-form"><div id="workflow-input-fields"></div><p id="workflow-input-error" class="error" role="alert"></p><button class="button primary" type="submit">Add workflow</button></form></dialog>');
let pendingWorkflow=null;
document.querySelector('.steps-scroll').insertAdjacentHTML('beforeend','<p id="ordering-warning" class="ordering-warning error" role="status" hidden></p><div id="next-steps" class="next-steps"></div>');
function openWorkflowInputs(workflow){pendingWorkflow=workflow;$('workflow-input-title').textContent=workflow.name;$('workflow-input-error').textContent='';$('workflow-input-fields').innerHTML=`<p>${escape(workflow.description)}</p>${workflow.inputs.map(p=>`<label class="field" for="workflow-${p.key}">${escape(p.label)}<input id="workflow-${p.key}" data-workflow-input="${p.key}" type="text" maxlength="500" value="${escape(p.value)}" ${['identity','server','reportPath','port','days'].includes(p.key)||p.key==='targets'&&workflow.requireTargets?'required':''}><small>${escape(p.help)}</small></label>`).join('')}`;$('script-library').close();$('workflow-inputs').showModal();}
$('close-workflow-inputs').addEventListener('click',()=>$('workflow-inputs').close());
$('workflow-input-form').addEventListener('submit',e=>{e.preventDefault();if(!pendingWorkflow)return;const values=Object.fromEntries([...document.querySelectorAll('[data-workflow-input]')].map(input=>[input.dataset.workflowInput,input.value.trim()]));if(values.port&&!/^[0-9]+$/.test(values.port)||values.port&&(Number(values.port)<1||Number(values.port)>65535)||values.days&&(!/^[0-9]+$/.test(values.days)||Number(values.days)>3650)){$('workflow-input-error').textContent='Use a TCP port from 1–65535 and an expiry window from 0–3650 days.';return;}const prospective=copy(workspace);insertWorkflow(prospective,pendingWorkflow.id,values);const problems=[...runtimeErrors(prospective),...sharedInputErrors(prospective.sharedInputs)];if(problems.length){$('workflow-input-error').textContent=problems.join(' ');return;}$('workflow-inputs').close();addWorkflow(pendingWorkflow.id,values);pendingWorkflow=null;});
function trackRecent(id){discovery=markRecent(discovery,id);saveDiscovery(storage,discovery);renderCatalog();}
let editingInput=null;
function remember(){history.remember(workspace);editingInput=null;$('undo').disabled=false;}
function persist(){workspace.steps=steps;const saved=saveDraft(storage,workspace);$('autosave-status').textContent=saved?'✓ Saved on this browser':'Autosave unavailable';$('autosave-status').classList.toggle('error',!saved);}
function syncWorkspace({preservePreview=false}={}){if(!preservePreview)lastValidPreview=null;steps=workspace.steps;$('export-mode').value=workspace.exportMode||'embedded';$('script-title').value=workspace.title;$('script-description').value=workspace.description;$('script-filename').value=workspace.filename;$('target-version').value=workspace.version;$('preflight').checked=workspace.preflight;$('execution-summary').checked=workspace.executionSummary;$('logging-enabled').checked=workspace.logging.enabled;$('logging-path').value=workspace.logging.path;renderSharedInputs();renderSteps();}
function updateSummary(step){const card=document.querySelector(`[data-step="${step.id}"]`);if(!card)return;const impact=stepImpact(step,workspace),effective=effectiveStep(step,workspace);card.querySelector('[data-summary]').textContent=stepSummary({...effective,values:sourceValues(resolveStep(effective,workspace.sharedInputs))})+`${effective.bulk?.field?` · ${effective.bulk.targets.length} targets`:''}${effective.onError==='continue'?' · Continue on error':''}${step.condition?.type==='service-stopped'?' · Only if stopped':step.condition?.type==='connectivity'?` · If check ${conditionSourceIndex(step,steps)+1} succeeds`:''}`;const badge=card.querySelector('[data-impact]');badge.textContent=impact==='preview'?'PREVIEW ONLY':impact==='disruptive'?'DISRUPTIVE':impact==='modify'?'MODIFIES SYSTEM':commands.find(c=>c.id===step.actionId).report||step.output?.format&&step.output.format!=='none'?'WRITES RESULT FILE':'READ ONLY';badge.className=`tag ${['modify','disruptive'].includes(impact)?'modify':''}`;const risk=card.querySelector('[data-risk]');if(risk)risk.textContent=impact==='preview'?'Preview only: -WhatIf reports the planned change without modifying the target.':step.actionId==='restart'?'⚠ Restarting a service may interrupt active users. Review before running.':'⚠ Changes the selected target. Verify permissions and review before running.';}

let toastTimer;
function toast(message){
  clearTimeout(toastTimer);
  if(matchMedia('(max-width:1100px)').matches){
    $('toast').hidden=true;
    const context=$('bench-context'),previous=context.textContent;context.textContent=message;
    toastTimer=setTimeout(()=>{if(context.textContent===message)context.textContent=previous;},3000);
  }else{$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
}
function markMatch(value,terms){let html='',position=0;const text=String(value),lower=text.toLowerCase();while(position<text.length){let term=terms.filter(t=>t.length>2&&lower.startsWith(t,position)).sort((a,b)=>b.length-a.length)[0];if(term){html+='<mark>'+escape(text.slice(position,position+term.length))+'</mark>';position+=term.length;}else html+=escape(text[position++]);}return html;}
function safetyLabel(c){return c.report?'WRITES RESULT FILE':c.riskTier==='disruptive'?'DISRUPTIVE':c.risk==='modify'||c.riskTier==='modify'?'MODIFIES SYSTEM':'READ ONLY';}
function renderCatalog(){
  const query=$('search').value.trim(),ranked=searchCatalog(searchIndex,query,{...discovery,category:commands.find(c=>c.id===steps.at(-1)?.actionId)?.category,previousOutput:commands.find(c=>c.id===steps.at(-1)?.actionId)?.outputType});
  const allowed=r=>(category==='All commands'||category==='Sysadmin Essentials'&&r.item.essentials||r.item.category===category)&&(collection==='all'||r.item.kind==='command'&&discovery[collection==='favorites'?'favorites':'recent'].includes(r.item.id));
  let found=ranked.commands.filter(allowed),recipes=query?ranked.workflows.filter(allowed):[];
  if(collection==='recent')found.sort((a,b)=>discovery.recent.indexOf(a.item.id)-discovery.recent.indexOf(b.item.id));
  $('result-count').textContent=`${found.length} command${found.length===1?'':'s'}${recipes.length?` · ${recipes.length} workflows`:''}`;
  document.querySelectorAll('[data-collection]').forEach(button=>button.setAttribute('aria-pressed',String(collection===button.dataset.collection)));
  const card=(r,suggest=false)=>{const c=r.item;return `<div class="command-entry"><button class="command-card" ${c.kind==='workflow'?`data-search-workflow="${c.id}"`:`data-add="${c.id}"`} title="${escape(c.description)}"><span class="command-icon" aria-hidden="true">${c.icon||'▤'}</span><span><strong><span class="visually-hidden">${c.kind==='workflow'?'Add workflow':'Add'} </span>${markMatch(c.name,r.matches)}</strong><p>${escape(c.description)}</p><span class="catalog-cmdlet">${escape(c.cmdlets||'Multi-step workflow')}</span><span class="catalog-add-label" aria-hidden="true">＋ Add</span><span class="tag ${safetyLabel(c)!=='READ ONLY'?'modify':''}">${safetyLabel(c)}${c.essentials?' · ★ ESSENTIAL':''}</span>${query?`<small class="match-reason">${suggest?'Also try · ':''}${escape(r.reason)}</small>`:''}</span></button><button class="inspect-command" data-inspect="${c.id}" data-kind="${c.kind}" aria-label="Inspect ${escape(c.name)}">Inspect</button>${c.kind==='command'?`<button class="favorite-button" data-favorite="${c.id}" aria-pressed="${discovery.favorites.includes(c.id)}" aria-label="${discovery.favorites.includes(c.id)?'Remove':'Save'} ${escape(c.name)} ${discovery.favorites.includes(c.id)?'from':'to'} favorites">${discovery.favorites.includes(c.id)?'★':'☆'}</button>`:''}</div>`;};
  const hints=!query?`<div class="search-examples">${[...new Set([...searchHistory.slice(0,3),'locked out user','expiring certificates','port 3389'])].map(q=>`<button class="text-button" data-search-example="${escape(q)}">${escape(q)}</button>`).join('')}</div>`:'';
  const empty=!found.length&&!recipes.length?`<div class="empty"><strong>No matching ${collection==='favorites'?'favorites':collection==='recent'?'recent commands':'commands or workflows'}.</strong><p>Try a task, cmdlet, event ID, or another category.</p><button class="text-button" data-reset-search>Browse all commands</button>${query?'<button class="text-button" data-copy-search>Not finding it? Copy this search</button>':''}${/win32.?product/i.test(query)?'<p>Win32_Product can trigger MSI repair. Use List installed software, which reads the registry.</p>':''}</div>`:'';
  $('results').innerHTML=hints+(recipes.length?`<h3 class="search-group">Workflows · ${recipes.length}</h3>`+recipes.map(r=>card(r)).join(''):'')+(query&&found.length?`<h3 class="search-group">Commands · ${found.length}</h3>`:'')+found.map(r=>card(r)).join('')+empty+(query&&ranked.suggestions.length?'<h3 class="search-group">Also try</h3>'+ranked.suggestions.filter(allowed).map(r=>card(r,true)).join(''):'')+(!found.length&&!recipes.length&&collection==='all'?'<h3 class="search-group">Popular commands</h3>'+['disk','certificates','uptime'].map(id=>card({item:{...commands.find(c=>c.id===id),kind:'command'},matches:[],reason:'Popular command'})).join(''):'');
  activeResult=-1;$('search').removeAttribute('aria-activedescendant');[...$('results').querySelectorAll('[data-add],[data-search-workflow]')].forEach((b,i)=>b.id='search-result-'+i);
  if(searchDebug){$('search-debug').textContent=JSON.stringify({localOnly:true,queries:searchStats.queries,zeroResults:searchStats.zero,zeroRate:searchStats.queries?searchStats.zero/searchStats.queries:0,missedSearches,results:ranked.results.map(r=>({id:r.item.id,score:r.score,fields:r.scores}))},null,2);}
}
function renderCategories(){const categories=['All commands','Sysadmin Essentials',...new Set(commands.map(c=>c.category))];$('categories').innerHTML=`<select id="command-category" aria-label="Category">${categories.map(c=>`<option ${category===c?'selected':''}>${escape(c)}</option>`).join('')}</select>`;}
function renderField(s,p){
  const id=`${s.id}-${p.name}`,describedBy=`${id}-help ${id}-error`;
  if(p.type==='select')return `<label class="field" for="${id}">${escape(p.label)}<select id="${id}" data-param="${p.name}" aria-describedby="${describedBy}">${p.options.map(value=>`<option ${s.values[p.name]===value?'selected':''}>${escape(value)}</option>`).join('')}</select><small id="${id}-help">${escape(p.help)}</small><small class="error" id="${id}-error"></small></label>`;
  if(p.type==='boolean'){const effective=effectiveStep(s,workspace);return `<label class="field check" for="${id}"><input id="${id}" data-param="${p.name}" type="checkbox" ${effective.values[p.name]?'checked':''} aria-describedby="${describedBy}"><span><span class="flag-title">${escape(p.label)} <code>${escape(p.flag)}</code></span><small id="${id}-help">${escape(p.help)}</small><small class="error" id="${id}-error"></small></span></label>${['whatIf','confirm','verbose'].includes(p.name)?renderBehaviorOrigin(s,p.name,workspace):''}`;}
  if(p.name==='computer'&&behaviorOrigin(s,'computer',workspace)==='Group default'){
    const effective=effectiveStep(s,workspace),value=resolveStep(effective,workspace.sharedInputs).values.computer;
    return `<div class="inherited-target"><strong>Computer target: ${escape(value||'Shared input is empty or missing')}</strong><p>Inherited from the group’s shared computer input.</p><button class="text-button" data-override-target>Override computer target</button></div>`;
  }
  const control=renderInputSource(s,p,{...workspace,steps});
  const targetOrigin=p.name==='computer'?renderBehaviorOrigin(s,'computer',workspace):'';
  if(typeof control==='string')return control+targetOrigin;
  return (control?.picker||'')+`<label class="field" for="${id}">${escape(p.label)}${!p.required?' <span>(optional)</span>':''}<input id="${id}" data-param="${p.name}" type="${p.type}" value="${escape(s.values[p.name])}" ${p.required?'required':''} ${p.type==='number'?`min="${p.min}" max="${p.max}" step="1"`:'maxlength="500"'} placeholder="${p.name==='service'?'Spooler':''}" aria-describedby="${describedBy}"><small id="${id}-help">${escape(p.help)}</small><small class="error" id="${id}-error"></small></label>${targetOrigin}`;

}
function renderExecution(step,action){
  const id=step.id,effective=effectiveStep(step,workspace);
  return `<fieldset class="command-flags"><legend>Execution</legend><label class="field" for="${id}-onError">If this step fails<select id="${id}-onError" data-execution="onError"><option value="stop" ${effective.onError!=='continue'?'selected':''}>Stop the script</option><option value="continue" ${effective.onError==='continue'?'selected':''}>Record error and continue</option></select><small>Continue reports a warning and an error result. Required module imports still stop on failure.</small></label>${renderBehaviorOrigin(step,'onError',workspace)}<small id="${id}-bulk-error" class="error"></small></fieldset>`;
}
function renderOutput(step,action){
  if(action.risk==='modify'||action.report)return '';
  const output=step.output||{format:'none',path:''},id=step.id;
  return `<fieldset class="command-flags result-options"><legend>Results</legend><label class="field" for="${id}-format">Output format<select id="${id}-format" data-output="format" aria-describedby="${id}-output-help ${id}-format-error">${[['none','Display in PowerShell'],['csv','Save as CSV'],['json','Save as JSON']].map(([value,label])=>`<option value="${value}" ${output.format===value?'selected':''}>${label}</option>`).join('')}</select><small class="error" id="${id}-format-error"></small></label><label class="field" for="${id}-output-path" data-output-path-container ${output.format==='none'?'hidden':''}>Destination path<input id="${id}-output-path" data-output="path" type="text" maxlength="500" value="${escape(output.path)}" placeholder="reports/results.csv" aria-describedby="${id}-output-help ${id}-path-error"><small class="error" id="${id}-path-error"></small></label><p id="${id}-output-help" class="flags-help">Result files are written when you run the script. The parent folder must exist; existing files are not overwritten.</p></fieldset>`;
}
function renderSteps(){
  const active=steps.find(s=>!s.collapsed);if(active)steps.forEach(s=>s.collapsed=s.id!==active.id);
  document.querySelector('.add-hint').hidden=steps.length>0;
  const openDetails=[...document.querySelectorAll('[data-step] details[open]')].map(d=>({id:d.closest('[data-step]').dataset.step,kind:d.className}));
  $('mobile-step-count').textContent=steps.length;$('step-count').textContent=`${steps.length} step${steps.length===1?'':'s'}`;$('clear').disabled=!steps.length;$('undo').disabled=!history.available;
  $('steps').innerHTML=steps.map((s,i)=>{
    const a=commands.find(c=>c.id===s.actionId);
    const group=(workspace.groups||[]).find(g=>g.id===s.groupId),recipe=group&&workflows.find(w=>w.id===group.workflowId),members=group?steps.filter(s=>s.groupId===group.id):[];
    const modifying=members.filter(s=>['modify','disruptive'].includes(stepImpact(s,workspace))).length,fileEffects=members.filter(s=>commands.find(c=>c.id===s.actionId).report||s.output?.format&&s.output.format!=='none').length;
    const groupHeader=group&&steps[i-1]?.groupId!==s.groupId?`<div class="workflow-group" data-workflow-group="${escape(group.id)}"><button class="text-button" data-group-collapse aria-expanded="${!group.collapsed}">${group.collapsed?'▸':'▾'} ${escape(group.name||recipe?.name||'Workflow group')}</button><small data-group-counts>${members.length} steps · ${modifying} modifies · ${fileEffects} writes files</small><div><button class="text-button" data-group-move="-1" aria-label="Move ${escape(group.name||recipe?.name||'Workflow group')} up">↑</button><button class="text-button" data-group-move="1" aria-label="Move ${escape(group.name||recipe?.name||'Workflow group')} down">↓</button><button class="text-button" data-group-remove aria-label="Delete ${escape(group.name||recipe?.name||'Workflow group')} group">×</button></div><p class="group-intent">${escape(group.intent||recipe?.description||'Steps sharing an operational purpose')}</p><button class="toolbar-button" data-group-settings="${escape(group.id)}">Behavior & presets</button></div>`:'';
    return `${groupHeader}${group?.collapsed&&steps[i-1]?.groupId!==s.groupId?`<div class="group-relationships" data-group-relationships="${escape(group.id)}"></div>`:''}<div class="relationship-row" data-relationships="${s.id}" ${group?.collapsed?'hidden':''}></div><article ${group?.collapsed?'hidden':''} class="script-step ${s.collapsed?'collapsed':'expanded'}" data-step="${s.id}"><div class="step-top" data-header><span class="step-num">${String(i+1).padStart(2,'0')}</span><button class="step-title" data-collapse aria-expanded="${!s.collapsed}" aria-controls="${s.id}-body">${escape(a.name)} <span aria-hidden="true">${s.collapsed?'▸':'▾'}</span></button></div><p class="step-summary" data-summary></p><div class="step-meta"><span data-impact class="tag"></span><div class="step-actions"><button data-move="-1" ${i===0?'disabled':''} aria-label="Move step ${i+1} up" title="Move up (Ctrl+Shift+↑)">↑</button><button data-move="1" ${i===steps.length-1?'disabled':''} aria-label="Move step ${i+1} down" title="Move down (Ctrl+Shift+↓)">↓</button><button data-remove aria-label="Remove step ${i+1}">×</button></div></div><span data-step-error class="error step-validation"></span><details class="step-menu"><summary aria-label="Step ${i+1} actions" title="Step actions">⋯</summary><div><button data-duplicate class="text-button" aria-label="Duplicate step ${i+1}" title="Ctrl+Shift+D">Duplicate</button><button data-reset class="text-button" aria-label="Reset defaults for step ${i+1}">Reset defaults</button><label class="field">Move step to group<select data-step-group><option value="">Ungrouped — end of workflow</option>${(workspace.groups||[]).map(g=>`<option value="${escape(g.id)}" ${g.id===s.groupId?'selected':''}>${escape(g.name||workflows.find(w=>w.id===g.workflowId)?.name||'Workflow group')}</option>`).join('')}<option value="__new__">Create group from this step</option></select></label></div></details><div id="${s.id}-body" ${s.collapsed?'hidden':''}><p class="step-description">${escape(a.description)}</p><span class="cmdlet">${escape(a.cmdlets)}</span><div class="step-fields">${a.parameters.filter(p=>p.type!=='boolean').map(p=>renderField(s,p)).join('')}</div>${a.parameters.some(p=>p.type==='boolean'&&p.name!=='verbose')?`<fieldset class="command-flags"><legend>Command flags</legend><p class="flags-help">Choose options for this step.</p>${a.parameters.filter(p=>p.type==='boolean'&&p.name!=='verbose').map(p=>renderField(s,p)).join('')}</fieldset>`:''}${renderEffectiveBehavior(s,workspace)}${renderOutput(s,a)}${renderResults(s,a)}${renderStepParameters(s,a,workspace)}<details class="advanced-options"><summary>Advanced options</summary>${a.parameters.filter(p=>p.name==='verbose').map(p=>renderField(s,p)).join('')}${renderExecution(s,a)}${renderCondition(s,i,steps)}</details><details class="requirements troubleshooting"><summary>Details</summary><strong>Requirements & compatibility</strong><p>${escape(a.requirements)}</p><p data-compatibility>${a.versions.includes(workspace.version)?`Supports PowerShell ${workspace.version} on Windows.`:'Unavailable for the selected version.'}</p><strong>Common problems & fixes</strong><ul>${troubleshooting(a).map(tip=>`<li>${escape(tip)}</li>`).join('')}</ul></details>${a.risk==='modify'?'<div class="risk-note" data-risk></div>':''}</div></article>`;
  }).join('');for(const d of openDetails){const card=document.querySelector(`[data-step="${d.id}"]`);if(card)for(const detail of card.querySelectorAll('details'))if(detail.className===d.kind)detail.open=true;}renderPreview();persist();
}
// Tokenize first, then escape each token. User values never become HTML.
function highlight(line){const pattern=/(#[^\n]*$|'(?:[^']|'')*'|\$[\w_.]+|\b[A-Za-z]+-[A-Za-z]+\b|-[A-Za-z]+\b)/g;let html='',last=0;for(const m of line.matchAll(pattern)){html+=escape(line.slice(last,m.index));const token=m[0],kind=token.startsWith('#')?'comment':token.startsWith("'")?'string':token.startsWith('$')?'variable':token.startsWith('-')?'param':'cmdlet';html+=`<span class="syntax-${kind}">${escape(token)}</span>`;last=m.index+token.length;}return html+escape(line.slice(last));}
function renderPreview(){
  for(const step of steps)if(step.scopeAcknowledgement&&!scopeAcknowledged(step,steps,workspace))delete step.scopeAcknowledgement;
  const evaluated=effectiveWorkspace({...workspace,steps}),review=reviewWorkspace({...workspace,steps});
  refreshRelationships();
  const incomplete=[];
  let invalid=review.errors.length>0;
  for(const s of steps){
    const a=commands.find(c=>c.id===s.actionId),effective=evaluated.steps.find(t=>t.id===s.id),errors=executionErrors(a,effective,workspace.sharedInputs,sourceValues({...effective,values:validationValues(effective,steps.indexOf(s),evaluated).values})),outputIssues=outputErrors(a,s.output),compatible=a.versions.includes(workspace.version);
    invalid ||= Object.keys(errors).length>0||!compatible;
    const pending=pristineSteps.has(s.id)&&!a.parameters.some(p=>touchedFields.has(s.id+'-'+p.name)&&errors[p.name]);
    if(Object.keys(errors).length||Object.keys(outputIssues).length||!compatible||review.errors.some(message=>message.startsWith(`${steps.indexOf(s)+1}. `)))incomplete.push(s.id);
    const card=document.querySelector(`[data-step="${s.id}"]`);
    card.querySelector('[data-compatibility]').textContent=compatible?`Supports PowerShell ${workspace.version} on Windows.`:'Unavailable for the selected version.';
    card.querySelector('[data-step-error]').textContent=!compatible?'Choose a compatible PowerShell version.':Object.keys(errors).length?(pending?'Needs configuration':'Fix fields or execution settings'):Object.keys(outputIssues).length?'Fix result output settings':review.errors.find(message=>message.startsWith(`${steps.indexOf(s)+1}. `))||'';
    card.dataset.incomplete=String(incomplete.includes(s.id));
    card.querySelector('[data-step-error]').classList.toggle('configuration-pending',pending&&Object.keys(errors).length>0);
    for(const p of a.parameters){const input=$(`${s.id}-${p.name}`),error=$(`${s.id}-${p.name}-error`);const visibleError=(!pristineSteps.has(s.id)||touchedFields.has(input?.id))?errors[p.name]:'';if(input){input.classList.toggle('invalid',Boolean(visibleError));input.setAttribute('aria-invalid',String(Boolean(visibleError)));}if(error)error.textContent=visibleError||'';}
    const pathContainer=card.querySelector('[data-output-path-container]');if(pathContainer)pathContainer.hidden=s.output?.format==='none';
    for(const key of ['format','path']){const field=card.querySelector(`[data-output="${key}"]`);if(field){const error=$(`${s.id}-${key}-error`);error.textContent=outputIssues[key]||'';field.setAttribute('aria-invalid',String(Boolean(outputIssues[key])));}}
    $(`${s.id}-bulk-error`).textContent=errors.bulk||errors.onError||errors.bindings||'';
    const queryErrors=resultErrors(a,s),guards=conditionErrors(s,steps.indexOf(s),steps);const query=card.querySelector('[data-results-error]');if(query)query.textContent=Object.values(queryErrors).join(' ');const guard=card.querySelector('[data-condition-error]');if(guard)guard.textContent=guards.join(' ');const sample=card.querySelector('[data-sample]');if(sample)sample.innerHTML=sampleMarkup(s,a);
    const parameterNote=card.querySelector('[data-parameter-error]');if(parameterNote)parameterNote.textContent=parameterErrors(effectiveWorkspace({...workspace,steps})).join(' ');
    const contract=card.querySelector('[data-input-source-error]');if(contract)contract.textContent=[...sourceErrors(s,steps.indexOf(s),steps,workspace),...scopeErrors(s,steps.indexOf(s),steps,workspace)].join(' ');
    const ack=card.querySelector('[data-acknowledge-scope]');if(ack)ack.checked=scopeAcknowledged(s,steps,workspace);
    const sourceScope=card.querySelector('[data-source-scope]');if(sourceScope)sourceScope.textContent=sourceScopeText(steps[resultSourceIndex(s,steps)],workspace);
    for(const input of card.querySelectorAll('[data-param][type="checkbox"]')){input.checked=!!effective.values[input.dataset.param];input.disabled=input.dataset.param==='whatIf'&&workspace.dryRun===true;}
    for(const note of card.querySelectorAll('[data-behavior-origin]')){
      const key=note.dataset.behaviorOrigin,origin=behaviorOrigin(s,key,workspace),label=({whatIf:'WhatIf',confirm:'Confirmation',verbose:'Verbose evidence',onError:'Failure handling',computer:'Computer target'})[key];
      note.querySelector('span').textContent=label+': '+origin+(origin==='Group default'?' · Editing creates a step override':'');note.querySelector('button').hidden=!s.behaviorOverrides?.[key];
    }
    const behaviorContent=card.querySelector('[data-effective-behavior-content]');if(behaviorContent)behaviorContent.innerHTML=renderEffectiveBehaviorContent(s,workspace);
    updateSummary(s);
  }
  for(const group of workspace.groups||[]){const members=steps.filter(s=>s.groupId===group.id),count=document.querySelector(`[data-workflow-group="${CSS.escape(group.id)}"] [data-group-counts]`);if(count)count.textContent=`${members.length} steps · ${members.filter(s=>['modify','disruptive'].includes(stepImpact(s,workspace))).length} modifies · ${members.filter(s=>commands.find(c=>c.id===s.actionId).report||s.output?.format&&s.output.format!=='none').length} writes files`;}
  script=invalid?'':generateScript(steps,workspace);
  if(!invalid)lastValidPreview={script,marked:generateScript(steps,{...workspace,previewMarkers:true})};
  const display=lastValidPreview?.marked||'# Configure a step to see its PowerShell here.\n';
  $('preview-stale').hidden=!invalid;
  $('preview-stale-label').textContent=lastValidPreview?'Out of date · Last valid preview':'Draft incomplete · No valid preview yet';
  $('preview-stale').querySelector('p').textContent=lastValidPreview?'Your latest changes are not reflected below. Configure incomplete steps to enable copy and download.':'Configure incomplete steps to create a valid preview and enable copy and download.';
  $('fix-incomplete').dataset.target=incomplete[0]||'';
  const selected=steps.find(s=>!s.collapsed);
  $('bench-context').textContent=(selected?'Step '+(steps.indexOf(selected)+1)+' · '+commands.find(c=>c.id===selected.actionId).name:steps.length+' steps')+(invalid?' · Needs configuration':steps.length?' · Ready to export':' · Add a command');
  $('code').classList.toggle('expert-mode',workspace.viewMode==='expert');
  document.querySelectorAll('[data-view-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.viewMode===workspace.viewMode)));
  let owner='',lineNumber=0;
  $('code').innerHTML=display.trimEnd().split('\n').flatMap(line=>{const marker=line.trim().match(/^# SHELLIFY_(BEGIN|END) (.+)$/);if(marker){owner=marker[1]==='BEGIN'?marker[2]:'';return [];}return [`<div class="code-line" ${owner&&!invalid?'data-code-step="'+escape(owner)+'"':''}><span class="line-number" aria-hidden="true">${++lineNumber}</span><span>${highlight(line)||' '}</span></div>`];}).join('');
  highlightSelectedStep();
  const modifying=steps.filter(s=>['modify','disruptive'].includes(stepImpact(s,workspace))).length,previews=steps.filter(s=>stepImpact(s,workspace)==='preview').length;
  $('context-title').textContent=workspace.title.trim()||'Untitled script';
  $('context-version').textContent='PowerShell '+workspace.version;
  $('context-scope').textContent=scriptScope({...workspace,steps});
  $('context-scope').title=$('context-scope').textContent;
  $('context-counts').textContent=`${steps.length} step${steps.length===1?'':'s'} · ${modifying} modifying${previews?` · ${previews} preview only`:''}`;
  $('context-status').textContent=invalid?'Needs configuration':steps.length?'Ready to export':'Add a command';
  $('context-status').classList.toggle('error',invalid);
  $('context-requirements').disabled=!steps.length;
  $('script-status').textContent=invalid?'Needs configuration · Export unavailable':!steps.length?'Add your first command':`Ready to export · ${modifying} modifying step${modifying===1?'':'s'}${previews?` · ${previews} preview only`:''}`;
  $('script-status').classList.toggle('error',invalid);$('copy').disabled=$('download').disabled=$('save-script').disabled=invalid||!steps.length;
  $('export-filename').textContent=filenameFor(workspace.filename);
  if(review.files.length&&!invalid)$('script-status').textContent+=` · Writes ${review.files.length} result file${review.files.length===1?'':'s'}`;
  $('review-script').disabled=!steps.length;$('invocation-preview').hidden=workspace.exportMode!=='parameters';$('invocation-preview').textContent=workspace.exportMode==='parameters'?`Example invocation: ${invocation(effectiveWorkspace({...workspace,steps}))}`:'';
  $('shared-input-errors').textContent=[...sharedInputErrors(workspace.sharedInputs),...parameterErrors(effectiveWorkspace({...workspace,steps}))].join(' ');
  $('logging-path-label').hidden=!workspace.logging.enabled;$('runtime-errors').textContent=runtimeErrors({...workspace,steps}).join(' ');
  $('ordering-warning').textContent=runtimeErrors({...workspace,steps}).join(' ');$('ordering-warning').hidden=!$('ordering-warning').textContent;
  const last=steps.at(-1),action=commands.find(c=>c.id===last?.actionId),related=action?.related||[],typed=commands.filter(c=>c.accepts.includes(action?.outputType)).map(c=>c.id);
  $('next-steps').innerHTML=last&&[...new Set([...related,...typed])].length?`<strong>What’s next?</strong><p>${action.risk==='modify'?'Verify the change with a read-only check.':'Continue with a compatible step.'}</p>${[...new Set([...related,...typed])].map(id=>`<button class="toolbar-button" data-next="${id}">＋ ${escape(commands.find(c=>c.id===id).name)}</button>`).join('')}`:'';
}
$('search').addEventListener('input',()=>{renderCatalog();if(searchDebug){searchStats.queries++;const query=$('search').value.trim();if(query&&!searchCatalog(searchIndex,query,discovery).results.length){searchStats.zero++;missedSearches=[query,...missedSearches.filter(s=>s!==query)].slice(0,20);try{localStorage.setItem('shellify.missed-searches',JSON.stringify(missedSearches));}catch{}}renderCatalog();}});
$('categories').addEventListener('change',e=>{category=e.target.value;renderCatalog();});
document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>{category='All commands';$('search').value=b.dataset.query;renderCategories();renderCatalog();}));
$('results').addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){const id=favorite.dataset.favorite;discovery.favorites=discovery.favorites.includes(id)?discovery.favorites.filter(value=>value!==id):[...discovery.favorites,id];if(!saveDiscovery(storage,discovery))toast('Favorites cannot be saved while browser storage is unavailable.');renderCatalog();return;}const b=e.target.closest('[data-add]');if(!b)return;if(steps.length>=200){toast('A script can contain up to 200 steps.');return;}const a=commands.find(c=>c.id===b.dataset.add);const s=createStep(a.id);pristineSteps.add(s.id);s.collapsed=!searchAddExpanded;remember();steps.forEach(step=>step.collapsed=true);steps.push(s);trackRecent(a.id);renderSteps();if(searchAddExpanded){showPane('configure');const card=document.querySelector(`[data-step="${s.id}"]`);card.scrollIntoView({behavior:'smooth',block:'nearest'});(card.querySelector('input')||card.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});}else{$('search').focus();}toast(`${a.name} added`);});
$('steps').addEventListener('input',e=>{
  const input=e.target.closest('[data-param],[data-output],[data-execution]');if(!input)return;
  const step=steps.find(s=>s.id===input.closest('[data-step]').dataset.step);
  if(input.matches('[data-param]'))touchedFields.add(input.id);
  const key=input.dataset.execution?'onError':input.dataset.param;
  if(step.groupId&&['whatIf','confirm'].includes(key)){
    const after=cloneCurrentWorkspace(),changed=after.steps.find(s=>s.id===step.id);changed.values[key]=input.checked;changed.behaviorOverrides||={};changed.behaviorOverrides[key]=true;
    const proposal=planBehaviorChange({...workspace,steps},after,'Review step override',[step.id]);
    if(proposal.requiresAcknowledgement){input.checked=effectiveStep(step,workspace).values[key]===true;stageBehaviorChange(after,'Review step override',[step.id]);return;}
  }
  if(input.type==='checkbox'||editingInput!==input){remember();editingInput=input;}
  if(['whatIf','confirm','verbose','onError','computer'].includes(key)){step.behaviorOverrides||={};step.behaviorOverrides[key]=true;}
  if(input.dataset.execution)step.onError=input.value;
  else if(input.dataset.output){step.output||={format:'none',path:''};step.output[input.dataset.output]=input.value;}
  else step.values[input.dataset.param]=input.type==='checkbox'?input.checked:input.value;
  renderPreview();persist();
});
$('steps').addEventListener('focusout',e=>{editingInput=null;if(e.target.matches('[data-param]')){touchedFields.add(e.target.id);renderPreview();}});
$('steps').addEventListener('click',e=>{
  const b=e.target.closest('[data-move], [data-remove], [data-duplicate], [data-reset], [data-collapse], [data-focus-step]');if(!b)return;
  const id=b.closest('[data-step]').dataset.step,index=steps.findIndex(s=>s.id===id),step=steps[index];
  if(b.hasAttribute('data-collapse')){const opening=step.collapsed;steps.forEach(s=>s.collapsed=opening?s.id!==id:true);renderSteps();document.querySelector(`[data-step="${id}"] [data-collapse]`)?.focus({preventScroll:true});return;}
  if(b.hasAttribute('data-duplicate')&&steps.length>=200){toast('A script can contain up to 200 steps.');return;}
  if(b.hasAttribute('data-reset')&&step.groupId){
    const after=cloneCurrentWorkspace(),reset=after.steps.find(s=>s.id===id),groupId=reset.groupId;
    Object.assign(reset,createStep(step.actionId),{id,groupId});delete reset.results;delete reset.inputSourceId;delete reset.inputStep;delete reset.scopeAcknowledgement;
    stageBehaviorChange(after,'Review step defaults',[id]);return;
  }
  remember();
  if(b.hasAttribute('data-remove')){steps.splice(index,1);toast('Step removed. Use Undo to restore it.');}
  else if(b.hasAttribute('data-duplicate')){steps.forEach(s=>s.collapsed=true);const duplicate={...copy(step),id:crypto.randomUUID(),collapsed:false};delete duplicate.scopeAcknowledgement;steps.splice(index+1,0,duplicate);toast('Step duplicated');}
  else if(b.hasAttribute('data-reset')){steps.forEach(s=>s.collapsed=s.id!==id);step.values=defaults(commands.find(c=>c.id===step.actionId));step.output={format:'none',path:''};step.bindings={};step.bulk={field:'',targets:[]};step.onError='stop';delete step.results;step.condition={type:'none'};step.parameterFields={};step.behaviorOverrides={};step.collapsed=false;delete step.inputSourceId;delete step.inputStep;delete step.scopeAcknowledgement;toast('Step reset. Use Undo to restore your settings.');}
  else{const other=index+Number(b.dataset.move);if(other<0||other>=steps.length)return;if(step.groupId!==steps[other].groupId&&(step.groupId||steps[other].groupId)){toast('Use the workflow group arrows to move between groups.');return;}[steps[index],steps[other]]=[steps[other],steps[index]];}

  renderSteps();
  const focusId=b.hasAttribute('data-duplicate')?steps[index+1].id:b.hasAttribute('data-remove')?steps[Math.min(index,steps.length-1)]?.id:id;
  const focusButton=document.querySelector(`[data-step="${focusId}"] [data-collapse]`);
  focusButton?.focus({preventScroll:true});focusButton?.scrollIntoView({block:'nearest'});
});
$('clear').addEventListener('click',()=>{remember();steps.length=0;renderSteps();toast('Script cleared. Use Undo to restore it.');});
$('undo').addEventListener('click',()=>{const previous=history.undo();if(previous){workspace=previous;editingInput=null;syncWorkspace();toast('Last change undone');}});
$('start-fresh').addEventListener('click',()=>{if(!window.confirm('Start a fresh script? Your current draft will be cleared. You can restore it with Undo.'))return;remember();workspace=freshWorkspace();workspace.steps=[];syncWorkspace();toast('Fresh script started. Use Undo to restore your draft.');});
$('browse').addEventListener('click',()=>{showPane('discover');$('search').focus();$('catalog').scrollIntoView({behavior:'smooth',block:'start'});});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();showPane('discover');$('search').focus();}});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(script);toast('Script copied to clipboard');}catch{toast('Clipboard unavailable. Select the preview text to copy it manually.');}});
$('download').addEventListener('click',()=>{const blob=new Blob(['\ufeff'+script.replaceAll('\n','\r\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filenameFor(workspace.filename);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PowerShell script downloaded');});
$('guide-button').addEventListener('click',()=>$('guide').showModal());$('close-guide').addEventListener('click',()=>$('guide').close());
for(const [id,key] of [['script-title','title'],['script-description','description'],['script-filename','filename'],['target-version','version']]){
  $(id).addEventListener('input',e=>{if(editingInput!==e.target){remember();editingInput=e.target;}workspace[key]=e.target.value;renderPreview();persist();});
  $(id).addEventListener('focusout',()=>{editingInput=null;});
}
for(const [id,key] of [['preflight','preflight'],['execution-summary','executionSummary'],['logging-enabled','enabled'],['logging-path','path']]){
  $(id).addEventListener('input',e=>{if(e.target.type==='checkbox'||editingInput!==e.target){remember();editingInput=e.target;}const value=e.target.type==='checkbox'?e.target.checked:e.target.value;if(key==='enabled'||key==='path')workspace.logging[key]=value;else workspace[key]=value;renderPreview();persist();});
  $(id).addEventListener('focusout',()=>editingInput=null);
}
function openScriptOptions(){$('dry-run').checked=workspace.dryRun===true;$('reachable-only').checked=workspace.reachableOnly!==false;$('fleet-targets').value=(workspace.targets||[]).join('\n');$('script-options').showModal();}
$('options-button').addEventListener('click',openScriptOptions);
$('context-edit').addEventListener('click',()=>{openScriptOptions();$('script-title').focus();});
$('context-requirements').addEventListener('click',()=>{renderReview();$('script-review').showModal();});
$('close-options').addEventListener('click',()=>$('script-options').close());
let library=readLibrary(storage).items;
function renderLibrary(){
  $('library-entry').innerHTML='<option value="">Save as a new script</option>'+library.map(item=>`<option value="${escape(item.id)}" ${workspace.libraryId===item.id?'selected':''}>Update ${escape(item.name)}</option>`).join('');
  $('save-script').textContent=$('library-entry').value?'Update saved':'Save new';
  $('saved-scripts').innerHTML=library.length?library.map(item=>`<div class="library-item"><div><strong>${escape(item.name)}</strong><small>${item.workspace.steps.length} steps · PowerShell ${item.workspace.version}</small></div><div class="saved-script-actions"><input type="text" data-rename-value="${escape(item.id)}" maxlength="100" aria-label="Name for ${escape(item.name)}" value="${escape(item.name)}"><button class="text-button" data-rename="${escape(item.id)}" aria-label="Rename ${escape(item.name)}">Rename</button>${item.previous?`<button class="text-button" data-restore-version="${escape(item.id)}" aria-label="Restore previous version of ${escape(item.name)}">Previous version</button>`:''}<button class="text-button" data-load="${escape(item.id)}" aria-label="Open ${escape(item.name)}">Open</button><button class="text-button" data-delete="${escape(item.id)}" aria-label="Delete ${escape(item.name)}">Delete</button></div></div>`).join(''):'<p class="dialog-help">No saved scripts yet. Give your script a name and select Save current.</p>';
  $('workflow-list').innerHTML=workflows.map(w=>`<button class="workflow-card" data-workflow="${w.id}"><strong>${escape(w.name)}</strong><span>${escape(w.description)}</span><small>Add ${w.actions.length} steps</small></button>${w.id==='service-check'?'<button data-optional-restart class="toolbar-button">Add optional service restart</button>':''}`).join('');
}
$('library-button').addEventListener('click',()=>{library=readLibrary(storage).items;$('library-name').value=library.find(item=>item.id===workspace.libraryId)?.name||workspace.title;renderLibrary();$('project-error').textContent='';$('script-library').showModal();});
$('close-library').addEventListener('click',()=>$('script-library').close());
// Backdrop clicks dismiss these dialogs at any scroll position. A drag that
// starts inside the dialog must not dismiss it when released outside.
function enableBackdropDismiss(dialog){
  let backdropPress=false;
  function outside(event){
    const bounds=dialog.getBoundingClientRect();
    return event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom);
  }
  dialog.addEventListener('pointerdown',event=>{backdropPress=event.button===0&&outside(event);});
  dialog.addEventListener('pointercancel',()=>{backdropPress=false;});
  dialog.addEventListener('close',()=>{backdropPress=false;});
  dialog.addEventListener('click',event=>{
    const dismiss=backdropPress&&outside(event);backdropPress=false;
    if(dismiss)dialog.close();
  });
}
enableBackdropDismiss($('script-library'));
enableBackdropDismiss($('guide'));
$('library-entry').addEventListener('change',()=>{const item=library.find(i=>i.id===$('library-entry').value);$('library-name').value=item?.name||workspace.title;$('save-script').textContent=item?'Update saved':'Save new';});
$('save-script').addEventListener('click',()=>{
  if($('copy').disabled){toast('Fix step errors before saving');return;}
  try{const updated=saveEntry(readLibrary(storage).items,$('library-entry').value,$('library-name').value,workspace);if(!saveLibrary(storage,updated.items))throw Error('Browser storage is unavailable or full.');library=updated.items;workspace.libraryId=updated.id;persist();renderLibrary();toast(library.find(item=>item.id===updated.id).previous?'Saved script updated. Its previous version is kept.':'New script saved');}catch(error){$('project-error').textContent=error.message;}
});
let deletedScript=null;
$('saved-scripts').addEventListener('click',e=>{
  const b=e.target.closest('[data-load], [data-delete], [data-rename], [data-restore-version]');if(!b)return;
  const item=library.find(item=>item.id===(b.dataset.load||b.dataset.delete||b.dataset.rename||b.dataset.restoreVersion));if(!item)return;
  if(b.hasAttribute('data-rename')){try{const name=document.querySelector(`[data-rename-value="${item.id}"]`).value;const next=renameEntry(readLibrary(storage).items,item.id,name);if(!saveLibrary(storage,next))throw Error('Unable to update the library');library=next;renderLibrary();toast('Saved script renamed');}catch(error){$('project-error').textContent=error.message;}return;}
  if(b.hasAttribute('data-restore-version')){try{const next=restoreEntry(readLibrary(storage).items,item.id);if(!saveLibrary(storage,next))throw Error('Unable to restore previous version');library=next;const restored=library.find(i=>i.id===item.id);remember();workspace=copy(restored.workspace);workspace.libraryId=item.id;syncWorkspace();$('script-library').close();showPane('configure');toast('Previous version restored. Undo restores your draft.');}catch(error){$('project-error').textContent=error.message;}return;}
  if(b.hasAttribute('data-load')){remember();workspace=copy(item.workspace);workspace.libraryId=item.id;workspace.steps=workspace.steps.map(s=>({...s,id:crypto.randomUUID()}));syncWorkspace();$('script-library').close();showPane('configure');toast('Saved script opened. Use Undo to restore the previous draft.');}
  else{const next=library.filter(s=>s.id!==item.id);if(!saveLibrary(storage,next)){toast('Unable to update the library');return;}deletedScript=item;library=next;renderLibrary();$('restore-deleted').hidden=false;toast('Saved script deleted. Restore is available in this library.');}
});
$('restore-deleted').addEventListener('click',()=>{if(!deletedScript)return;const latest=readLibrary(storage).items;if(latest.length>=50){toast('The library is full. Delete a script before restoring.');return;}const next=[deletedScript,...latest];if(!saveLibrary(storage,next)){toast('Unable to restore saved script');return;}library=next;deletedScript=null;$('restore-deleted').hidden=true;renderLibrary();toast('Saved script restored');});
function addWorkflow(id,provided=null){const workflow=workflows.find(w=>w.id===id);if(!workflow||steps.length+workflow.actions.length>200){toast('A script can contain up to 200 steps.');return;}if(workflow.inputs&&provided===null){openWorkflowInputs(workflow);return;}remember();insertWorkflow(workspace,id,provided||{});steps=workspace.steps;workflow.actions.forEach(trackRecent);renderSharedInputs();renderSteps();$('script-library').close();showPane('configure');toast(workflow.name+' added to the current script. Use Undo to remove it.');}
$('workflow-list').addEventListener('click',e=>{if(e.target.closest('[data-optional-restart]')){if(steps.length>=200){toast('A script can contain up to 200 steps.');return;}remember();const step=createStep('restart');const shared=workspace.sharedInputs.find(i=>i.name==='Service name');if(shared)step.bindings.service=shared.id;steps.forEach(s=>s.collapsed=true);steps.push(step);renderSteps();$('script-library').close();showPane('configure');toast('Restart added. Choose an explicit service target before exporting. Undo removes it.');return;}const b=e.target.closest('[data-workflow]');if(b)addWorkflow(b.dataset.workflow);});
function openWorkflows(){library=readLibrary(storage).items;renderLibrary();$('script-library').showModal();$('workflow-list').scrollIntoView({block:'start'});$('workflow-list').querySelector('button')?.focus();}
$('workflow-empty').addEventListener('click',openWorkflows);
$('collections').addEventListener('click',e=>{const b=e.target.closest('[data-collection]');if(b){collection=b.dataset.collection;renderCatalog();}});
function downloadFile(text,filename,type){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-project').addEventListener('click',()=>{downloadFile(exportProject(workspace),projectFilename(workspace),'application/json');toast('Editable Shellify project exported');});
$('share-project').addEventListener('click',async()=>{
  $('project-error').textContent='';$('share-link-field').hidden=true;$('share-link').value='';$('share-project').disabled=true;
  try{
    const hash=await createShareHash(workspace),url=new URL(location.href);url.search='';url.hash=hash;
    $('share-link').value=url.href;$('share-link-field').hidden=false;
  }catch(error){$('project-error').textContent=error.message;}
  finally{$('share-project').disabled=false;}
});
$('copy-share-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('share-link').value);toast('Share link copied');}
  catch{$('share-link').focus();$('share-link').select();$('project-error').textContent='Clipboard unavailable. Copy the selected share link.';}
});
$('import-project').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>MAX_PROJECT_BYTES)throw Error('Project files must be smaller than 1 MB.');const imported=importProject(await file.text());remember();workspace=imported;syncWorkspace();$('script-library').close();showPane('configure');toast('Project imported. Use Undo to restore your previous draft.');}
  catch(error){$('project-error').textContent=error.message;}
  finally{e.target.value='';}
});
function renderReview(){
  const review=reviewWorkspace(workspace);
  const list=(items,empty)=>items.length?`<ul>${items.map(value=>`<li>${escape(value)}</li>`).join('')}</ul>`:`<p class="dialog-help">${empty}</p>`;
  $('review-content').innerHTML=`<p class="dialog-help">${workspace.exportMode==='parameters'?'Parameterized strings; see the example invocation.':'Embedded values.'} Target: PowerShell ${escape(workspace.version)} on Windows. Shellify never runs this script. Requirements to review: permissions, modules, and targets have not been checked in your environment.</p>${review.errors.length?`<div class="risk-note"><strong>Blocking problems</strong>${list(review.errors,'')}</div>`:''}<h3>Run options</h3><p class="dialog-help">${workspace.preflight?'Preflight checks enabled.':'Preflight checks disabled.'} ${workspace.executionSummary?'Execution summary enabled.':'Execution summary disabled.'} ${workspace.logging.enabled?`Transcript: ${escape(workspace.logging.path)}`:'Logging disabled.'}</p><h3>Required modules</h3>${list(review.modules,'Uses built-in PowerShell commands; no additional module imports.')}<h3>Configured scope</h3><p class="dialog-help">${escape(scriptScope(workspace))}</p><h3>Configured target values</h3>${list([...(workspace.targets||[]).map(target=>`Fleet computer: ${target}`),...review.targets],'No explicit remote or network target values.')}<h3>System changes</h3>${list(review.modifying,'No system-modifying commands.')}${review.previews.length?`<h3>Preview-only actions</h3>${list(review.previews,'')}`:''}<h3>Result files</h3>${list(review.files.map(item=>`${item.label}: ${item.format.toUpperCase()} → ${item.path}`),'Results display in PowerShell; no result files are written.')}${review.files.length?'<p class="dialog-help">Requires write permission to existing destination folders. Existing files are not overwritten.</p>':''}<h3>Steps, targets & error handling</h3>${steps.map((step,index)=>{const a=commands.find(c=>c.id===step.actionId),v=resolveStep(effectiveStep(step,workspace),workspace.sharedInputs).values;for(const d of parameterDefinitions(effectiveWorkspace(workspace)))for(const use of d.uses)if(use.index===index)v[use.field]='Runtime parameter: '+d.name;return `<div class="review-step"><button class="text-button" data-review-step="${index}">Edit step ${index+1}: ${escape(a.name)}</button><p>${v.computer?`Remote computer: ${escape(v.computer)}`:a.category==='Active Directory'?`Directory query: ${escape(v.server||'current domain')}`:workspace.targets?.length&&a.remote&&!a.report?'Runs on configured fleet targets':`Runs locally${v.host?`; network destination: ${escape(v.host)}`:''}`} · ${effectiveStep(step,workspace).onError==='continue'?'Record errors and continue':'Stop on error'}${step.bulk?.field?` · Bulk ${escape(step.bulk.field)}: ${step.bulk.targets.map(escape).join(', ')}`:''}${step.condition?.type&&step.condition.type!=='none'?` · Condition: ${escape(step.condition.type)}${step.condition.type==='connectivity'?` from step ${conditionSourceIndex(step,steps)+1}`:''}`:''}</p></div>`;}).join('')}<h3>Informational requirements & permissions</h3>${review.permissions.map(item=>`<div class="review-permission"><strong>${escape(item.label)}</strong><p>${escape(item.requirements)}</p></div>`).join('')}`;
}
$('review-script').addEventListener('click',()=>{renderReview();$('script-review').showModal();});
$('close-review').addEventListener('click',()=>$('script-review').close());
function renderSharedInputs(){
  $('shared-input-list').innerHTML=workspace.sharedInputs.map(input=>`<div class="shared-input-row" data-shared-id="${escape(input.id)}"><label class="field">Input name<input data-shared="name" type="text" maxlength="100" value="${escape(input.name)}"></label><label class="field">Input value<input data-shared="value" type="text" maxlength="500" value="${escape(input.value)}"></label>${workspace.exportMode==='parameters'?`<div class="shared-parameter"><label class="field check"><input type="checkbox" data-shared-parameter="enabled" ${input.parameter?.enabled?'checked':''}><span>Export as a parameter</span></label>${input.parameter?.enabled?`<label class="field">Parameter name<input data-shared-parameter="name" maxlength="40" value="${escape(input.parameter.name)}"></label><label class="field check"><input type="checkbox" data-shared-parameter="required" ${input.parameter.required?'checked':''}><span>Required at runtime (no default)</span></label>`:''}</div>`:''}<button class="text-button" data-remove-input aria-label="Remove ${escape(input.name)}">Remove</button></div>`).join('')||'<p class="dialog-help">No shared inputs yet. Add one, then link text fields using their value-source selectors.</p>';
  $('shared-input-errors').textContent=sharedInputErrors(workspace.sharedInputs).join(' ');
}
$('inputs-button').addEventListener('click',()=>{renderSharedInputs();$('shared-inputs').showModal();});
$('close-inputs').addEventListener('click',()=>$('shared-inputs').close());
$('shared-inputs').addEventListener('close',()=>renderSteps());
$('add-shared-input').addEventListener('click',()=>{if(workspace.sharedInputs.length>=50){toast('Use at most 50 shared inputs');return;}remember();workspace.sharedInputs.push({id:crypto.randomUUID(),name:`Input ${workspace.sharedInputs.length+1}`,value:''});renderSharedInputs();renderSteps();});
$('shared-input-list').addEventListener('input',e=>{const input=e.target.closest('[data-shared]');if(!input)return;const item=workspace.sharedInputs.find(i=>i.id===input.closest('[data-shared-id]').dataset.sharedId);if(editingInput!==input){remember();editingInput=input;}item[input.dataset.shared]=input.value;$('shared-input-errors').textContent=sharedInputErrors(workspace.sharedInputs).join(' ');renderPreview();persist();});
$('shared-input-list').addEventListener('focusout',()=>editingInput=null);
$('shared-input-list').addEventListener('click',e=>{const b=e.target.closest('[data-remove-input]');if(!b)return;remember();workspace.sharedInputs=workspace.sharedInputs.filter(i=>i.id!==b.closest('[data-shared-id]').dataset.sharedId);renderSharedInputs();renderSteps();});
$('output-views').addEventListener('click',e=>{const b=e.target.closest('[data-view-mode]');if(!b||b.dataset.viewMode===workspace.viewMode)return;remember();workspace.viewMode=b.dataset.viewMode;renderPreview();persist();});
$('focus-output').addEventListener('click',()=>{const expanded=$('focus-output').getAttribute('aria-pressed')!=='true';document.querySelector('.workspace').classList.remove('configuration-focused');document.querySelector('.workspace').classList.toggle('output-focused',expanded);$('focus-output').setAttribute('aria-pressed',String(expanded));$('focus-output').textContent=expanded?'⤡':'⤢';$('focus-output').setAttribute('aria-label',expanded?'Restore workspace':'Expand output');$('focus-output').title=expanded?'Restore workspace':'Expand output';});
renderCategories();renderCatalog();syncWorkspace();
if(draft.restored)toast('Your previous draft was restored');
else if(draft.error)toast('The previous draft could not be restored. A fresh script is ready.');
if(sharedProject){remember();workspace=sharedProject;syncWorkspace();toast('Shared project opened. Use Undo to restore your previous draft.');}
else if(shareError){$('project-error').textContent=shareError;$('script-library').showModal();}



// Wrapping changes only the displayed layout, never copied or downloaded code.
let wrapEnabled=true;
try{wrapEnabled=localStorage.getItem('shellify.wrap')!=='off';}catch{}
function renderWrap(){ $('code').classList.toggle('wrap-enabled',wrapEnabled);$('wrap-toggle').setAttribute('aria-pressed',String(wrapEnabled));$('wrap-toggle').title=`Word wrap: ${wrapEnabled?'on':'off'}`; }
$('wrap-toggle').addEventListener('click',()=>{wrapEnabled=!wrapEnabled;renderWrap();try{localStorage.setItem('shellify.wrap',wrapEnabled?'on':'off');}catch{}});
renderWrap();

// Small screens show one full-size pane without discarding any working state.
const compactLayout=window.matchMedia('(max-width: 1100px)');
let activePane=sharedProject?'configure':'discover';
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
// Query controls use catalog schemas; every change still goes through generation validation.
$('steps').addEventListener('input',e=>{
  const input=e.target.closest('[data-result-field],[data-result],[data-filter],[data-condition],[data-step-parameter]');if(!input)return;
  const step=steps.find(s=>s.id===input.closest('[data-step]').dataset.step),action=commands.find(c=>c.id===step.actionId);
  if(input.type==='checkbox'||editingInput!==input){remember();editingInput=input;}
  let rerender=false;
  if(input.hasAttribute('data-result-field')){step.results=settingsFor(action,step);step.results.fields=input.checked?[...step.results.fields,input.dataset.resultField]:step.results.fields.filter(f=>f!==input.dataset.resultField);}
  else if(input.hasAttribute('data-result')){step.results=settingsFor(action,step);step.results[input.dataset.result]=input.type==='checkbox'?input.checked:input.value;}
  else if(input.hasAttribute('data-filter')){step.results=settingsFor(action,step);const filter=step.results.filters[Number(input.closest('[data-filter-index]').dataset.filterIndex)];filter[input.dataset.filter]=input.value;if(input.dataset.filter==='field'){filter.operator=operators(schemaFor(action,step.values).fields.find(f=>f.name===input.value).type)[0];rerender=true;}}
  else if(input.hasAttribute('data-condition')){step.condition||={type:'none'};step.condition[input.dataset.condition]=input.value;delete step.condition.sourceStep;rerender=true;}
  else {const field=input.closest('[data-parameter-field]').dataset.parameterField;step.parameterFields||={};step.parameterFields[field]||={enabled:false,name:({host:'ComputerName',computer:'RemoteComputer',service:'ServiceName',path:'FolderPath',identity:'AccountIdentity',group:'GroupName',server:'ServerName',adapter:'AdapterName'}[field]||field[0].toUpperCase()+field.slice(1)),required:true};step.parameterFields[field][input.dataset.stepParameter]=input.type==='checkbox'?input.checked:input.value;rerender=input.dataset.stepParameter==='enabled';}
  if(rerender)renderSteps();else{renderPreview();persist();}
});
$('steps').addEventListener('click',e=>{const b=e.target.closest('[data-add-filter],[data-remove-filter]');if(!b)return;const step=steps.find(s=>s.id===b.closest('[data-step]').dataset.step),action=commands.find(c=>c.id===step.actionId);remember();step.results=settingsFor(action,step);if(b.hasAttribute('data-add-filter')&&step.results.filters.length<6){const field=schemaFor(action,step.values).fields[0];step.results.filters.push({field:field.name,operator:operators(field.type)[0],value:''});}else if(b.hasAttribute('data-remove-filter'))step.results.filters.splice(Number(b.dataset.removeFilter),1);renderSteps();document.querySelector(`[data-step="${step.id}"] .result-controls`).open=true;});
$('export-mode').addEventListener('change',()=>{remember();workspace.exportMode=$('export-mode').value;renderSharedInputs();renderSteps();});
$('shared-input-list').addEventListener('input',e=>{const input=e.target.closest('[data-shared-parameter]');if(!input)return;const item=workspace.sharedInputs.find(i=>i.id===input.closest('[data-shared-id]').dataset.sharedId);if(input.type==='checkbox'||editingInput!==input){remember();editingInput=input;}item.parameter||={enabled:false,name:'Input'+(workspace.sharedInputs.indexOf(item)+1),required:true};item.parameter[input.dataset.sharedParameter]=input.type==='checkbox'?input.checked:input.value;if(input.dataset.sharedParameter==='enabled')renderSharedInputs();renderPreview();persist();});
$('review-content').addEventListener('click',e=>{const b=e.target.closest('[data-review-step]');if(!b)return;const step=steps[Number(b.dataset.reviewStep)];if(!step)return;$('script-review').close();steps.forEach(s=>s.collapsed=s.id!==step.id);renderSteps();showPane('configure');const card=document.querySelector(`[data-step="${step.id}"]`);card.scrollIntoView({block:'start'});card.querySelector('input:not(:disabled),select:not(:disabled),button')?.focus();});
let compactCatalog=true;try{compactCatalog=localStorage.getItem('shellify.catalog-view')!=='expanded';}catch{}
function renderCatalogView(){document.querySelector('#catalog').classList.toggle('compact-catalog',compactCatalog);$('catalog-view').setAttribute('aria-pressed',String(compactCatalog));$('catalog-view').setAttribute('aria-label',compactCatalog?'Show descriptive catalog':'Show compact catalog');}
$('catalog-view').addEventListener('click',()=>{compactCatalog=!compactCatalog;renderCatalogView();try{localStorage.setItem('shellify.catalog-view',compactCatalog?'compact':'expanded');}catch{}});renderCatalogView();
const layout={catalog:25,preview:45};try{const stored=JSON.parse(localStorage.getItem('shellify.panel-widths')||'{}');if(stored.catalog>=16&&stored.catalog<=30)layout.catalog=stored.catalog;if(stored.preview>=25&&stored.preview<=50)layout.preview=stored.preview;}catch{}
function renderLayout(){const grid=document.querySelector('.workspace');grid.style.setProperty('--catalog-width',layout.catalog+'fr');grid.style.setProperty('--catalog-percent',layout.catalog/100);grid.style.setProperty('--preview-percent',layout.preview/100);grid.style.setProperty('--configure-width',(100-layout.catalog-layout.preview)+'fr');grid.style.setProperty('--preview-width',layout.preview+'fr');document.querySelectorAll('[data-divider]').forEach(d=>d.setAttribute('aria-valuenow',layout[d.dataset.divider]));}
function saveLayout(){try{localStorage.setItem('shellify.panel-widths',JSON.stringify(layout));}catch{}}
for(const key of ['catalog','preview']){const divider=document.createElement('div');divider.className='panel-divider '+key;divider.dataset.divider=key;divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-label',key==='catalog'?'Catalog width':'Preview width');divider.setAttribute('aria-valuemin',key==='catalog'?16:25);divider.setAttribute('aria-valuemax',key==='catalog'?30:50);divider.title='Drag to resize · Arrow keys to adjust · Double-click to reset';document.querySelector('.workspace').append(divider);
  divider.addEventListener('pointerdown',e=>{e.preventDefault();divider.setPointerCapture(e.pointerId);const start=e.clientX,initial=layout[key],width=document.querySelector('.workspace').getBoundingClientRect().width;const move=event=>{layout[key]=Math.max(key==='catalog'?16:25,Math.min(key==='catalog'?30:50,initial+(event.clientX-start)/width*100*(key==='catalog'?1:-1)));renderLayout();};divider.addEventListener('pointermove',move);const stop=()=>{divider.removeEventListener('pointermove',move);saveLayout();};divider.addEventListener('pointerup',stop,{once:true});divider.addEventListener('pointercancel',stop,{once:true});});
  divider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();layout[key]=e.key==='Home'?(key==='catalog'?25:45):Math.max(key==='catalog'?16:25,Math.min(key==='catalog'?30:50,layout[key]+(e.key==='ArrowRight'?1:-1)*(key==='catalog'?1:-1)));renderLayout();saveLayout();});divider.addEventListener('dblclick',()=>{layout.catalog=25;layout.preview=45;renderLayout();saveLayout();});}
renderLayout();
// Homepage workflow links insert into the current draft and remain undoable.
const entry=new URLSearchParams(location.search),workflowEntry=entry.get('workflow');if(workflows.some(w=>w.id===workflowEntry)){addWorkflow(workflowEntry);window.history.replaceState(null,'',location.pathname);}else if(entry.get('category')){category=commands.some(c=>c.category===entry.get('category'))?entry.get('category'):'All commands';renderCategories();renderCatalog();}

$('add-step').addEventListener('click',()=>{showPane('discover');$('search').focus();});

$('next-steps').addEventListener('click',e=>{const b=e.target.closest('[data-next]');if(!b)return;const action=commands.find(c=>c.id===b.dataset.next);if(steps.length>=200){toast('A script can contain up to 200 steps.');return;}remember();steps.forEach(s=>s.collapsed=true);const step=createStep(action.id);steps.push(step);renderSteps();document.querySelector(`[data-step="${step.id}"]`).scrollIntoView({block:'nearest'});});
for(const [id,key] of [['dry-run','dryRun'],['reachable-only','reachableOnly'],['fleet-targets','targets']])$(id).addEventListener('input',e=>{
  if(id==='dry-run'&&!e.target.checked&&steps.some(s=>s.groupId)){
    const after=cloneCurrentWorkspace();after.dryRun=false;
    if(planBehaviorChange({...workspace,steps},after,'Review script-wide dry run',steps.map(s=>s.id)).requiresAcknowledgement){e.target.checked=workspace.dryRun;stageBehaviorChange(after,'Review script-wide dry run',steps.map(s=>s.id));return;}
  }
  remember();workspace[key]=id==='fleet-targets'?e.target.value.split(/[,\r\n]+/).map(s=>s.trim()).filter(Boolean):e.target.checked;renderPreview();persist();
});

document.addEventListener('click',async e=>{const example=e.target.closest('[data-search-example]');if(example){$('search').value=example.dataset.searchExample;renderCatalog();$('search').focus();}if(e.target.closest('[data-reset-search]')){category='All commands';collection='all';$('search').value='';renderCategories();renderCatalog();}const workflow=e.target.closest('[data-search-workflow]');if(workflow)addWorkflow(workflow.dataset.searchWorkflow);if(e.target.closest('[data-copy-search]')){try{await navigator.clipboard.writeText($('search').value);toast('Search copied. Nothing was sent.');}catch{toast('Clipboard unavailable; select and copy your search.');}}if(e.target.closest('[data-add],[data-search-workflow]')){const query=$('search').value.trim();if(query){searchHistory=[query,...searchHistory.filter(s=>s!==query)].slice(0,8);try{localStorage.setItem('shellify.searches',JSON.stringify(searchHistory));}catch{}}}});
$('search').addEventListener('keydown',e=>{const results=[...$('results').querySelectorAll('[data-add],[data-search-workflow]')];if(e.key==='Escape'){e.preventDefault();$('search').value='';renderCatalog();return;}if(['ArrowDown','ArrowUp'].includes(e.key)&&results.length){e.preventDefault();activeResult=(activeResult+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;results.forEach((b,i)=>b.classList.toggle('keyboard-active',i===activeResult));$('search').setAttribute('aria-activedescendant',results[activeResult].id);results[activeResult].scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&results.length){e.preventDefault();searchAddExpanded=e.shiftKey;try{results[Math.max(0,activeResult)].click();}finally{searchAddExpanded=true;}}});
$('steps').addEventListener('click',e=>{const button=e.target.closest('[data-group-collapse],[data-group-remove],[data-group-move]');if(!button)return;const id=button.closest('[data-workflow-group]').dataset.workflowGroup,group=workspace.groups.find(g=>g.id===id);if(button.hasAttribute('data-group-collapse')){group.collapsed=!group.collapsed;renderSteps();return;}remember();const members=steps.filter(s=>s.groupId===id),start=steps.findIndex(s=>s.groupId===id);if(button.hasAttribute('data-group-remove')){steps=steps.filter(s=>s.groupId!==id);workspace.steps=steps;workspace.groups=workspace.groups.filter(g=>g.id!==id);}else{const direction=Number(button.dataset.groupMove),neighbor=steps[direction<0?start-1:start+members.length];if(!neighbor)return;const adjacent=neighbor.groupId?steps.filter(s=>s.groupId===neighbor.groupId):[neighbor],index=direction<0?start-adjacent.length:start;steps.splice(index,members.length+adjacent.length,...(direction<0?[...members,...adjacent]:[...adjacent,...members]));}renderSteps();});
document.querySelectorAll('.settings-popover button').forEach(b=>b.addEventListener('click',()=>document.querySelector('.settings-menu').open=false));
document.querySelectorAll('[data-starter]').forEach(b=>b.addEventListener('click',()=>{category='All commands';collection='all';$('search').value='';renderCategories();renderCatalog();document.querySelector(`[data-add="${b.dataset.starter}"]`).click();}));
document.addEventListener('click',e=>{document.querySelectorAll('.settings-menu[open],.step-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.settings-menu[open],.step-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});});
$('steps').addEventListener('click',e=>{const header=e.target.closest('[data-header]');if(header&&!e.target.closest('button'))header.querySelector('[data-collapse]').click();});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){e.preventDefault();showPane('discover');$('search').focus();$('search').select();}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){const card=document.activeElement.closest('[data-step]');if(!card)return;const selector=e.key.toLowerCase()==='d'?'[data-duplicate]':e.key==='ArrowUp'?'[data-move="-1"]':e.key==='ArrowDown'?'[data-move="1"]':null;if(selector){e.preventDefault();card.querySelector(selector).click();}}});

// Pasting a share URL into this same tab can navigate only the fragment.
window.addEventListener('hashchange',async()=>{
  const hash=location.hash;if(!hash)return;
  try{
    const imported=await restoreShareHash(hash);
    if(location.hash!==hash)return;
    clearShareHash();remember();workspace=imported;syncWorkspace();$('script-library').close();showPane('configure');
    toast('Shared project opened. Use Undo to restore your previous draft.');
  }catch(error){
    if(location.hash!==hash)return;
    clearShareHash();$('project-error').textContent=error.message;$('script-library').showModal();
  }
});
$('fix-incomplete').addEventListener('click',e=>{
  const id=e.currentTarget.dataset.target;if(id){pristineSteps.delete(id);focusBenchStep(id);}else $('review-script').click();
});
$('code').addEventListener('click',e=>{const line=e.target.closest('[data-code-step]');if(line)focusBenchStep(line.dataset.codeStep);});
$('locate-code').addEventListener('click',()=>{const line=document.querySelector('.selected-code');if(line)line.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
let inspectedCommand=null;
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-inspect]');if(!button)return;
  inspectedCommand={id:button.dataset.inspect,kind:button.dataset.kind};
  const item=inspectedCommand.kind==='workflow'?workflows.find(w=>w.id===inspectedCommand.id):commands.find(c=>c.id===inspectedCommand.id);
  $('command-detail-title').textContent=item.name;$('command-detail-description').textContent=item.description;
  $('command-detail-cmdlet').textContent=item.cmdlets||'Multi-step workflow';
  $('command-detail-impact').textContent=safetyLabel(searchIndex.find(entry=>entry.item.id===item.id&&entry.item.kind===inspectedCommand.kind)?.item||item);
  $('command-detail-requirements').textContent=item.requirements||'Configure shared workflow inputs before adding its steps.';
  $('command-details').showModal();
});
$('close-command-details').addEventListener('click',()=>$('command-details').close());
$('add-inspected-command').addEventListener('click',()=>{
  $('command-details').close();
  document.querySelector(inspectedCommand.kind==='workflow'?'[data-search-workflow="'+inspectedCommand.id+'"]':'[data-add="'+inspectedCommand.id+'"]')?.click();
});
