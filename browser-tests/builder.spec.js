import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const pane=async(page,name)=>{const tab=page.getByRole('tab',{name:new RegExp(name)});if(await tab.isVisible())await tab.click();};
const add=async(page,name)=>{await pane(page,'Discover');await page.getByRole('button',{name:`Add ${name}`,exact:false}).click();};
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
  page.on('dialog',dialog=>dialog.accept());await page.goto('/builder.html');
});
test('guide reopens with motion and respects pause and reduced motion',async({page})=>{
  await page.getByRole('button',{name:'How it works'}).click();await expect(page.locator('#guide')).toBeVisible();const card=await page.locator('.guide-card').boundingBox();expect(card.x).toBeGreaterThanOrEqual(0);expect(card.x+card.width).toBeLessThanOrEqual(page.viewportSize().width);expect(card.y+card.height).toBeLessThanOrEqual(page.viewportSize().height);
  await expect(page.locator('.guide-ring i').first()).toHaveCSS('animation-name','guide-orbit');
  await page.keyboard.press('Escape');await expect(page.locator('#guide')).not.toBeVisible();
  await page.getByRole('button',{name:'Motion on — Pause animations',exact:true}).click();await expect(page.locator('.builder-dot').first()).toHaveCSS('animation-play-state','paused');
  await page.getByRole('button',{name:'How it works'}).click();await expect(page.locator('#guide')).toHaveCSS('animation-name','none');await expect(page.locator('.guide-ring i').first()).toHaveCSS('animation-name','none');
  await page.getByRole('button',{name:'Close guide',exact:true}).click();await page.getByRole('button',{name:'Motion off — Enable animations',exact:true}).click();
  await page.getByRole('button',{name:'How it works'}).click();await expect(page.locator('#guide')).toHaveCSS('animation-name','guide-pop');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#guide')).toHaveCSS('animation-name','none');await expect(page.locator('.builder-dot').first()).toHaveCSS('animation-name','none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('autosave, duplicate, collapse, reset and Undo retain independent steps',async({page})=>{
  await page.getByRole('button',{name:'Start fresh',exact:true}).click();await add(page,'List files in a directory');
  await page.getByRole('textbox',{name:/Folder path An/}).fill('C:\\Audit');
  await page.locator('.step-menu > summary').first().click();await page.getByRole('button',{name:'Duplicate step 1',exact:true}).click();
  await page.getByRole('textbox',{name:/Folder path An/}).fill('C:\\Other');
  await page.locator('.step-menu > summary').nth(1).click();await page.getByRole('button',{name:'Reset defaults for step 2',exact:true}).click();
  await page.getByRole('button',{name:'↶ Undo',exact:true}).click();
  await expect(page.getByRole('textbox',{name:/Folder path An/})).toHaveValue('C:\\Other');
  await page.getByRole('button',{name:'List files in a directory',exact:true}).nth(1).click();await page.reload();await pane(page,'Configure');
  await expect(page.locator('#step-count')).toHaveText('2 steps');
  await expect(page.getByRole('button',{name:'List files in a directory',exact:true}).first()).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'Clear all',exact:true}).click();await page.getByRole('button',{name:'↶ Undo',exact:true}).click();await expect(page.locator('#step-count')).toHaveText('2 steps');
});
test('favorites and flag search persist after refresh',async({page})=>{
  await page.getByRole('searchbox',{name:'Search commands',exact:true}).fill('-DnsOnly');
  await page.getByRole('button',{name:'Save Look up DNS records to favorites',exact:true}).click();await page.reload();
  await page.getByRole('button',{name:'★ Favorites',exact:true}).click();await expect(page.locator('#result-count')).toHaveText('1 command');
  await expect(page.getByRole('button',{name:'Add Look up DNS records',exact:false})).toBeVisible();
});
test('imports are atomic and undoable',async({page})=>{
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();
  await page.locator('#import-project').setInputFiles(resolve('test/fixtures/invalid-project.json'));await expect(page.locator('#project-error')).toContainText('Unsupported');
  await page.locator('#import-project').setInputFiles(resolve('docs/examples/network-review.shellify.json'));
  await expect(page.locator('#script-library')).not.toBeVisible();await expect(page.locator('#step-count')).toHaveText('2 steps');
  await page.getByRole('button',{name:'↶ Undo',exact:true}).click();await expect(page.locator('#step-count')).toHaveText('1 step');
});
test('expert mode removes comments from preview, clipboard and download',async({page,context})=>{
  await pane(page,'Preview');await page.getByRole('button',{name:'Compact code',exact:true}).click();
  await expect(page.locator('#code')).not.toContainText('# Shellify');await expect(page.locator('#code')).toContainText('Get-CimInstance');
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:/Copy script/}).click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).not.toContain('#');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Download .ps1/}).click();const download=await downloadPromise;
  const content=await readFile(await download.path(),'utf8');expect(content).toBe('\ufeff'+copied.replaceAll('\r\n','\n').replaceAll('\n','\r\n'));
  await page.reload();await pane(page,'Preview');await expect(page.getByRole('button',{name:'Compact code',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('saved scripts update, rename and restore the previous contents',async({page})=>{
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();await page.locator('#library-name').fill('Health');await page.getByRole('button',{name:'Save new',exact:true}).click();
  await page.getByRole('button',{name:'Close script library',exact:true}).click();await add(page,'List running processes');
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();await page.getByRole('button',{name:'Update saved',exact:true}).click();
  await page.getByRole('textbox',{name:'Name for Health',exact:true}).fill('Health v2');await page.getByRole('button',{name:'Rename Health',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open Health v2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore previous version of Health v2',exact:true}).click();await expect(page.locator('#step-count')).toHaveText('1 step');
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();await expect(page.getByRole('button',{name:'Open Health',exact:true})).toBeVisible();
});
test('shared inputs and bulk targets generate labeled loops with continuation',async({page})=>{
  await page.getByRole('button',{name:'Start fresh',exact:true}).click();await page.locator('.settings-menu > summary').click();await page.getByRole('button',{name:'Shared inputs',exact:true}).click();
  await page.getByRole('button',{name:'Add shared input',exact:true}).click();await page.getByRole('textbox',{name:'Input name',exact:true}).fill('Host');await page.getByRole('textbox',{name:'Input value',exact:true}).fill('server01');await page.getByRole('button',{name:'Close shared inputs',exact:true}).click();
  await add(page,'Test network connectivity');await page.getByRole('combobox',{name:'Hostname or IP value source',exact:true}).selectOption({label:'Host'});
  await pane(page,'Preview');await expect(page.locator('#code')).toContainText("'server01'");await pane(page,'Configure');
  await page.getByText('Advanced options',{exact:true}).click();await page.getByRole('combobox',{name:'Bulk target field',exact:true}).selectOption('host');await page.getByRole('textbox',{name:/Bulk targets/}).fill('server01\nserver02');
  await page.getByRole('combobox',{name:/If this step fails/}).selectOption('continue');await pane(page,'Preview');
  await expect(page.locator('#code')).toContainText('foreach');await expect(page.locator('#code')).toContainText("'server02'");await expect(page.locator('#code')).toContainText('catch');await expect(page.locator('#code')).toContainText("Name='Target'");
  await page.getByRole('button',{name:'View requirements — Review script requirements',exact:true}).click();await expect(page.locator('#review-content')).toContainText('Bulk host: server02');
});
test('CSV validation disables export until a destination is set',async({page})=>{
  await pane(page,'Configure');await page.getByRole('combobox',{name:'Output format',exact:true}).selectOption('csv');await pane(page,'Preview');await expect(page.getByRole('button',{name:/Download .ps1/})).toBeDisabled();
  await pane(page,'Configure');await page.getByRole('textbox',{name:/Destination path/}).fill('reports/disk.csv');await pane(page,'Preview');await expect(page.locator('#code')).toContainText('Export-Csv');await expect(page.getByRole('button',{name:/Download .ps1/})).toBeEnabled();
});
test('runtime settings persist, log validation blocks export and help is available',async({page})=>{
  await page.locator('.settings-menu > summary').click();await page.getByRole('button',{name:'Script settings',exact:true}).click();
  await page.locator('#preflight').check();await page.locator('#execution-summary').check();await page.locator('#logging-enabled').check();await expect(page.locator('#runtime-errors')).toContainText('log path');
  await page.locator('#logging-path').fill('reports/run.log');await page.getByRole('button',{name:'Close script settings',exact:true}).click();await page.reload();await pane(page,'Preview');
  await expect(page.locator('#code')).toContainText('Start-Transcript');await expect(page.locator('#code')).toContainText('Execution summary:');await expect(page.locator('#code')).toContainText('PSVersionTable');
  await pane(page,'Configure');await page.getByText('Details',{exact:true}).click();await expect(page.locator('.troubleshooting')).toContainText('PowerShell version');
});
