// Prova: il telefono riceve la richiesta di foto dal PC (link #scan-...)
const {chromium, devices} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({...devices['iPhone 13']})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    window.__store.scansioni = {abc123: {stato:'attesa', uid:'u9', etichetta:'Foto articolo: Lampada LED', da:'Irene', creato: new Date().toISOString()}}; });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html#scan-abc123'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(1200);
  await p.screenshot({path:'/tmp/t8-telefono.png'});
  console.log('richiesta mostrata sul telefono:', (await p.content()).includes('Il PC ti chiede una foto'));
  console.log('errors', errs); await b.close();
})();
