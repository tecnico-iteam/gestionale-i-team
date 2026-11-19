// Prova: lista "Promemoria ai clienti per domani" nella pagina Oggi (WhatsApp con un tocco)
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
      clienti: {c1: {nome: 'Rossi Mario', telefono: '333 1112222', email: 'm@x.it'}, c2: {nome: 'Bianchi Anna', telefono: '333 4445555'}, c3: {nome: 'Verdi', telefono: '333', noPromemoria: true}},
      interventi: {i1: {clienteId: 'c1', data: dom, ora: '09:00', tipo: 'Manutenzione', tecnico: 'Maurizio Failaci', stato: 'Programmato'},
                   i2: {clienteId: 'c2', data: dom, ora: '14:30', tipo: 'Installazione', stato: 'Programmato'},
                   i3: {clienteId: 'c3', data: dom, ora: '16:00', stato: 'Programmato'}},
      promemoriaClienti: {i1: {mail: dom + '|09:00'}}
    }); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"]'); await p.waitForTimeout(500);
  const sez = await p.$('h3:has-text("Promemoria ai clienti")'); await sez.scrollIntoViewIfNeeded();
  console.log('link WhatsApp:', await p.$$eval('[data-wapr]', l => l.map(a => decodeURIComponent(a.href).slice(0, 140))));
  await p.screenshot({path: '/tmp/prom-1.png'});
  await p.evaluate(() => { window.open = () => null; document.querySelectorAll('[data-wapr]').forEach(a => a.removeAttribute('target')); document.querySelectorAll('[data-wapr]').forEach(a => a.addEventListener('click', e => e.preventDefault())); });
  await p.click('[data-wapr] >> nth=0'); await p.waitForTimeout(800);
  console.log('segnato:', JSON.stringify(await p.evaluate(() => window.__store.promemoriaClienti)));
  console.log('pulsanti rimasti:', await p.$$eval('[data-wapr]', l => l.length));
  console.log('errors', errs); await b.close();
})();
