// Prova di 📝 Preventivi in contabilità (acconti e saldi collegati) con dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8786);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 420, height: 900}, deviceScaleFactor: 2})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'};
    Object.assign(window.__store, {clienti: {c1: {nome: 'Cliente Prova'}}, fatture: {f1: {clienteId: 'c1', numero: '1/2026', data: '2026-10-01', imponibile: 1000, iva: '22', pagata: false, tipo: 'Fattura', scadenza: '2026-10-31', descrizione: 'SALDO lavori'}, f0: {clienteId: 'c1', numero: '2/2026', data: '2026-09-05', imponibile: 2500, iva: '22', pagata: true, tipo: 'Fattura', descrizione: 'ACCONTO 50%', preventivoId: 'p1'}},
      preventivi: {p1: {clienteId: 'c1', numero: '5/2026', data: '2026-09-01', oggetto: 'Clima ufficio', stato: 'Accettato', iva: 22, righe: [{descrizione: 'Impianto', qta: 1, prezzo: 5000}]}, p2: {clienteId: 'c1', numero: '6/2026', data: '2026-10-01', stato: 'Inviato', righe: [{qta: 1, prezzo: 900}]}},
      crediti: {k1: {chi: 'Mario Prova', descrizione: 'Prestito', importo: 500, acconto: 200, data: '2026-09-01', scadenza: '2026-10-01', incassato: false}},
      utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8786/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.click('[data-altro="contab"]'); await p.waitForTimeout(300); await p.click('[data-consez="prev"]'); await p.waitForTimeout(300);
  console.log('Pagina:', (await p.innerText('#app')).replace(/\s+/g, ' ').slice(60, 900));
  await p.screenshot({path: '/tmp/prev.png', fullPage: true});
  await p.click('[data-prevcol="p1"]'); await p.waitForTimeout(300); await p.selectOption('.ov select[data-k="fid"]', 'f1'); await p.click('.ov button[type=submit]'); await p.waitForTimeout(400);
  console.log('Collegata:', await p.evaluate(() => window.__store.fatture.f1.preventivoId));
  console.log('Dopo:', (await p.innerText('#app')).replace(/\s+/g, ' ').match(/Preventivo .{0,140}/)?.[0]);
  await p.click('[data-prevfat="p1"]'); await p.waitForTimeout(300); console.log('Nuova fattura:', await p.$eval('.ov [data-k="imponibile"]', x => x.value), await p.$eval('.ov [data-k="descrizione"]', x => x.value));
  console.log('errors', errs); await b.close(); srv.close();
})();
