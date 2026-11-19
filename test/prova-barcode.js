// Prova: codice a barre in magazzino (telefono con lettore simulato, PC con codice scritto / dal telefono)
const {chromium, devices} = require('playwright');
let prossimo = '';
const avvia = async (b, ctxOpts, errs, store) => {
  const ctx = await b.newContext({...ctxOpts, permissions: ['camera']});
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(st => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'}; Object.assign(window.__store, st);
    // lettore simulato: restituisce il codice messo in window.__bc
    window.BarcodeDetector = class { async detect(){ return window.__bc ? [{rawValue: window.__bc}] : []; } }; }, store);
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"]'); await p.waitForTimeout(400);
  await p.click('[data-tab="magazzino"]'); await p.waitForTimeout(400);
  return p;
};
(async () => {
  const b = await chromium.launch({args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']}); const errs = [];
  const store = {listino: {c1: {items: [{codice: 'ASYG09KMCC', marca: 'General', descrizione: 'Split a parete', potenza: '9000 BTU', prezzo: 690}]}}};
  const t = await avvia(b, {...devices['Pixel 7']}, errs, store);
  // 1. codice sconosciuto -> nuovo articolo con codice a barre
  await t.evaluate(() => window.__bc = '8001234567890');
  await t.click('[data-a="artscan"]'); await t.waitForTimeout(1200);
  console.log('1 nuovo: ean =', await t.$eval('[data-k="ean"]', e => e.value));
  await t.fill('[data-k="descrizione"]', 'Staffa 450 mm'); await t.click('button[type=submit]'); await t.waitForTimeout(600);
  // 2. stesso codice -> trovato
  await t.click('[data-a="artscan"]'); await t.waitForTimeout(1200);
  console.log('2 ritrovato:', await t.$eval('.dlg h2', e => e.textContent), '/', await t.$eval('[data-k="descrizione"]', e => e.value));
  await t.click('[data-a="x"]').catch(() => t.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()))); await t.waitForTimeout(200);
  // 3. codice del listino
  await t.evaluate(() => window.__bc = 'ASYG09KMCC');
  await t.click('[data-a="artscan"]'); await t.waitForTimeout(1200);
  console.log('3 listino:', await t.$eval('[data-k="descrizione"]', e => e.value), '/', await t.$eval('[data-k="prezzoListino"]', e => e.value));
  await t.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  // 4. scritto a mano
  await t.evaluate(() => window.__bc = '');
  await t.click('[data-a="artscan"]'); await t.waitForTimeout(600);
  await t.screenshot({path: '/tmp/bc-tel.png'});
  await t.fill('#bcin', 'xyz-1'); await t.press('#bcin', 'Enter'); await t.waitForTimeout(600);
  console.log('4 manuale: codice =', await t.$eval('[data-k="codice"]', e => e.value));
  // 5. PC: codice dal telefono e scritto
  const pc = await avvia(b, {viewport: {width: 1280, height: 800}}, errs, store);
  await pc.click('[data-a="artscan"]'); await pc.waitForTimeout(700);
  await pc.screenshot({path: '/tmp/bc-pc.png'});
  const tk = await pc.evaluate(() => Object.keys(window.__store.scansioni || {})[0]);
  console.log('5 richiesta:', JSON.stringify(await pc.evaluate(k => window.__store.scansioni[k], tk)));
  await pc.evaluate(k => firebase.firestore().collection('scansioni').doc(k).set({stato: 'fatto', codice: 'ASYG09KMCC'}, {merge: true}), tk);
  await pc.waitForTimeout(800);
  console.log('5 PC riceve dal telefono:', await pc.$eval('[data-k="codice"]', e => e.value));
  console.log('errors', errs); await b.close();
})();
