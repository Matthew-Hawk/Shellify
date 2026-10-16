import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const pane=async(page,name)=>{const tab=page.locator('#tab-'+name);if(await tab.isVisible())await tab.click();};
test.beforeEach(async({page})=>{
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/builder.html');
});

test('persistent context follows editing, target changes, removal, undo and draft reload',async({page})=>{
  await expect(page.locator('#context-status')).toHaveText('Ready to export');
  await page.locator('#context-edit').click();await expect(page.locator('#script-title')).toBeFocused();
  await page.locator('#script-title').fill('Quarterly service review');await page.locator('#target-version').selectOption('7');
  await page.keyboard.press('Escape');await expect(page.locator('#context-edit')).toBeFocused();
  await expect(page.locator('#context-title')).toHaveText('Quarterly service review');await expect(page.locator('#context-version')).toHaveText('PowerShell 7');
  await pane(page,'discover');await page.locator('#search').fill('Restart a Windows service');await page.locator('[data-add="restart"]').click();await pane(page,'configure');
  await page.locator('[data-param="service"]').fill('Spooler');await page.locator('[data-param="computer"]').last().fill('server01');
  await expect(page.locator('#context-scope')).toContainText('Remote: server01');
  await page.locator('[data-param="whatIf"]').check();
  await expect(page.locator('#context-counts')).toHaveText('2 steps · 0 modifying · 1 preview only');
  await page.locator('[data-param="whatIf"]').uncheck();await expect(page.locator('#context-counts')).toHaveText('2 steps · 1 modifying');
  await page.locator('[data-remove]').last().click();await expect(page.locator('#context-counts')).toHaveText('1 step · 0 modifying');await expect(page.locator('#context-scope')).toHaveText('Local');
  await page.locator('#undo').click();await expect(page.locator('#context-scope')).toContainText('server01');
  await page.reload();await expect(page.locator('#context-title')).toHaveText('Quarterly service review');await expect(page.locator('#context-version')).toHaveText('PowerShell 7');await expect(page.locator('#context-counts')).toHaveText('2 steps · 1 modifying');
  await page.locator('#context-requirements').click();await expect(page.locator('#review-content')).toContainText('have not been checked in your environment');await expect(page.locator('#review-content')).toContainText('server01');
  await page.keyboard.press('Escape');await expect(page.locator('#context-requirements')).toBeFocused();
});

test('context settings reflect fleet values and invalid edits preserve recovery and export gates',async({page})=>{
  await page.locator('#context-edit').click();await page.locator('#fleet-targets').fill('server01, server02');await page.locator('#dry-run').check();await page.locator('#close-options').click();
  await expect(page.locator('#context-scope')).toHaveText('Remote: 2 fleet targets');
  await page.locator('#context-requirements').click();await expect(page.locator('#review-content')).toContainText('Fleet computer: server02');await expect(page.locator('#review-content')).toContainText('Runs on configured fleet targets');await expect(page.locator('#review-content')).not.toContainText('Commands target the current computer.');await page.keyboard.press('Escape');
  await page.reload();await page.locator('#context-edit').click();await expect(page.locator('#fleet-targets')).toHaveValue('server01\nserver02');await expect(page.locator('#dry-run')).toBeChecked();
  await page.locator('#fleet-targets').fill('');await page.locator('#close-options').click();
  await pane(page,'discover');await page.locator('#search').fill('Start a stopped service');await page.locator('[data-add="start-service"]').click();
  await expect(page.locator('#context-status')).toHaveText('Needs configuration');await pane(page,'preview');
  await expect(page.locator('#preview-stale')).toBeVisible();await expect(page.locator('#copy')).toBeDisabled();await expect(page.locator('#download')).toBeDisabled();
  await page.locator('#fix-incomplete').click();await page.locator('[data-param="service"]').fill('Spooler');
  await expect(page.locator('#context-status')).toHaveText('Ready to export');await pane(page,'preview');await expect(page.locator('#download')).toBeEnabled();
  await pane(page,'configure');await page.locator('#clear').click();await expect(page.locator('#context-status')).toHaveText('Add a command');await expect(page.locator('#context-scope')).toHaveText('No targets yet');await expect(page.locator('#context-requirements')).toBeDisabled();
});

test('long identity, targets and titles reflow with compact controls at all review sizes',async({page},testInfo)=>{
  test.setTimeout(45000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(async()=>{
    const {freshWorkspace,createStep}=await import('/js/workspace.js');const w=freshWorkspace();
    w.title='Service and network maintenance review — '+ 'Quarterly review '.repeat(4);
    w.steps=['auto-services','restart','network','disk'].map(createStep);
    w.steps.forEach(s=>s.collapsed=true);w.steps[1].values.service='Spooler';w.steps[1].values.computer='service-review-target-with-a-long-name.example.test';
    w.steps[1].values.whatIf=true;
    w.steps[2].values.host='network-destination-with-a-long-name.example.test';
    localStorage.setItem('shellify.draft.v1',JSON.stringify(w));
  });await page.reload();
  for(const [width,height] of [[1440,900],[1280,720],[768,900],[390,844],[320,844],[720,450]]){
    await page.setViewportSize({width,height});await pane(page,'configure');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const workspace=await page.locator('.workspace').boundingBox();expect(workspace.height).toBeGreaterThan(100);expect(workspace.y+workspace.height).toBeLessThanOrEqual(height+1);
    expect((await page.locator('.steps-scroll').boundingBox()).height).toBeGreaterThanOrEqual(100);
    const heading=await page.locator('.workspace-heading').boundingBox(),context=await page.locator('.script-context').boundingBox();expect(context.y).toBeGreaterThanOrEqual(heading.y+heading.height);
    const card=page.locator('[data-step]').nth(1);await card.scrollIntoViewIfNeeded();
    const target=card.locator('[data-summary]');expect(await target.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
    await expect(card.locator('[data-remove]')).toBeVisible();await expect(card.locator('[data-impact]')).toContainText('PREVIEW');
    await page.screenshot({path:testInfo.outputPath(`stress-${width}x${height}.png`)});
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    if(height<600){await pane(page,'preview');expect((await page.locator('#code').boundingBox()).height).toBeGreaterThanOrEqual(100);await page.locator('#download').scrollIntoViewIfNeeded();await expect(page.locator('#download')).toBeInViewport();await page.screenshot({path:testInfo.outputPath('reflow-preview.png')});}
  }
  await page.setViewportSize({width:390,height:844});await pane(page,'configure');
  const first=page.locator('[data-step]').first();await first.locator('.step-menu summary').focus();await page.keyboard.press('Enter');await expect(first.locator('[data-duplicate]')).toBeVisible();
  await page.keyboard.press('Escape');await expect(first.locator('.step-menu summary')).toBeFocused();await first.locator('[data-collapse]').click();await expect(first).toHaveClass(/selected-step/);
  expect(errors).toEqual([]);
});
