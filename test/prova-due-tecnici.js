// Prova: appuntamento con due tecnici, promemoria al cliente facoltativo e modifica dall'elenco "domani"
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 430, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { const d = new Date(); d.setDate(d.getDate() + 1); const dom = d.toISOString().slice(0, 10);
    window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {
      config: {impostazioni: {tecnici: [{nome: 'Andrea D’amico', codice: 'T01'}, {nome: 'Alessio rizza', codice: 'T02'}]}},
      clienti: {c1: {nome: 'Rossi Mario', telefono: '333 1112222', email: 'm@x.it'}},
      interventi: {i1: {clienteId: 'c1', data: dom, ora: '09:00', tipo: 'Manutenzione', tecnico: 'Andrea D’amico', stato: 'Programmato'}}
    }); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0'); await p.waitForTimeout(500);
  await p.click('[data-intedit="i1"]'); await p.waitForTimeout(400);
  await p.selectOption('[data-k="tecnico2"]', {index: 1});
  await p.uncheck('[data-k="promemoria"]');
  await p.screenshot({path: '/tmp/due-form.png'});
  await p.click('button[type=submit]'); await p.waitForTimeout(600);
  console.log('salvato:', JSON.stringify(await p.evaluate(() => window.__store.interventi.i1)));
  const sez = await p.$('h3:has-text("Promemoria ai clienti")'); await sez.scrollIntoViewIfNeeded();
  await p.screenshot({path: '/tmp/due-oggi.png'});
  console.log('WhatsApp da mandare:', await p.$$eval('[data-wapr]', l => l.length));
  await p.click('[data-int="i1"]').catch(() => {}); await p.waitForTimeout(300);
  console.log('errors', errs); await b.close();
})();
