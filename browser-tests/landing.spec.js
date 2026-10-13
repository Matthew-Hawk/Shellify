import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
  await page.goto('/');
});
test('examples show real commands and support guided/expert switching',async({page})=>{
  await expect(page.locator('#hero-code')).toContainText('Get-Service');
  await page.getByRole('button',{name:'Files',exact:true}).click();await expect(page.locator('#hero-code')).toContainText('Get-ChildItem');
  await expect(page.locator('#example-name')).toHaveText('List files in a directory');
  await page.getByRole('button',{name:'Compact code',exact:true}).click();await expect(page.locator('#hero-code')).not.toContainText('#');
  await page.getByRole('button',{name:'Directory',exact:true}).click();await expect(page.locator('#hero-code')).toContainText('Get-ADUser');
  await expect(page.locator('#example-detail')).toContainText('RSAT required');
});
test('pause control stops decorative animation and reduced motion disables it',async({page})=>{
  const orbit=page.locator('.orbit-one');await expect(orbit).toHaveCSS('animation-play-state','running');
  await page.getByRole('button',{name:'Pause animations',exact:true}).click();await expect(orbit).toHaveCSS('animation-play-state','paused');
  await expect(page.locator('.assembly-step')).toHaveCSS('animation-play-state','paused');
  await expect(page.locator('.landing-entrance')).toHaveCount(0);await page.getByRole('button',{name:'Enable animations',exact:true}).click();await expect(page.locator('#landing-title')).toHaveCSS('opacity','1');await expect(page.locator('.landing-entrance')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(orbit).toHaveCSS('animation-name','none');await expect(page.locator('.flow-packet')).toHaveCSS('animation-name','none');
});
test('FAQ and primary navigation work without horizontal overflow',async({page})=>{
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  if(page.viewportSize().width>1000){await page.setViewportSize({width:1280,height:720});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  await page.getByText('Does Shellify run my script?',{exact:true}).click();await expect(page.locator('.faq-list details').first()).toHaveAttribute('open','');
  await page.getByText('Is this an AI script generator?',{exact:true}).click();await expect(page.locator('.faq-list details').nth(1)).toHaveAttribute('open','');await expect(page.locator('.faq-list details').first()).not.toHaveAttribute('open','');
  await page.getByText('Is this an AI script generator?',{exact:true}).click();await expect(page.locator('.faq-list details[open]')).toHaveCount(0);
  await page.getByRole('link',{name:'Start building',exact:false}).click();await expect(page).toHaveURL(/builder.html$/);await expect(page.locator('#step-count')).toHaveText('1 step');
});
test('home entrance completes and reduced motion keeps content visible',async({page})=>{
  await expect(page.locator('#landing-title')).toHaveCSS('opacity','1');
  await expect(page.locator('.landing-entrance')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  await expect(page.locator('#landing-title')).toHaveCSS('animation-name','none');await expect(page.locator('#landing-title')).toHaveCSS('opacity','1');
});
