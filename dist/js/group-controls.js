import {commands} from './commands.js';
import {stepSummary} from './workspace.js';
import {resolveStep} from './execution.js';
import {sourceValues,sourceScopeText,resultSourceIndex,hasResultSource} from './composition.js';
import {parameterDefinitions} from './parameters.js';
import {effectiveStep,effectiveWorkspace,behaviorOrigin,behaviorCapabilities} from './group-behavior.js';
import {escape} from './builder-controls.js';
const labels={whatIf:'WhatIf',confirm:'Confirmation',verbose:'Verbose evidence',onError:'Failure handling',computer:'Computer target'};
export function renderBehaviorOrigin(step,key,workspace){
  const origin=behaviorOrigin(step,key,workspace);
  return `<div class="behavior-origin" data-behavior-origin="${key}"><span>${escape(labels[key])}: ${origin}${origin==='Group default'?' · Editing creates a step override':''}</span><button class="text-button" data-reset-behavior="${key}" ${step.behaviorOverrides?.[key]?'':'hidden'}>Reset ${escape(labels[key])} to inherited value</button></div>`;
}
export function renderEffectiveBehaviorContent(step,workspace){
  const action=commands.find(c=>c.id===step.actionId),eff=effectiveStep(step,workspace),keys=['whatIf','confirm','verbose'].filter(k=>action.parameters.some(p=>p.name===k));
  return `${keys.map(key=>`<p>${labels[key]}: <strong>${eff.values[key]?'On':'Off'}</strong> · ${behaviorOrigin(step,key,workspace)}</p>`).join('')}<p>Failure handling: <strong>${eff.onError==='continue'?'Record error and continue':'Stop on error'}</strong> · ${behaviorOrigin(step,'onError',workspace)}</p>${behaviorCapabilities(step,workspace).map(note=>`<p>${escape(note)}</p>`).join('')}<p>Execution summaries distinguish Succeeded, Failed and Skipped; these describe command attempts, not machine health.</p>`;
}
export const renderEffectiveBehavior=(step,workspace)=>`<details class="effective-behavior"><summary>Effective behavior & overrides</summary><div data-effective-behavior-content>${renderEffectiveBehaviorContent(step,workspace)}</div></details>`;
function configuredScope(id,workspace){
  const index=workspace.steps.findIndex(s=>s.id===id),step=workspace.steps[index],resolved=resolveStep(effectiveStep(step,workspace),workspace.sharedInputs);
  for(const definition of parameterDefinitions(effectiveWorkspace(workspace)))for(const use of definition.uses)if(use.index===index)resolved.values[use.field]='Runtime parameter: '+definition.name;
  const summary=stepSummary({...resolved,values:sourceValues(resolved)});
  return summary+(hasResultSource(step)?'. '+sourceScopeText(workspace.steps[resultSourceIndex(step,workspace.steps)],workspace)+' Affected count: determined when the script runs.':'');
}
export function renderProposal(proposal,workspace){
  const show=value=>value===undefined?'Not supported':typeof value==='boolean'?(value?'On':'Off'):String(value);
  const effects=proposal.after.steps.filter(s=>s.actionId==='report'||s.output?.format&&s.output.format!=='none');
  return `<p>Review the effective settings before applying. This changes generated scripts; nothing executes here.</p>${proposal.rows.map(row=>`<section class="behavior-review-step"><h3>Step ${row.index}: ${escape(row.title)}</h3><p>Configured input: ${escape(configuredScope(row.id,proposal.after))}</p>${Object.keys(labels).filter(key=>row.before[key]!==undefined||row.after[key]!==undefined).map(key=>`<p><strong>${labels[key]}</strong>: ${escape(show(row.before[key]))}${row.changed.includes(key)?` → <strong>${escape(show(row.after[key]))}</strong>`:' · unchanged'}</p>`).join('')}<p>Retained step overrides: ${row.retained.length?row.retained.map(key=>labels[key]).join(', '):'None'}</p>${row.notes.map(note=>`<p class="capability-note">${escape(note)}</p>`).join('')}${row.requiresAcknowledgement?'<p class="risk-note">This step permits live changes or removes confirmation compared with its current effective settings.</p>':''}</section>`).join('')}${proposal.errors.length?`<div class="risk-note"><strong>Configuration remains blocked</strong><ul>${proposal.errors.map(error=>`<li>${escape(error)}</li>`).join('')}</ul><p>Applying preserves this configuration for repair. Copy and download remain disabled.</p></div>`:''}<h3>Evidence & results</h3><p>File-writing steps: ${effects.length}. Existing report paths and per-step exports are retained. Files require writable folders and retain their no-overwrite behavior.</p><p>Transcript: ${workspace.logging?.enabled?escape(workspace.logging.path):'Off'} · script-wide. Execution summary: ${workspace.executionSummary?'On':'Off'} · script-wide. Fleet targets: ${workspace.targets?.length||0} · script-wide. Presets do not change these settings.</p>`;
}
