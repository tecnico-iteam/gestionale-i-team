// Prova: dal nuovo appuntamento si può aggiungere un impianto al cliente che non ne ha
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 430, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}},
      clienti: {c1: {nome: 'Mario Rossi'}, c2: {nome: 'Bianchi Luca'}}, impianti: {i1: {clienteId: 'c1', marca: 'General', modello: 'ASHH09', tipo: 'Climatizzatore'}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(400);
  await p.click('.fab'); await p.waitForTimeout(400);
  console.log('cliente tag', await p.evaluate(() => document.querySelector('[data-k="clienteId"]').outerHTML.slice(0, 200)));
  console.log('imp opts prima', await p.$$eval('[data-k="impiantoId"] option', l => l.map(o => o.textContent)));
  await p.selectOption('[data-k="clienteId"]', 'c1').catch(e => console.log('sel err', e.message.slice(0, 100))); await p.dispatchEvent('[data-k="clienteId"]', 'change'); await p.waitForTimeout(400);
  console.log('imp opts dopo', await p.$$eval('[data-k="impiantoId"] option', l => l.map(o => o.textContent)));
  await p.selectOption('[data-k="clienteId"]', 'c2'); await p.dispatchEvent('[data-k="clienteId"]', 'change'); await p.waitForTimeout(400);
  console.log('c2 opts', await p.$$eval('[data-k="impiantoId"] option', l => l.map(o => o.textContent)));
  await p.selectOption('[data-k="impiantoId"]', '__nuovo'); await p.dispatchEvent('[data-k="impiantoId"]', 'change'); await p.waitForTimeout(400);
  await p.fill('[data-k="nImpMarca"]', 'Daikin'); await p.fill('[data-k="nImpModello"]', 'FTXM35'); await p.fill('[data-k="nImpUbic"]', 'Camera');
  await p.screenshot({path: '/tmp/imp.png', fullPage: true});
  await p.click('button[type=submit]'); await p.waitForTimeout(800);
    console.log(await p.evaluate(() => ({imp: Object.entries(window.__store.impianti).map(([k, v]) => k + ':' + v.clienteId + ' ' + v.marca + ' ' + v.modello + ' ' + v.ubicazione), int: Object.values(window.__store.interventi || {}).map(x => x.clienteId + ' imp=' + x.impiantoId + ' keys=' + Object.keys(x).filter(k => k.startsWith('nImp')).join(','))})));
  console.log(errs); await b.close();
})();
