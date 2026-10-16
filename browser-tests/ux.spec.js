import {test,expect} from '@playwright/test';
const pane=async(page,name)=>{const tab=page.getByRole('tab',{name:new RegExp(name)});if(await tab.isVisible())await tab.click();};
test.beforeEach(async({page})=>{await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());await page.goto('/builder.html');});

test('one step stays open while invalid collapsed steps remain visible and reviewable',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await pane(page,'Discover');await page.getByRole('button',{name:'Add Restart a Windows service',exact:false}).click();
  await pane(page,'Discover');await page.getByRole('button',{name:'Add List running processes',exact:false}).click();
  await expect(page.locator('[data-collapse][aria-expanded="true"]')).toHaveCount(1);
  await expect(page.locator('[data-step-error]').nth(1)).toContainText('Fix fields');
  await page.getByRole('button',{name:'Restart a Windows service',exact:true}).click();
  await expect(page.locator('[data-collapse][aria-expanded="true"]')).toHaveCount(1);
  await page.getByRole('textbox',{name:/Service name Use/}).fill('ExampleService');
  await pane(page,'Preview');await expect(page.locator('#download')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('fresh script confirmation can cancel and the footer sits below the workspace',async({page})=>{
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#start-fresh').click();await expect(page.locator('#step-count')).toHaveText('1 step');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#start-fresh').click();await expect(page.locator('#step-count')).toHaveText('0 steps');
  await pane(page,'Configure');await expect(page.locator('#workflow-empty')).toBeVisible();
  const bounds=await page.locator('.workspace').boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  const footer=await page.locator('footer').boundingBox();expect(footer.y).toBeGreaterThanOrEqual(page.viewportSize().height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('desktop dividers drag, persist and reset without covering panel controls',async({page})=>{
  test.skip(page.viewportSize().width<=1100,'Desktop dividers');
  const divider=page.getByRole('separator',{name:'Catalog width',exact:true}),box=await divider.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+70,box.y+box.height/2);await page.mouse.up();
  expect(Number(await divider.getAttribute('aria-valuenow'))).toBeGreaterThan(22);
  const resized=await divider.getAttribute('aria-valuenow');await page.reload();await expect(divider).toHaveAttribute('aria-valuenow',resized);
  await divider.dblclick();await expect(divider).toHaveAttribute('aria-valuenow','22');
  await page.locator('#focus-output').click();await expect(page.locator('#catalog')).not.toBeVisible();await expect(divider).not.toBeVisible();await page.locator('#focus-output').click();await expect(divider).toBeVisible();
});

test('keyboard search adds steps and workspace fits desktop, laptop and phone',async({page})=>{
  await page.keyboard.press('Control+k');await expect(page.locator('#search')).toBeFocused();await page.locator('#search').fill('processes');await page.getByRole('button',{name:'Add List running processes',exact:false}).click();
  await expect(page.locator('#step-count')).toHaveText('2 steps');
  if(page.viewportSize().width>1100){await page.screenshot({path:'docs/screenshots/ux-builder-desktop.png'});await page.setViewportSize({width:1280,height:720});}
  const bounds=await page.locator('.workspace').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
