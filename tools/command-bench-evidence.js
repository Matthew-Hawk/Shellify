// Isolated browser evidence; never uses the user's browser profile or runs PowerShell.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'phase1';
const dir=`docs/evidence/command-bench/${phase}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
const evidence={phase,viewports:[],errors:[]};
const pane=async(page,name)=>{const tab=page.locator('#tab-'+name);if(await tab.isVisible())await tab.click();};
try{
for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4179'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:4179/');
  await page.screenshot({path:`${dir}/${name}-landing.png`});
  await page.locator('a[href="builder.html?workflow=health"]').click();
  await page.locator('[data-step]').first().waitFor();
  await pane(page,'configure');
  await page.locator('[data-remove]').first().click(); // Remove the default disk step; retain the four-step health recipe.
  for(const button of await page.locator('[data-collapse][aria-expanded="true"]').all())await button.click();
  assert.equal(await page.locator('[data-step]').count(),4);
  await expect(page.locator('.toast')).toBeHidden();
  await page.screenshot({path:`${dir}/${name}-four-steps.png`});
  evidence.viewports.push({name,width,height,stepHeights:await page.locator('[data-step]').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height)),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  await pane(page,'discover');await page.locator('#search').fill('Start a stopped service');await page.locator('[data-add="start-service"]').click();
  await pane(page,'preview');assert.equal(await page.locator('#preview-stale').isVisible(),true);assert.equal(await page.locator('#download').isDisabled(),true);
  await page.screenshot({path:`${dir}/${name}-stale.png`});
  await page.locator('#fix-incomplete').click();await page.locator('[data-param="service"]').fill('Spooler');
  await pane(page,'preview');assert.equal(await page.locator('#download').isEnabled(),true);
  await page.screenshot({path:`${dir}/${name}-recovered.png`});
  // Reproduce a typed handoff and a grouped recipe in the same disposable draft.
  await pane(page,'discover');await page.locator('#search').fill('automatic services stopped');await page.locator('[data-add="auto-services"]').click();await page.locator('[data-next="start-service"]').click();
  await pane(page,'configure');await page.locator('[data-value-source=service]').last().selectOption({label:'Earlier results: step 6 — Find automatic services that are stopped'});await page.locator('[data-acknowledge-scope]').check();
  await page.screenshot({path:`${dir}/${name}-service-source.png`});
  await pane(page,'discover');await page.locator('#search').fill('locked out user');await page.locator('[data-search-workflow="locked-triage"]').click();await page.locator('#workflow-identity').fill('testuser');await page.locator('#workflow-server').fill('dc01');await page.locator('#workflow-input-form button[type="submit"]').click();
  await pane(page,'configure');await page.locator('[data-group-collapse]').last().click();await page.screenshot({path:`${dir}/${name}-group.png`});
  for(const [dialog,trigger] of [['script-library','library-button'],['guide','guide-button']]){
    await page.locator('#'+trigger).click();await page.locator('#'+dialog).evaluate(n=>n.scrollTop=n.scrollHeight);await page.screenshot({path:`${dir}/${name}-${dialog}-scrolled.png`});await page.keyboard.press('Escape');assert.equal(await page.locator('#'+trigger).evaluate(n=>n===document.activeElement),true);
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  const motion=page.locator('#motion-toggle');await expect(motion).toHaveAttribute('aria-pressed','true');
  assert.notEqual(await page.locator('.builder-dot').first().evaluate(n=>getComputedStyle(n).animationName),'none');
  await motion.click();assert.equal(await motion.getAttribute('aria-pressed'),'false');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.builder-dot').first().evaluate(n=>getComputedStyle(n).animationName),'none');
  await context.close();
}
assert.deepEqual(evidence.errors,[]);
await writeFile(`${dir}/metrics.json`,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence));
}finally{await browser.close();}
