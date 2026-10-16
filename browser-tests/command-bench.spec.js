import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
const pane=async(page,name)=>{const tab=page.locator('#tab-'+name);if(await tab.isVisible()&&await tab.getAttribute('aria-selected')!=='true')await tab.click();};
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
  await page.goto('/builder.html');
});
test('inspect commands without adding and keep keyboard insertion fast',async({page})=>{
  await page.locator('#search').fill('service');
  await page.getByRole('button',{name:'Inspect Start a stopped service',exact:true}).click();
  await expect(page.locator('#command-details')).toBeVisible();
  await expect(page.locator('#command-detail-cmdlet')).toContainText('Start-Service');
  await expect(page.locator('#step-count')).toHaveText('1 step');
  await page.locator('#add-inspected-command').click();
  await pane(page,'configure');
  await expect(page.locator('#step-count')).toHaveText('2 steps');
  await expect(page.locator('[data-step-error]').last()).toHaveText('Needs configuration');
  await expect(page.locator('[data-param="service"]')).toHaveAttribute('aria-invalid','false');
  await pane(page,'discover');await page.locator('#search').fill('processes');await page.locator('#search').press('Enter');
  await expect(page.locator('#step-count')).toHaveText('3 steps');await expect(page.locator('#search')).toBeFocused();
});
test('incomplete steps retain the last valid preview and block export until corrected',async({page})=>{
  const original=await page.locator('#code').textContent();
  await page.locator('#search').fill('Start a stopped service');await page.locator('[data-add="start-service"]').click();
  await pane(page,'preview');
  await expect(page.locator('#preview-stale')).toBeVisible();
  await expect(page.locator('#preview-stale-label')).toContainText('Out of date');
  await expect(page.locator('#code')).toHaveText(original);
  await expect(page.locator('#download')).toBeDisabled();await expect(page.locator('#copy')).toBeDisabled();
  await page.locator('#fix-incomplete').click();
  const service=page.locator('[data-param="service"]');await expect(service).toHaveAttribute('aria-invalid','true');
  await service.fill('Spooler');await pane(page,'preview');
  await expect(page.locator('#preview-stale')).toBeHidden();await expect(page.locator('#download')).toBeEnabled();
  await expect(page.locator('#code')).toContainText("Start-Service");await expect(page.locator('#code')).toContainText("'Spooler'");
  await expect(page.locator('#code')).not.toContainText('SHELLIFY_BEGIN');
  await expect(page.locator('.selected-code')).not.toHaveCount(0);
  await page.locator('[data-view-mode="expert"]').click();await expect(page.locator('.selected-code')).not.toHaveCount(0);
  await pane(page,'configure');await page.locator('[data-remove]').last().click();await pane(page,'preview');
  await expect(page.locator('#code')).not.toContainText('Start-Service');await expect(page.locator('#preview-stale')).toBeHidden();
});
test('bench keeps identity, motion, selected code and responsive containment',async({page})=>{
  await expect(page.locator('.brand').first()).toContainText('Shellify');await expect(page.locator('.builder-dot')).toHaveCount(3);
  await pane(page,'preview');await expect(page.locator('.selected-code')).not.toHaveCount(0);
  await page.locator('[data-view-mode="expert"]').click();await expect(page.locator('.selected-code')).not.toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.builder-dot').first()).toHaveCSS('animation-name','none');
  for(const width of [1440,1280,768,390,320]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const box=await page.locator('.workspace').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(901);
  }
});

test('bench accessibility covers inspection, stale output and mobile preview',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const scan=async()=>expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await scan();
  await page.locator('#search').fill('service');await page.locator('[data-inspect="start-service"]').click();await scan();
  await page.locator('#add-inspected-command').click();await pane(page,'preview');await scan();
  await page.locator('#fix-incomplete').click();await page.locator('[data-param="service"]').fill('Spooler');await pane(page,'preview');await scan();
});

for(const [name,dialogId,triggerId] of [['library','script-library','library-button'],['guide','guide','guide-button']])test(`${name} backdrop dismisses on either side after scrolling without dismissing inside clicks`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const dialog=page.locator('#'+dialogId);
  for(const side of ['left','right']){
    await page.locator('#'+triggerId).click();
    await dialog.evaluate(element=>{element.scrollTop=element.scrollHeight;});
    const bounds=await dialog.boundingBox();
    await page.mouse.click(bounds.x+8,bounds.y+bounds.height/2);
    await expect(dialog).toBeVisible();
    const outsideX=side==='left'?bounds.x/2:(bounds.x+bounds.width+page.viewportSize().width)/2;
    await page.mouse.move(bounds.x+8,bounds.y+bounds.height/2);await page.mouse.down();
    await page.mouse.move(outsideX,bounds.y+bounds.height/2);await page.mouse.up();
    await expect(dialog).toBeVisible();
    await page.mouse.click(outsideX,bounds.y+bounds.height/2);
    await expect(dialog).toBeHidden();
    await expect(page.locator('#'+triggerId)).toBeFocused();
  }
});
