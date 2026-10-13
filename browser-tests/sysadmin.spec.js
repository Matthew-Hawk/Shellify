import {test,expect} from '@playwright/test';
const pane=async(page,name)=>{const tab=page.getByRole('tab',{name:new RegExp(name)});if(await tab.isVisible())await tab.click();};
test.beforeEach(async({page})=>{await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());await page.goto('/builder.html');});
test('typos, identifiers, filters and keyboard search add the intended step',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('#search').fill('restrat servce');await expect(page.locator('[data-add="restart"]')).toBeVisible();await expect(page.locator('.match-reason').first()).toContainText('Near match');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.locator('#step-count')).toHaveText('2 steps');
  await expect(page.locator('[data-collapse][aria-expanded="true"]')).toHaveCount(0);
  await page.locator('#search').press('Shift+Enter');await expect(page.locator('#step-count')).toHaveText('3 steps');await pane(page,'Configure');await expect(page.locator('[data-collapse][aria-expanded="true"]')).toHaveCount(1);
  await pane(page,'Discover');await page.locator('#search').fill('4625');await expect(page.locator('[data-add="failed-logins"]')).toBeVisible();await page.locator('#search').fill('cat:ad is:readonly makes:users');await expect(page.locator('[data-add="ad-unlock"]')).toHaveCount(0);
  await page.locator('#search').press('Escape');await expect(page.locator('#search')).toHaveValue('');expect(errors).toEqual([]);
});
test('workflow inputs bind once, groups collapse and removal is undoable',async({page})=>{
  await page.locator('#search').fill('locked out user');await page.locator('[data-search-workflow="locked-triage"]').click();
  await expect(page.locator('#workflow-inputs')).toBeVisible();await page.locator('#workflow-identity').fill('testuser');await page.locator('#workflow-server').fill('dc01');await page.locator('#workflow-input-form button[type="submit"]').click();
  await expect(page.locator('#step-count')).toHaveText('7 steps');await expect(page.locator('.workflow-group')).toContainText('Locked-out user triage');
  await page.locator('[data-group-collapse]').click();await expect(page.locator('.script-step:visible')).toHaveCount(1);await page.locator('[data-group-collapse]').click();
  await pane(page,'Preview');await expect(page.locator('#code')).toContainText("'testuser'");await expect(page.locator('#code')).toContainText('-WhatIf');await expect(page.locator('#code')).toContainText('CallerComputerName');
  await pane(page,'Configure');await page.locator('[data-group-remove]').click();await expect(page.locator('#step-count')).toHaveText('1 step');await page.locator('#undo').click();await expect(page.locator('#step-count')).toHaveText('7 steps');
  await page.reload();await pane(page,'Configure');await expect(page.locator('.workflow-group')).toContainText('Locked-out user triage');
});
test('fleet certificate sweep captures report and settings survive refresh',async({page})=>{
  await page.locator('#search').fill('certificate expiry sweep');await page.locator('[data-search-workflow="certificate-sweep"]').click();await page.locator('#workflow-targets').fill('server01, server02');await page.locator('#workflow-input-form button[type="submit"]').click();
  await pane(page,'Preview');await expect(page.locator('#download')).toBeEnabled();await expect(page.locator('#code')).toContainText('Invoke-Command');await expect(page.locator('#code')).toContainText('Export-Csv');
  await page.locator('.settings-menu > summary').click();await page.locator('#options-button').click();await expect(page.locator('#fleet-targets')).toHaveValue('server01\nserver02');await page.locator('#close-options').click();await page.reload();await pane(page,'Preview');await expect(page.locator('#code')).toContainText('server02');
});
test('typed service results and dry run generate a bounded verified change',async({page})=>{
  await page.locator('#search').fill('automatic services stopped');await page.locator('[data-add="auto-services"]').click();await page.locator('[data-next="start-service"]').click();
  await expect(page.locator('[data-source-step]')).toHaveValue('1');await page.locator('.settings-menu > summary').click();await page.locator('#options-button').click();await page.locator('#dry-run').check();await page.locator('#close-options').click();
  await pane(page,'Preview');await expect(page.locator('#download')).toBeEnabled();await expect(page.locator('#code')).toContainText('$script:ShellifyOutput2');await expect(page.locator('#code')).toContainText('Start-Service -WhatIf');await expect(page.locator('#code')).toContainText('Name -eq $ShellifyTarget3');
  await pane(page,'Configure');await page.locator('[data-remove]').nth(1).click();await pane(page,'Preview');await expect(page.locator('#download')).toBeDisabled();
});
test('zero results offer recovery and debug diagnostics stay local',async({page})=>{
  await page.goto('/builder.html?debug=search');await page.locator('#search').fill('banana');await expect(page.locator('[data-copy-search]')).toBeVisible();await expect(page.locator('#results')).toContainText('Popular commands');await expect(page.locator('#search-debug')).toContainText('banana');
  await page.locator('[data-reset-search]').click();await page.locator('#search').fill('port 3389');await expect(page.locator('#results mark').first()).toBeVisible();
  if(page.viewportSize().width>1100){await page.screenshot({path:'docs/screenshots/sysadmin-search-desktop.png'});}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

