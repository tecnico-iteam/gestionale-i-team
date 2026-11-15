// Prova: pulsanti WhatsApp ufficio/cliente sul lavoro iniziato dal tecnico
const {chromium, devices} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({...devices['iPhone 13']})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**', r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { const oggi = new Date().toISOString().slice(0, 10);
    window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {config: {impostazioni: {tecnici: [{nome:'Tommaso Carone', codice:'T01'}]}},
      clienti: {c1: {nome:'Rossi Mario', citta:'Torino', indirizzo:'Via Roma 1', telefono:'+39 333 1112222'}},
      interventi: {i1: {clienteId:'c1', data: oggi, ora:'09:00', tipo:'Installazione', tecnico:'Tommaso Carone', stato:'Programmato'}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="tecnico"]'); await p.waitForTimeout(500);
  console.log('prima di Inizia, pulsanti WhatsApp:', await p.$$eval('a.btn.wa', l => l.length));
  await p.click('[data-start]'); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  await p.waitForTimeout(300);
  console.log('dopo Inizia:', await p.$$eval('a.btn.wa', l => l.map(a => a.textContent + ' → ' + decodeURIComponent(a.href))));
  await p.screenshot({path:'/tmp/w1.png'});
  console.log('errors', errs); await b.close();
})();
