import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./browser-tests',timeout:20000,workers:1,fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:4190',channel:process.env.SHELLIFY_TEST_BROWSER||(process.platform==='win32'?'msedge':undefined),headless:true,trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
  webServer:{command:'node tools/serve.js',url:'http://127.0.0.1:4190/builder.html',env:{SHELLIFY_PORT:'4190'},reuseExistingServer:!process.env.CI,timeout:15000}
});
