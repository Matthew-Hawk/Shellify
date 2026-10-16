import {test,expect} from '@playwright/test';
import {deflateSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
const hashFor=source=>'#share='+deflateSync(source).toString('base64url');
const draft=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shellify.draft.v1')));
const portable=value=>{const {libraryId,...workspace}=value.workspace||value;return {...workspace,steps:workspace.steps.map(({id,...step})=>step)};};

test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
  await page.goto('/builder.html');
});

test('share link round trip restores the portable project and supports Undo',async({page,context})=>{
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();
  const source=JSON.parse(await readFile('docs/examples/network-review.shellify.json','utf8'));
  source.workspace.title='<img src=x onerror="window.injected=true"> 漢字';
  source.workspace.steps[0].values.host="O'Brien'; $(whoami) #";
  await page.locator('#import-project').setInputFiles({name:'roundtrip.shellify.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await expect(page.locator('#step-count')).toHaveText('2 steps');
  const before=await draft(page);
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();
  await page.getByRole('button',{name:'Create share link',exact:true}).click();
  await expect(page.locator('#share-link-field')).toBeVisible();
  const url=await page.locator('#share-link').inputValue();
  expect(new URL(url).hash).toMatch(/^#share=[A-Za-z0-9_-]+$/);
  expect(new URL(url).hash.length).toBeLessThanOrEqual(16384);
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'Copy share link',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(url);
  await page.getByRole('button',{name:'Close script library',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Start fresh',exact:true}).click();
  await expect(page.locator('#step-count')).toHaveText('0 steps');
  await page.goto('/builder.html?empty-draft');
  await page.goto(url);
  await expect(page.locator('#step-count')).toHaveText('2 steps');
  const restored=await draft(page);
  expect(portable(restored)).toEqual(portable(before));
  expect(await page.evaluate(()=>window.injected)).toBeUndefined();
  expect(page.url()).not.toContain('#');
  await page.getByRole('button',{name:'↶ Undo',exact:true}).click();
  await expect(page.locator('#step-count')).toHaveText('0 steps');
  await page.reload();await expect(page.locator('#step-count')).toHaveText('0 steps');
  // Same-document fragment navigation must restore too, without a page reload.
  await page.goto(url);
  await expect(page.locator('#step-count')).toHaveText('2 steps');
  expect(portable(await draft(page))).toEqual(portable(before));
});

test('malicious and oversized hashes show errors without replacing the draft',async({page})=>{
  const valid=JSON.parse(await readFile('docs/examples/network-review.shellify.json','utf8'));
  const unsupported=structuredClone(valid);unsupported.workspace.steps[0].actionId='<img src=x onerror="window.injected=true">';
  const badParameter=structuredClone(valid);badParameter.workspace.steps[0].values.injected='$(whoami)';
  const before=await draft(page);
  const cases=[
    ['#share=!!<script>window.injected=true</script>','Invalid share link'],
    ['#share=A','Invalid share link'],
    ['#share=YWJj','Invalid share link'],
    ['#unexpected=payload','Invalid share link'],
    [hashFor('{invalid json'),'Invalid share link'],
    [hashFor(JSON.stringify({...valid,schemaVersion:999})),'Invalid share link'],
    [hashFor(JSON.stringify(unsupported)),'Invalid share link'],
    [hashFor(JSON.stringify(badParameter)),'Invalid share link'],
    ['#share='+'A'.repeat(16384),'too large'],
    [hashFor(' '.repeat(1024*1024+1)),'too large']
  ];
  for(const [index,[hash,message]] of cases.entries()){
    await page.goto('/builder.html?case='+index+hash);
    await expect(page.locator('#project-error')).toBeVisible();
    await expect(page.locator('#project-error')).toContainText(message);
    expect(portable(await draft(page))).toEqual(portable(before));
    expect(await page.evaluate(()=>window.injected)).toBeUndefined();
    expect(page.url()).not.toContain('#');
  }
});

test('oversized projects cannot create share links',async({page})=>{
  // Valid per-field inputs with low compressibility exceed the encoded link cap.
  const project=JSON.parse(await readFile('docs/examples/network-review.shellify.json','utf8'));
  const seed=project.workspace.steps[0];
  const {randomBytes}=await import('node:crypto');
  project.workspace.steps=Array.from({length:200},()=>({...structuredClone(seed),values:{...seed.values,host:randomBytes(240).toString('hex')}}));
  // Give each export a distinct destination as well as a unique DNS hostname.
  project.workspace.steps.forEach((step,index)=>{step.output.path=`reports/dns-${index}.json`;});
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();
  await page.locator('#import-project').setInputFiles({name:'large.shellify.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.locator('#script-library')).not.toBeVisible();
  await page.getByRole('button',{name:'Scripts & workflows',exact:true}).click();
  await page.getByRole('button',{name:'Create share link',exact:true}).click();
  await expect(page.locator('#project-error')).toContainText('too large');
  await expect(page.locator('#share-link-field')).toBeHidden();
});
