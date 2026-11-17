// Prova: pulsante ❓ Guida con argomenti a tendina e ricerca
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 390, height: 844}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0'); await p.waitForTimeout(500);
  await p.screenshot({path: '/tmp/g-head.png'});
  await p.click('#hguida'); await p.waitForTimeout(300);
  console.log('argomenti ufficio', await p.$$eval('.guida details', l => l.length));
  await p.click('.guida summary >> text=Cantieri'); await p.waitForTimeout(200);
  await p.screenshot({path: '/tmp/g-ufficio.png'});
  await p.fill('[data-gq]', 'fattur'); await p.waitForTimeout(200);
  console.log('trovati "fattur"', await p.$$eval('.guida details:not([hidden])', l => l.map(d => d.querySelector('summary').textContent)));
  await p.click('[data-a="x"]'); await p.click('#hmode'); await p.waitForTimeout(300);
  await p.click('[data-mode="tecnico"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('#hguida').catch(e => console.log('no tec', e.message)); await p.waitForTimeout(300);
  console.log('argomenti tecnico', await p.$$eval('.guida details', l => l.map(d => d.querySelector('summary').textContent)));
  console.log('errors', errs); await b.close();
})();
