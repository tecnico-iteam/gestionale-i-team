// Prova: N. carico e termini di pagamento (30/60/90 gg, fine mese) nella Tabella, 📅 Scadenziario incassi e pagamenti, Excel. Dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8787);
const cli = {}, fat = {}, con = {}; const F = ['Erre Di srl','Doppler','Sacchi Giuseppe','Albergo Prova','Wind Tre','Carrozzeria Prova','Doppler SRL','Lasi Massimo'];
for (let i = 1; i <= 12; i++) cli['c' + i] = {nome: 'Cliente Prova ' + i};
let n = 1; for (let m = 1; m <= 11; m++) for (let k = 0; k < 4; k++) { const imp = 300 + ((m * 7 + k * 13) % 9) * 900; fat['f' + n] = {clienteId: 'c' + (1 + (n % 12)), numero: n + '/2026', data: `2026-${String(m).padStart(2,'0')}-${String(3 + k * 6).padStart(2,'0')}`, imponibile: imp, iva: k % 3 ? '22' : '0', pagata: n % 9 !== 0, tipo: 'Fattura'}; n++; }
fat.nc = {clienteId: 'c2', numero: n + '/2026', data: '2026-03-10', imponibile: -500, iva: '22', pagata: true, tipo: 'Nota di credito'};
let j = 1; for (let m = 1; m <= 11; m++) for (let k = 0; k < 5; k++) { con['a' + j] = {tipo: 'Fattura fornitore', fornitore: F[(j * 3) % F.length], numero: 'X' + j, data: `2026-${String(m).padStart(2,'0')}-${String(2 + k * 5).padStart(2,'0')}`, importo: 200 + ((m * 5 + k * 11) % 8) * 700, pagata: j % 6 !== 0}; j++; }
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 1300, height: 900}, acceptDownloads: true, deviceScaleFactor: 2})).newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: /xlsx/.test(r.request().url()) ? '/tmp/node_modules/xlsx/dist/xlsx.full.min.js' : '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(d => { window.__nextUser = {uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'};
    Object.assign(window.__store, {...d, utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}}}); }, {clienti: cli, fatture: fat, contabilita: con, spese: {s1: {data: '2026-10-27', categoria: 'Stipendi', descrizione: 'Stipendio ottobre', beneficiario: 'Mario Rossi', importo: 1800, pagata: true, ricorrente: true}, s2: {data: '2026-10-16', categoria: 'Contributi e F24', descrizione: 'F24 ottobre', importo: 2400, pagata: true}, s3: {data: '2026-03-10', categoria: 'Assicurazioni', descrizione: 'RCA furgone', importo: 1100, pagata: true}}});
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8787/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="contab"]'); await p.waitForTimeout(500);
  const t = async () => (await p.innerText('#app')).replace(/\s+/g, ' ');
  await p.click('[data-consez="tabella"]'); await p.waitForTimeout(400);
  console.log('TESTATA VENDITE:', (await p.innerText('.xls thead')).replace(/\s+/g, ' '));
  await p.fill('[data-tcell="fatture|f1|carico"]', '101'); await p.press('[data-tcell="fatture|f1|carico"]', 'Tab'); await p.waitForTimeout(300);
  await p.selectOption('[data-tcell="fatture|f1|termini"]', '60 gg FM'); await p.waitForTimeout(500);
  console.log('f1:', JSON.stringify(await p.evaluate(() => { const f = window.__store.fatture.f1; return [f.carico, f.data, f.termini, f.scadenza]; })));
  await p.click('[data-ttab="acquisti"]'); await p.waitForTimeout(300);
  await p.selectOption('[data-tcell="contabilita|a1|termini"]', '30 gg'); await p.waitForTimeout(300);
  await p.selectOption('[data-tcell="contabilita|a1|metodo"]', 'RiBa'); await p.waitForTimeout(400);
  console.log('a1:', JSON.stringify(await p.evaluate(() => { const f = window.__store.contabilita.a1; return [f.data, f.termini, f.scadenza, f.metodo, f.pagata]; })));
  await p.click('[data-consez="scad"]'); await p.waitForTimeout(500);
  console.log('SCAD:', (await t()).match(/⬇ Da incassare.{0,700}/)?.[0]);
  await p.screenshot({path: '/home/claude/work/scadenziario.png', fullPage: true});
  const ok = await p.$('[data-scadok^="contabilita|a1"]'); if (ok) { await ok.click(); await p.waitForTimeout(500); }
  console.log('a1 pagata:', await p.evaluate(() => [window.__store.contabilita.a1.pagata, window.__store.contabilita.a1.pagataIl]));
  await p.click('[data-scadf="in"]'); await p.waitForTimeout(300); console.log('SOLO INCASSI pagamenti visibili:', (await t()).includes('⬆ Pagamento'));
  await p.check('[data-scadfatti]'); await p.waitForTimeout(300); console.log('Con fatti:', (await t()).match(/✓ Incassati e pagati.{0,60}/)?.[0]);
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 15000}), p.click('[data-a="scadxls"]')]);
  await dl.saveAs('/home/claude/work/scad.xlsx'); console.log('FILE ok');
  await p.click('[data-scadf="tutto"]'); await p.waitForTimeout(200);
  // nuova fattura: carico proposto e scadenza dai termini
  await p.click('[data-consez="vendite"]'); await p.waitForTimeout(300);
  console.log('errors', errs); await b.close(); srv.close();
})();
