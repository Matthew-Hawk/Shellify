// Values are literal strings or validated internal variable references, never executable fragments.
class PowerShellVariable{constructor(name){this.name=name;}toString(){return `$${this.name}`;}trim(){return this.toString();}}
export function targetVariable(name){if(!/^ShellifyTarget\d+$/.test(name))throw Error('Invalid internal target variable.');return new PowerShellVariable(name);}
export function parameterVariable(name){if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name))throw Error('Invalid parameter variable.');return new PowerShellVariable(name);}
export function quote(value){if(value instanceof PowerShellVariable)return value.toString();return "'"+String(value).replace(/['\u2018\u2019\u201a\u201b]/g,c=>c+c)+"'";}
export function validate(action,values){
  const errors={};
  for(const p of action.parameters){
    const v=values[p.name];
    if(p.type==='boolean'){if(typeof v!=='boolean')errors[p.name]='Choose a valid option.';continue;}
    if(p.required&&!String(v??'').trim()){errors[p.name]='Enter a value for this required field.';continue;}
    if(p.type==='select'&&!p.options.includes(v))errors[p.name]='Choose a supported option.';
    if(p.type==='number'&&(!/^\d+$/.test(String(v))||Number(v)<p.min||Number(v)>p.max))errors[p.name]=`Enter a whole number from ${p.min} to ${p.max}.`;
    if(p.type==='text'&&(typeof v!=='string'||v.length>500||/[\x00-\x1f\x7f]/.test(v)))errors[p.name]='Use up to 500 characters without line breaks or control characters.';
  }
  if(action.id==='events'&&Number(values.endHours)>=Number(values.days)*24)errors.endHours='End time must be within the look-back range.';
  if(action.id==='file-hash'&&typeof values.expected==='string'&&values.expected.trim()&&!new RegExp(`^[a-fA-F0-9]{${{SHA256:64,SHA384:96,SHA512:128}[values.algorithm]||64}}$`).test(values.expected))errors.expected='Enter a hexadecimal digest of the correct length for the selected algorithm.';
  if(action.id==='hotfix'&&typeof values.kb==='string'&&values.kb.trim()&&!/^KB[0-9]+$/i.test(values.kb))errors.kb='Use an identifier such as KB5030219.';
  return errors;
}
