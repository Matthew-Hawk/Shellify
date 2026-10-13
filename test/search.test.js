import test from 'node:test';
import assert from 'node:assert/strict';
import {commands} from '../dist/js/commands.js';
import {workflows} from '../dist/js/workspace.js';
import {buildIndex,search} from '../dist/js/search.js';
import {searchIndex} from '../dist/js/search-index.js';
const index=buildIndex(commands,workflows);
// Each base expectation is editorially curated; variants exercise normalization and filler removal.
const golden=[
['uptime','uptime'],['last boot','uptime'],['pending reboot','pending-reboot'],['restart required','pending-reboot'],
['disk health','disk-health'],['automatic services stopped','auto-services'],['recent errors','event-errors'],
['4625','failed-logins'],['failed login','failed-logins'],['41','shutdown-events'],['1102','cleared-logs'],
['4740','lockout-events'],['3389','tcp-port'],['port 3389','tcp-port'],['expiring certificates','certificates'],
['ssl','certificates'],['largest files','largest-files'],['failing tasks','failing-tasks'],['clock wrong','time-sync'],
['ntp','time-sync'],['password expires','password-expiry'],['installed patches','hotfix'],['disk full','disk'],
['out of space','disk'],['get-aduser','ad-user'],['aduser','ad-user'],['ad user','ad-user'],
['restrat servce','restart'],['restart service','restart'],['-force','files']
];
test('150 golden queries retain expected top-1 and top-3 commands',()=>{
  const failures=[];for(const [query,expected] of golden)for(const variant of [query,`  ${query}  `,query.toUpperCase(),`please ${query}`,`how do I ${query}`]){const result=search(index,variant).commands.map(r=>r.item.id);if(result[0]!==expected||!result.slice(0,3).includes(expected))failures.push({variant,expected,actual:result.slice(0,3)});}
  assert.deepEqual(failures,[]);
});
test('filters, phrases, identifier precision and unsupported actions remain explicit',()=>{
  assert.equal(search(index,'whos logged in').commands[0].item.id,'signed-in');
  assert.ok(search(index,'cat:ad is:readonly makes:users').commands.every(r=>r.item.category==='Active Directory'&&r.item.risk==='read'&&r.item.outputType==='users'));
  assert.deepEqual(search(index,'fav:',{favorites:['disk']}).commands.map(r=>r.item.id),['disk']);
  assert.equal(search(index,'"pending reboot"').commands[0].item.id,'pending-reboot');
  assert.equal(search(index,'needs:admin').commands.some(r=>r.item.id==='failed-logins'),true);
  assert.equal(search(index,'takes:services').commands[0].item.id,'start-service');
  assert.equal(search(index,'is:disruptive').commands[0].item.id,'restart');
  for(const query of ['4626','banana','delete old files','stop service','install software'])assert.equal(search(index,query).commands.length,0,query);
  assert.ok(search(index,'port banana').suggestions.length);
});
test('ranking and explanations are stable and the generated index is current',()=>{
  assert.equal(JSON.stringify(index),JSON.stringify(searchIndex),'Run npm run build after catalog changes');
  const first=search(index,'restrat servce');assert.deepEqual(first,search(index,'restrat servce'));assert.match(first.commands[0].reason,/Near match/);
  assert.ok(search(index,'certificate expiry sweep').workflows.some(r=>r.item.id==='certificate-sweep'));
});
