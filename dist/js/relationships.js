// IDs are canonical. Index references are accepted only when reading legacy data.
export const resultSourceIndex=(step,steps)=>step.inputSourceId!==undefined?steps.findIndex(s=>s.id===step.inputSourceId):(step.inputStep??-1);
export const conditionSourceIndex=(step,steps)=>step.condition?.sourceId!==undefined?steps.findIndex(s=>s.id===step.condition.sourceId):(step.condition?.sourceStep??-1);
export const hasResultSource=step=>step.inputSourceId!==undefined||(step.inputStep!==undefined&&step.inputStep!==-1);
export function remapRelationships(originals,restored){
  originals.forEach((old,i)=>{
    const step=restored[i],source=resultSourceIndex(old,originals),guard=conditionSourceIndex(old,originals);
    delete step.inputStep;
    if(hasResultSource(old))step.inputSourceId=restored[source]?.id||old.inputSourceId||'missing-source';
    else delete step.inputSourceId;
    if(step.condition?.type==='connectivity')step.condition={type:'connectivity',sourceId:restored[guard]?.id||old.condition?.sourceId||'missing-source'};
    else if(step.condition)delete step.condition.sourceStep;
    if(old.scopeAcknowledgement&&typeof old.scopeAcknowledgement.signature==='string'&&old.scopeAcknowledgement.signature.length<=30000){
      const acknowledged=originals.findIndex(s=>s.id===old.scopeAcknowledgement.sourceId);
      step.scopeAcknowledgement={sourceId:restored[acknowledged]?.id||old.scopeAcknowledgement.sourceId,signature:old.scopeAcknowledgement.signature};
    }
  });
  return restored;
}
export function portableSteps(steps){return remapRelationships(steps,steps.map(s=>({...JSON.parse(JSON.stringify(s)),id:crypto.randomUUID()})));}
