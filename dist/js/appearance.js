const button=document.getElementById('motion-toggle');
const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
let enabled=!preference.matches;
function render(){document.body.classList.toggle('motion-paused',!enabled);button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Pause background motion':'Enable background motion');button.textContent=enabled?'◌ Motion on':'◌ Motion off';}
button.addEventListener('click',()=>{enabled=!enabled;render();});
preference.addEventListener('change',()=>{enabled=!preference.matches;render();});
render();
