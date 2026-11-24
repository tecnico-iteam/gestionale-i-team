// Prova della scheda 📋 Tabella della contabilità (stile Excel): modifica nelle celle, ordinamento, totali, file .xlsx. Dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8786);
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
  await p.goto('http://localhost:8786/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="contab"]'); await p.waitForTimeout(500);
  await p.click('[data-consez="tabella"]'); await p.waitForTimeout(400);
  const t = async () => (await p.innerText('#app')).replace(/\s+/g, ' ');
  console.log('VENDITE:', (await t()).slice(0, 900)); await p.screenshot({path: '/home/claude/work/tabella.png'});
  // modifica una cella (imponibile della fattura f1) e spunta pagata
  const sel = '[data-tcell="fatture|f1|imponibile"]';
  await p.fill(sel, '1234.5'); await p.press(sel, 'Tab'); await p.waitForTimeout(500);
  await p.click('[data-tcell="fatture|f2|pagata"]').catch(()=>{}); await p.waitForTimeout(400);
  console.log('f1:', JSON.stringify(await p.evaluate(() => ({imp: window.__store.fatture.f1.imponibile, pag2: window.__store.fatture.f2.pagata, dp2: window.__store.fatture.f2.dataPagamento}))));
  await p.click('[data-tsort="totale"]'); await p.waitForTimeout(300); await p.click('[data-tsort="totale"]'); await p.waitForTimeout(300);
  console.log('ORDINE prima riga:', (await p.innerText('.xls tbody tr >> nth=0')).replace(/\s+/g, ' '));
  console.log('PIEDE:', (await p.innerText('.xls tfoot')).replace(/\s+/g, ' '));
  await p.click('[data-ttab="acquisti"]'); await p.waitForTimeout(300);
  console.log('ACQUISTI:', (await t()).slice(0, 600)); await p.screenshot({path: '/home/claude/work/tabella-acq.png'});
  await p.fill('[data-tcell="contabilita|a1|rif"]', 'Cantiere prova'); await p.press('[data-tcell="contabilita|a1|rif"]', 'Enter'); await p.waitForTimeout(400);
  console.log('a1 rif:', await p.evaluate(() => window.__store.contabilita.a1.rif));
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 15000}), p.click('[data-txls]')]);
  await dl.saveAs('/home/claude/work/prova.xlsx'); console.log('FILE:', dl.suggestedFilename());
  await p.click('[data-topen="contabilita|a1"]'); await p.waitForTimeout(300); console.log('Scheda aperta:', await p.isVisible('.ov'));
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  await p.click('[data-consez="spese"]'); await p.waitForTimeout(300);
  console.log('SPESE:', (await t()).slice(200, 900));
  await p.click('[data-spesecopia]'); await p.waitForTimeout(300);
  const nuove = await p.evaluate(() => Object.values(window.__store.spese).filter(x => x.data.startsWith('2026-11')).map(x => [x.descrizione, x.data, x.pagata]));
  console.log('COPIATE in novembre:', JSON.stringify(nuove));
  await p.click('[data-spesanew]'); await p.waitForTimeout(300);
  await p.selectOption('.ov [data-k="categoria"]', 'Bolli e tasse auto'); await p.fill('.ov [data-k="descrizione"]', 'Bollo Doblò'); await p.fill('.ov [data-k="importo"]', '310');
  await p.click('.ov button[type=submit]'); await p.waitForTimeout(500);
  await p.screenshot({path: '/home/claude/work/spese.png', fullPage: true});
  await p.click('[data-consez="riepilogo"]'); await p.waitForTimeout(300);
  console.log('ANALISI:', (await t()).match(/🟠 Altre spese.{0,260}/)?.[0]);
  console.log('PUNTI:', (await t()).match(/Cosa dicono i numeri.{0,330}/)?.[0]);
  await p.click('[data-consez="tabella"]'); await p.waitForTimeout(300); await p.click('[data-ttab="spese"]'); await p.waitForTimeout(300);
  console.log('TAB SPESE:', (await p.innerText('.xls')).replace(/\s+/g, ' ').slice(0, 300));
  const [dl2] = await Promise.all([p.waitForEvent('download', {timeout: 15000}), p.click('[data-txls]')]);
  await dl2.saveAs('/home/claude/work/prova2.xlsx');
  console.log('errors', errs); await b.close(); srv.close();
})();
