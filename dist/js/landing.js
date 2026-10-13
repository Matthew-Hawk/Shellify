import {commands,defaults} from './commands.js';
// Preserve bookmarks to the original single-page builder.
if(['#builder','#catalog'].includes(location.hash))location.replace('builder.html'+location.hash);
const examples={services:{request:'“Show me my Windows services.”',detail:'Service names and current status'},files:{request:'“List the files in this folder.”',detail:'Literal paths · Optional subfolders'},'ad-user':{request:'“Look up an Active Directory user.”',detail:'Directory lookup · RSAT required'}};
let selected='services',view='guided';
function renderExample(){
  const action=commands.find(action=>action.id===selected),example=examples[selected];
  document.getElementById('example-request').textContent=example.request;
  document.getElementById('example-name').textContent=action.name;
  document.getElementById('example-detail').textContent=example.detail;
  document.getElementById('hero-code').textContent=(view==='guided'?`# ${action.name}\n`:'')+action.generate(defaults(action)).replace(/\|\n\s+/g,'| ');
  document.querySelectorAll('[data-example]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.example===selected)));
  document.querySelectorAll('[data-demo-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.demoView===view)));
}
for(const button of document.querySelectorAll('[data-example]'))button.addEventListener('click',()=>{selected=button.dataset.example;renderExample();});
for(const button of document.querySelectorAll('[data-demo-view]'))button.addEventListener('click',()=>{view=button.dataset.demoView;renderExample();});
renderExample();
// Pause decorative work outside the viewport; all product text stays visible.
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('motion-offscreen',!entry.isIntersecting);},{rootMargin:'100px'});document.querySelectorAll('[data-motion]').forEach(element=>observer.observe(element));}
