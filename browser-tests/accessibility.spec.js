import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';

const pane=async(page,name)=>{const tab=page.getByRole('tab',{name:new RegExp(name)});if(await tab.isVisible())await tab.click();};
const settings=async(page)=>page.locator('.settings-menu > summary').click();
const library=async(page)=>page.locator('#library-button').click();
const scenarios=[
  ['landing','/',async()=>{}],
  ['landing FAQ','/',async page=>page.getByText('Is this an AI script generator?',{exact:true}).click()],
  ['builder discover','/builder.html',async()=>{}],
  ['descriptive catalog','/builder.html',async page=>page.locator('#catalog-view').click()],
  ['catalog end','/builder.html',async page=>page.locator('#results').evaluate(element=>element.scrollTop=element.scrollHeight)],
  ['builder configure','/builder.html',async page=>pane(page,'Configure')],
  ['builder preview','/builder.html',async page=>pane(page,'Preview')],
  ['settings menu','/builder.html',settings],
  ['step actions menu','/builder.html',async page=>{await pane(page,'Configure');await page.locator('.step-menu > summary').first().click();}],
  ['search tips','/builder.html',async page=>page.locator('.search-help-menu > summary').click()],
  ['guide dialog','/builder.html',async page=>page.locator('#guide-button').click()],
  ['script settings dialog','/builder.html',async page=>{await settings(page);await page.locator('#options-button').click();await page.locator('#logging-enabled').check();}],
  ['script library dialog','/builder.html',async page=>{await library(page);await page.locator('#library-name').fill('Accessibility check');await page.locator('#save-script').click();}],
  ['shared inputs dialog','/builder.html',async page=>{await settings(page);await page.locator('#inputs-button').click();await page.locator('#add-shared-input').click();}],
  ['shared parameter inputs dialog','/builder.html',async page=>{
    await settings(page);await page.locator('#options-button').click();await page.locator('#export-mode').selectOption('parameters');await page.locator('#close-options').click();
    await settings(page);await page.locator('#inputs-button').click();await page.locator('#add-shared-input').click();await page.locator('[data-shared-parameter="enabled"]').check();
  }],
  ['script review dialog','/builder.html',async page=>{await pane(page,'Preview');await page.locator('#review-script').click();}],
  ['workflow inputs dialog','/builder.html',async page=>{await library(page);await page.locator('[data-workflow="server-health"]').click();}],
  ['expanded step controls','/builder.html',async page=>{
    await pane(page,'Configure');
    for(const selector of ['.advanced-options','.troubleshooting','.result-controls','.sample-results'])await page.locator(`${selector} > summary`).first().click();
    await page.locator('[data-add-filter]').first().click();
  }],
  ['step parameter controls','/builder.html',async page=>{
    await settings(page);await page.locator('#options-button').click();await page.locator('#export-mode').selectOption('parameters');await page.locator('#close-options').click();
    await pane(page,'Discover');await page.locator('[data-add="files"]').click();await pane(page,'Configure');
    await page.locator('.parameter-controls > summary').last().click();await page.locator('[data-step-parameter="enabled"]').check();
  }]
];

test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
  // Keep animations from changing visibility or contrast during the scan.
  await page.emulateMedia({reducedMotion:'reduce'});
});

for(const [name,url,open] of scenarios)test(`accessibility: ${name}`,async({page},testInfo)=>{
  test.setTimeout(45000);
  await page.goto(url);
  if(url.includes('builder'))await expect(page.locator('#step-count')).toHaveText('1 step');
  await open(page);
  const scans=[];
  const scan=async phase=>{const results=await new AxeBuilder({page}).analyze();scans.push({phase,violations:results.violations,incomplete:results.incomplete});};
  await scan('initial');
  // Modal and configuration forms scroll independently of the viewport.
  const scrolling=page.locator('dialog[open], #configure-panel:visible .steps-scroll');
  for(const element of await scrolling.all()){
    const dimensions=await element.evaluate(node=>({height:node.clientHeight,max:node.scrollHeight-node.clientHeight}));
    if(dimensions.height<=0||dimensions.max<=0)continue;
    for(let top=dimensions.height*.8;top<dimensions.max+dimensions.height*.8;top+=dimensions.height*.8){
      await element.evaluate((node,value)=>node.scrollTop=value,Math.min(top,dimensions.max));
      await scan(`scroll ${Math.round(Math.min(top,dimensions.max))}`);
    }
  }
  const report={page:name,viewport:testInfo.project.name,scans};
  await writeFile(testInfo.outputPath('axe.json'),JSON.stringify(report,null,2));
  await testInfo.attach('axe-results',{body:JSON.stringify(report,null,2),contentType:'application/json'});
  const blocking=scans.flatMap(results=>results.violations).filter(violation=>['serious','critical'].includes(violation.impact));
  expect(blocking.map(({id,impact,nodes})=>({id,impact,targets:nodes.map(node=>node.target)}))).toEqual([]);
});
