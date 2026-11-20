// Prova dell'importazione del pacchetto (clienti, fatture emesse con PDF, fatture fornitori).
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8783);
const pac = {cli: [{id: 'c1', existing: true, ragioneSociale: 'ROSSI SRL', piva: 'IT123', sdi: 'ABC1234'}, {id: 'fpr-cli-it999', existing: false, nome: 'Nuova Srl', ragioneSociale: 'NUOVA SRL', piva: 'IT999', tipo: 'Azienda'}],
  fat: [{id: 'fpr-2026-1', clienteId: 'c1', numero: '1/2026', data: '2026-01-07', imponibile: 350, iva: '22', pagata: true, dataPagamento: '2026-01-07', tipo: 'Fattura', file_nome: 'a.pdf'},
        {id: 'fpr-2026-2', clienteId: 'fpr-cli-it999', numero: '2/2026', data: '2026-01-08', imponibile: -100, iva: '22', pagata: true, tipo: 'Nota di credito', file_nome: 'b.pdf'}],
  contab: [{id: 'imp26-4', tipo: 'Fattura fornitore', fornitore: 'WURTH', numero: '45', data: '2026-01-02', importo: 120, pagata: false, scadenza: '2026-12-31'}],
  pdf: {'a.pdf': Buffer.from('%PDF-1.4 a').toString('base64'), 'b.pdf': Buffer.from('%PDF-1.4 b').toString('base64')}};
fs.writeFileSync('/tmp/pacchetto.json', JSON.stringify(pac));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 1100, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'};
    Object.assign(window.__store, {clienti: {c1: {nome: 'Mario Rossi', telefono: '333'}}, utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8783/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="contab"]'); await p.waitForTimeout(400);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-contab="pacchetto"]')]);
  await fc.setFiles('/tmp/pacchetto.json'); await p.waitForTimeout(600);
  const ok = await p.$('.ov button:has-text("Importa")'); if (ok) await ok.click(); await p.waitForTimeout(2500);
  const st = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  console.log('clienti', JSON.stringify(st.clienti)); console.log('fatture', JSON.stringify(Object.entries(st.fatture || {}).map(([k, f]) => [k, f.numero, f.tipo, !!f.file]))); console.log('contab', JSON.stringify(st.contabilita));
  await p.click('[data-tab="documenti"]'); await p.click('[data-doc="fatture"]'); await p.waitForTimeout(300); await p.screenshot({path: '/tmp/import-fatture.png'});
  await p.click('button:has-text("Tutte")'); await p.waitForTimeout(300); await p.screenshot({path: '/tmp/import-fatture.png'}); await p.click('[data-fat] >> nth=1'); await p.waitForTimeout(300); await p.screenshot({path: '/tmp/import-fattura.png'});
  console.log('errors', errs); await b.close(); srv.close();
})();
