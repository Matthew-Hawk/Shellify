import {commands} from './commands.js';
import {bulkFields,resolveStep} from './execution.js';
import {hasResultSource,resultSourceIndex,sourceErrors,scopeErrors,scopeAcknowledged,sourceScopeText} from './composition.js';
import {escape} from './builder-controls.js';

export function renderInputSource(step,field,workspace){
  if(!['text','number'].includes(field.type))return null;
  const steps=workspace.steps,index=steps.indexOf(step),action=commands.find(c=>c.id===step.actionId),id=step.id+'-'+field.name;
  const resultField=action.id==='start-service'&&field.name==='service',result=resultField&&hasResultSource(step),shared=step.bindings?.[field.name],bulk=step.bulk?.field===field.name;
  const mode=result?'results:'+step.inputSourceId:shared?'shared:'+shared:bulk?'bulk':'custom';
  const sources=resultField?steps.slice(0,index).filter(s=>commands.find(c=>c.id===s.actionId).outputType==='services'):[];
  const currentSource=steps[resultSourceIndex(step,steps)];
  const choices=[['custom','Custom value'],...workspace.sharedInputs.map(s=>['shared:'+s.id,'Shared input: '+s.name]),...sources.map(s=>['results:'+s.id,`Earlier results: step ${steps.indexOf(s)+1} — ${commands.find(c=>c.id===s.actionId).name}`]),...(bulkFields(action).some(f=>f.name===field.name)?[['bulk','Bulk targets']]:[])];
  if(!choices.some(([value])=>value===mode))choices.push([mode,result?'Unavailable result source — repair required':'Missing shared input — repair required']);
  const picker=`<label class="field source-choice" for="${id}-source">${escape(field.label)} value source<select id="${id}-source" data-value-source="${field.name}">${choices.map(([value,label])=>`<option value="${escape(value)}" ${value===mode?'selected':''}>${escape(label)}</option>`).join('')}</select></label>`;
  if(result)return picker+`<div class="source-contract"><strong>Mapping: ${escape(currentSource?`Step ${steps.indexOf(currentSource)+1}: ${commands.find(c=>c.id===currentSource.actionId).name}`:'Missing source')} → Name → Service name</strong><p data-source-scope>${escape(sourceScopeText(currentSource,workspace))}</p><p>Affected count: determined when the script runs. No results, a skipped source, or a source failure skips this action. A source failure is reported by the source step.</p><button class="text-button" data-change-source="service">Change source</button>${currentSource?`<button class="text-button" data-edit-source="${escape(currentSource.id)}">Edit source query</button>`:''}<label class="field check"><input type="checkbox" data-acknowledge-scope ${scopeAcknowledged(step,steps,workspace)?'checked':''}><span>Use all service names returned by this source<small>I reviewed the query and target scope. Filters can still match multiple services; confirmation and WhatIf settings remain as configured.</small></span></label><p class="error" data-input-source-error>${escape([...sourceErrors(step,index,steps,workspace),...scopeErrors(step,index,steps,workspace)].join(' '))}</p></div>`;
  if(bulk)return picker+`<label class="field" for="${id}-targets">Bulk targets<textarea id="${id}-targets" data-source-targets="${field.name}" rows="3" maxlength="26000">${escape(step.bulk.targets.join('\n'))}</textarea><small>One target per line, up to 50. Results include a Target column.</small></label>`;
  if(shared)return picker+`<p class="resolved-source">${escape(field.label)}: <strong>${escape(resolveStep(step,workspace.sharedInputs).values[field.name]||'Shared value is empty or missing')}</strong><br>Read-only here. Edit the shared input to change all linked fields.</p>`;
  return {picker};
}
