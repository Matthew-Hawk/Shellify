const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\b(restarting|restarted)\b/g,'restart').replace(/\b(folders)\b/g,'folder').replace(/\b(file)\b/g,'files').replace(/\b(services)\b/g,'service');
const stop=new Set(['a','an','the','i','want','to','in','on','of','than','days','please','my','get','find','show','list','check','test']);
export function match(commands,query){
  const n=normalize(query);if(!n)return commands;
  const tokens=n.split(' ').filter(t=>!stop.has(t)&&!/^\d+$/.test(t));if(!tokens.length)return [];
  return commands.map(c=>{
    const phrases=[c.name,...c.keywords,...c.cmdlets.split(' · ')].map(normalize);
    const flagWords=(c.parameters||[]).filter(p=>p.flag).flatMap(p=>normalize(p.flag+' '+p.label).split(' '));
    const commandWords=phrases.flatMap(p=>p.split(' '));
    const flagMatch=tokens.some(t=>flagWords.includes(t))&&tokens.every(t=>flagWords.includes(t)||commandWords.includes(t));
    const score=Math.max(flagMatch?tokens.length:0,...phrases.map(p=>{const hits=tokens.filter(t=>p.split(' ').includes(t)).length;return hits===tokens.length?hits+(n===p?5:0):0;}));
    return {c,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.c);
}
