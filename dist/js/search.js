// Offline, deterministic weighted search. Query strings never become regular expressions.
const filler=new Set('a an the i how do does can want to in on of than days please my get find show list check test for is me'.split(' '));
const groups=[['signin','login','logon'],['restart','reboot','bounce'],['stop','kill','end','terminate'],['slow','lag','laggy','sluggish','hang','freeze'],['stale','inactive','old','unused','dormant'],['locked','lockout'],['computer','pc','machine','server','host','workstation'],['user','account','employee','staff'],['permission','access','rights','acl'],['delete','remove','purge']];
const synonyms=new Map(groups.flatMap(g=>g.map(w=>[w,g.filter(x=>x!==w)])));
export function normalize(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').toLowerCase().replace(/sign[ -]in/g,'signin').replace(/[^a-z0-9:-]+/g,' ').trim().replace(/\s+/g,' ');}
function stem(t){if(t==='services')return 'service';if(t==='certificates')return 'certificate';if(['restarting','restarted','restarts'].includes(t))return 'restart';if(t==='locked')return 'locked';return t.length>5&&t.endsWith('ies')?t.slice(0,-3)+'y':t.length>4&&t.endsWith('s')&&!t.endsWith('ss')?t.slice(0,-1):t;}
function words(s){const n=normalize(s);return [...new Set([n.replaceAll('-',''),...n.split(/\s+/),...n.replace(/-/g,' ').split(/\s+/)].filter(Boolean).map(stem))];}
export function distance(a,b){if(Math.abs(a.length-b.length)>2)return 3;let previous=null,row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++){next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));if(previous&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])next[j]=Math.min(next[j],previous[j-2]+1);}previous=row;row=next;}return row[b.length];}
const weights={title:12,cmdlet:10,alias:9,identifier:9,category:4,description:2,parameter:2};
export function buildIndex(commands,workflows=[]){return [...commands.map(c=>({...c,kind:'command'})),...workflows.map(w=>({...w,kind:'workflow',category:'Workflows',riskTier:w.actions.some(id=>commands.find(c=>c.id===id)?.riskTier==='disruptive')?'disruptive':w.actions.some(id=>commands.find(c=>c.id===id)?.risk==='modify')?'modify':'read',versions:['5.1','7'],outputType:'records',parameters:[],dependencies:[...new Set(w.actions.flatMap(id=>commands.find(c=>c.id===id)?.dependencies||[]))]}))].map(item=>{const fields={title:[item.name],cmdlet:[item.cmdlets||''],alias:item.keywords||[],identifier:(item.keywords||[]).filter(t=>/\d/.test(t)),category:[item.category,...(item.tags||[])],description:[item.description],parameter:(item.parameters||[]).flatMap(p=>[p.label,p.flag||'',p.help])};return {item,fields:Object.entries(fields).map(([name,values])=>({name,weight:weights[name],phrases:values.map(normalize),tokens:[...new Set(values.flatMap(words))]}))};});}
function parse(query){const filters=[],phrases=[];const source=String(query).replace(/"([^"]+)"/g,(_,p)=>{phrases.push(normalize(p));return ' ';}).replace(/\b(cat|is|fav|needs|ps|takes|makes):([^\s]*)/gi,(_,key,value)=>{filters.push([key.toLowerCase(),value.toLowerCase()]);return ' ';});const n=normalize(source),tokens=words(n).filter(t=>!t.includes(' ')&&!filler.has(t));return {filters,phrases,n,tokens:tokens.filter(t=>!/^\d+$/.test(t)||!/(older|hours|days|than)/i.test(query))};}
function accepts(item,filters,context){return filters.every(([key,value])=>{switch(key){case 'cat':return value==='ad'?item.category==='Active Directory':normalize(item.category).includes(normalize(value));case 'is':return value==='readonly'?item.riskTier==='read':value==='modifies'?['modify','disruptive'].includes(item.riskTier):value==='disruptive'?item.riskTier==='disruptive':false;case 'fav':return (context.favorites||[]).includes(item.id);case 'needs':return value==='admin'?item.admin===true:(item.dependencies||[]).some(m=>m.toLowerCase().includes(value));case 'ps':return item.versions?.includes(value);case 'takes':return item.accepts?.includes(value);case 'makes':return item.outputType===value;default:return false;}});}
function tokenScore(token,field){
  if(token.startsWith('-'))return field.name==='parameter'&&field.tokens.includes(token)?{value:field.weight*5,term:token,tier:'flag'}:null;
  if(field.tokens.includes(token))return {value:field.weight*4,term:token,tier:'exact'};
  if(/^\d+$/.test(token))return null;
  let best=null;for(const term of field.tokens){if(term.length>=token.length&&token.length>=3&&term.startsWith(token))best={value:field.weight*2.8,term,tier:'prefix'};if(synonyms.get(token)?.includes(term)&&(!best||best.value<field.weight*2.4))best={value:field.weight*2.4,term,tier:'synonym'};const max=token.length>=8?2:token.length>=4?1:0;if(max&&distance(token,term)<=max&&(!best||best.value<field.weight*1.7))best={value:field.weight*1.7,term,tier:'typo'};}return best;
}
export function search(index,query,context={}){
  const q=parse(query),results=[],suggestions=[];
  for(const doc of index){const {item,fields}=doc;if(!accepts(item,q.filters,context))continue;if(q.phrases.some(p=>!fields.some(f=>f.phrases.some(text=>text.includes(p)))))continue;
    if(q.tokens.some(t=>['delete','install','stop','kill','terminate','purge'].includes(t)&&!words(item.name).includes(t)))continue;
    if(!q.tokens.length&&!q.phrases.length&&!q.filters.length){results.push({item,score:0,reason:'Browse catalog',matches:[],scores:[]});continue;}
    const scores=q.tokens.map(token=>{let best=null;for(const f of fields){const hit=tokenScore(token,f);if(hit&&(!best||hit.value>best.value))best={...hit,field:f.name,token};}return best;});
    const hits=scores.filter(Boolean);if(q.tokens.length&&!hits.length)continue;
    const full=hits.length===q.tokens.length&&(item.kind!=='workflow'||hits.every(h=>['title','alias'].includes(h.field))),exactTitle=fields[0].phrases.includes(q.n)||q.phrases.some(p=>fields[0].phrases.includes(p));
    const meaningful=q.n.split(' ').filter(t=>!filler.has(t)).join(' ');
    const phrase=fields.find(f=>['title','alias','cmdlet'].includes(f.name)&&(f.phrases.includes(q.n)||meaningful&&f.phrases.includes(meaningful))&&q.n);
    let score=hits.reduce((sum,h)=>sum+h.value,0)+(phrase?80:0)+(exactTitle?30:0)+(q.tokens.some(t=>t.startsWith('-'))||fields.find(f=>f.name==='cmdlet').phrases.includes(q.n)?item.searchPriority||0:0);
    score+=(context.favorites||[]).includes(item.id)?3:0;score+=(context.recent||[]).includes(item.id)?2:0;score+=item.essentials?1:0;score+=context.category===item.category?1:0;score+=item.accepts?.includes(context.previousOutput)?2:0;
    const best=hits.find(h=>h.tier==='typo')||hits.find(h=>h.tier==='synonym')||hits[0];
    const reason=phrase?`Matched ${phrase.name}: ${q.n}`:best?`${best.tier==='typo'?'Near match':best.tier==='synonym'?'Related term':'Matched '+best.field}: ${best.term}`:'Matched filters';
    const entry={item,score,exactTitle,reason,matches:hits.map(h=>h.term),scores:hits};(full?results:suggestions).push(entry);
  }
  const order=(a,b)=>b.score-a.score||Number(b.exactTitle)-Number(a.exactTitle)||a.item.name.length-b.item.name.length||(a.item.name<b.item.name?-1:a.item.name>b.item.name?1:0);
  if(q.n||q.filters.length||q.phrases.length)results.sort(order);suggestions.sort(order);
  return {results,workflows:results.filter(r=>r.item.kind==='workflow'),commands:results.filter(r=>r.item.kind==='command'),suggestions:suggestions.slice(0,3)};
}
