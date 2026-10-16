import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const pane=async(page,name)=>{const tab=page.locator('#tab-'+name);if(await tab.isVisible())await tab.click();};
async function seed(page,group=false){
  await page.evaluate(async group=>{
    const {freshWorkspace,createStep}=await import('/js/workspace.js');const w=freshWorkspace();w.steps=['services','disk','start-service'].map(createStep);w.steps.forEach(s=>s.collapsed=true);w.steps[2].collapsed=false;w.steps[2].inputSourceId=w.steps[0].id;w.steps[2].values.whatIf=true;
    if(group){w.groups=[{id:'fixture-group',workflowId:'service-check',collapsed:true}];w.steps.forEach(s=>s.groupId='fixture-group');}
    localStorage.setItem('shellify.draft.v1',JSON.stringify(w));
  },group);await page.reload();await pane(page,'configure');
}
test.beforeEach(async({page})=>{await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/builder.html');});

test('one input source owns mapping and broad scope gates export, invalidates and recovers',async({page},info)=>{
  test.setTimeout(45000);
  const originalViewport=page.viewportSize();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await seed(page);
  await expect(page.locator('[data-step]').last().locator('[data-param=service]')).toHaveCount(0);await expect(page.locator('[data-step]').last().locator('[data-value-source=service]')).toHaveCount(1);
  await expect(page.locator('.source-contract')).toContainText('Name → Service name');await expect(page.locator('.source-contract')).toContainText('determined when the script runs');
  await expect(page.locator('#context-status')).toHaveText('Needs configuration');await pane(page,'preview');await expect(page.locator('#download')).toBeDisabled();await page.locator('#fix-incomplete').click();
  await expect(page.locator('#preview-selection')).toHaveText('Draft incomplete · No valid preview');
  await page.screenshot({path:info.outputPath('scope-unreviewed.png')});
  await page.locator('[data-acknowledge-scope]').check();await pane(page,'preview');await expect(page.locator('#download')).toBeEnabled();await expect(page.locator('#code')).toContainText('$script:ShellifyOutput1');
  await expect(page.locator('.selected-code')).not.toHaveCount(0);await page.locator('[data-view-mode=expert]').click();await expect(page.locator('.selected-code')).not.toHaveCount(0);await expect(page.locator('#code')).toContainText('Start-Service -WhatIf');await expect(page.locator('#code')).not.toContainText('SHELLIFY_BEGIN');await page.locator('[data-view-mode=guided]').click();
  await pane(page,'configure');await page.locator('[data-edit-source]').click();await page.locator('[data-param=service]').fill('Spooler');
  await expect(page.locator('#context-status')).toHaveText('Needs configuration');
  await page.getByRole('button',{name:/^Use results.*Inspect for step 3$/}).click();await expect(page.locator('#relationship-content')).toContainText('Step 1: Get Windows services');await expect(page.locator('#relationship-content')).toContainText('Step 3: Start a stopped service');
  await expect(page.locator('#relationship-content')).toContainText('acknowledge');await page.locator('#edit-relationship').click();await expect(page.locator('[data-value-source=service]').last()).toBeFocused();
  await page.locator('[data-acknowledge-scope]').check();await page.reload();await pane(page,'configure');await expect(page.locator('[data-acknowledge-scope]')).toBeChecked();
  await page.screenshot({path:info.outputPath('connected-reviewed.png')});expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  for(const [width,height] of [[1440,900],[1280,720],[768,900],[390,844],[320,844],[720,450]]){
    await page.setViewportSize({width,height});await pane(page,'configure');await page.locator('[data-acknowledge-scope]').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`source-contract-${width}x${height}.png`)});
    if(width===320)expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize(originalViewport);await pane(page,'configure');
  await page.locator('[data-step]').last().locator('.step-menu summary').click();await page.locator('[data-step]').last().locator('[data-duplicate]').click();await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 4$/})).toContainText('Step 1 → 4');await expect(page.locator('[data-acknowledge-scope]').last()).not.toBeChecked();await page.locator('#undo').click();
  await page.locator('[data-value-source=service]').last().selectOption('custom');await expect(page.locator('[data-param=service]').last()).toHaveValue('');await page.locator('[data-param=service]').last().fill('ExampleService');
  await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 3$/})).toHaveCount(0);await pane(page,'preview');await expect(page.locator('#code')).not.toContainText('ShellifySource');expect(errors).toEqual([]);
});

test('reorder, source deletion, Undo, required field edits and removal stay repairable',async({page},info)=>{
  await seed(page);await page.locator('[data-acknowledge-scope]').check();
  const consumer=page.locator('[data-step]').last();await consumer.locator('[data-move="-1"]').click();await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 2$/})).toContainText('Step 1 → 2');
  await page.locator('[data-step]').nth(1).locator('[data-move="-1"]').click();await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 1$/})).toContainText('Needs attention');await expect(page.locator('#context-status')).toHaveText('Needs configuration');
  await page.locator('#undo').click();await page.locator('#undo').click();
  await page.locator('[data-remove]').first().click();await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 2$/})).toContainText('Missing source');
  await page.screenshot({path:info.outputPath('source-missing.png')});await page.reload();await pane(page,'configure');await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 2$/})).toContainText('Missing source');
  // Reload intentionally ends history; import a fresh source and use the explicit selector to repair.
  await pane(page,'discover');await page.locator('#search').fill('Get Windows services');await page.locator('[data-add=services]').click();await pane(page,'configure');
  await page.locator('[data-step]').last().locator('[data-move="-1"]').click();
  await page.getByRole('button',{name:/^Use results.*Inspect for step 3$/}).click();await page.locator('#edit-relationship').click();
  await page.locator('[data-value-source=service]').last().selectOption({label:'Earlier results: step 2 — Get Windows services'});await page.locator('[data-acknowledge-scope]').check();
  await page.locator('[data-step]').nth(1).locator('[data-collapse]').click();await page.locator('[data-step]').nth(1).locator('.result-controls > summary').click();await page.locator('[data-step]').nth(1).locator('[data-result-field=Name]').uncheck();
  await expect(page.locator('#context-status')).toHaveText('Needs configuration');await page.getByRole('button',{name:/^Use results.*Inspect for step 3$/}).click();await expect(page.locator('#relationship-content')).toContainText('Restore the Name');
  await page.locator('#remove-relationship').click();await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 3$/})).toHaveCount(0);await page.locator('#undo').click();await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 3$/})).toBeVisible();
});

test('collapsed groups retain inspectable links and condition, shared and report relationships stay distinct',async({page},info)=>{
  await seed(page,true);await expect(page.locator('.script-step:visible')).toHaveCount(0);await expect(page.locator('.group-relationships')).toContainText('Use results');
  await page.screenshot({path:info.outputPath('collapsed-group.png')});
  await page.getByRole('button',{name:/^Use results.*Inspect for step 3$/}).focus();await page.keyboard.press('Enter');await expect(page.locator('#relationship-details')).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('connection-inspector.png')});
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:/^Use results.*Inspect for step 3$/})).toBeFocused();
  await page.getByRole('button',{name:/^Use results.*Inspect for step 3$/}).click();await page.locator('#edit-relationship').click();await expect(page.locator('[data-group-collapse]')).toHaveAttribute('aria-expanded','true');
  await page.evaluate(async()=>{
    const {freshWorkspace,createStep}=await import('/js/workspace.js');const w=freshWorkspace();w.steps=['network','disk','files','report'].map(createStep);w.sharedInputs=[{id:'destination',name:'Destination',value:'example.com'}];w.steps[0].bindings.host='destination';w.steps[2].condition={type:'connectivity',sourceId:w.steps[0].id};w.steps.forEach(s=>s.collapsed=true);localStorage.setItem('shellify.draft.v1',JSON.stringify(w));
  });await page.reload();await pane(page,'configure');
  await expect(page.getByRole('button',{name:/^Shared input.*Inspect for step 1 host$/})).toBeVisible();await expect(page.getByRole('button',{name:/^Only if.*Inspect for step 3$/})).toContainText('Step 1 → 3');await expect(page.getByRole('button',{name:/^Collect results.*Inspect for step 4$/})).toBeVisible();
  await page.screenshot({path:info.outputPath('distinct-relationships.png')});
  await page.getByRole('button',{name:/^Only if.*Inspect for step 3$/}).click();await expect(page.locator('#relationship-content')).toContainText('ICMP failure does not prove');await page.locator('#edit-relationship').click();await expect(page.locator('[data-step]').nth(2).locator('[data-condition=type]')).toBeFocused();
  await page.locator('[data-step]').nth(2).locator('[data-condition=type]').selectOption('none');await expect(page.getByRole('button',{name:/^Only if.*Inspect for step 3$/})).toHaveCount(0);
  for(const [width,height] of [[1440,900],[1280,720],[768,900],[390,844],[320,844],[720,450]]){await page.setViewportSize({width,height});await pane(page,'configure');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
