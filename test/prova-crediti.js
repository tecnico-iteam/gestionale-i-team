// Prova di 💰 Da incassare (crediti aggiunti a mano) con dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8785);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 420, height: 900}, deviceScaleFactor: 2})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'};
    Object.assign(window.__store, {clienti: {c1: {nome: 'Cliente Prova'}}, fatture: {f1: {clienteId: 'c1', numero: '1/2026', data: '2026-10-01', imponibile: 1000, iva: '22', pagata: false, tipo: 'Fattura', scadenza: '2026-10-31'}},
      crediti: {k1: {chi: 'Mario Prova', descrizione: 'Prestito', importo: 500, acconto: 200, data: '2026-09-01', scadenza: '2026-10-01', incassato: false}},
      utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8785/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.click('[data-altro="contab"]'); await p.waitForTimeout(300); await p.click('[data-consez="crediti"]'); await p.waitForTimeout(300);
  console.log('Pagina:', (await p.innerText('#app')).replace(/\s+/g, ' ').slice(60, 700));
  await p.click('[data-cred="new"]'); await p.waitForTimeout(300);
  await p.fill('.ov [data-k="chi"]', 'Nora'); await p.fill('.ov [data-k="descrizione"]', 'Acconto lavori'); await p.fill('.ov [data-k="importo"]', '6000');
  await p.click('.ov button[type=submit]'); await p.waitForTimeout(400);
  console.log('Salvati:', JSON.stringify(Object.values(await p.evaluate(() => window.__store.crediti)).map(c => [c.chi, c.importo, c.incassato])));
  await p.click('[data-credok="k1"]'); await p.waitForTimeout(300);
  console.log('k1 incassato:', await p.evaluate(() => window.__store.crediti.k1.incassato));
  console.log('Dopo:', (await p.innerText('#app')).replace(/\s+/g, ' ').slice(60, 260));
  await p.screenshot({path: '/tmp/crediti.png', fullPage: true});
  await p.click('[data-consez="riepilogo"]'); await p.waitForTimeout(300); console.log('Analisi:', (await p.innerText('#app')).replace(/\s+/g, ' ').match(/Cassa.{0,90}/)?.[0]);
  console.log('errors', errs); await b.close(); srv.close();
})();
