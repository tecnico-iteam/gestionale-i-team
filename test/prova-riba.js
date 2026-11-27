// Prova: N. carico e termini di pagamento (30/60/90 gg, fine mese) nella Tabella, 📅 Scadenziario incassi e pagamenti, Excel. Dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8788);
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
  await p.goto('http://localhost:8788/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="contab"]'); await p.waitForTimeout(500);
  const t = async () => (await p.innerText('#app')).replace(/\s+/g, ' ');
  await p.click('[data-consez="acquisti"]'); await p.waitForTimeout(300);
  // nuova fattura fornitore con RiBa 30/60/90
  await p.click('[data-contab="newa"]'); await p.waitForTimeout(300);
  console.log('N. registro proposto:', await p.inputValue('.ov [data-k="carico"]'));
  await p.fill('.ov [data-k="fornitore"]', 'Erre.Di'); await p.fill('.ov [data-k="numero"]', 'R77');
  await p.fill('.ov [data-k="data"]', '2026-11-10'); await p.fill('.ov [data-k="importo"]', '1000'); await p.press('.ov [data-k="importo"]', 'Tab'); await p.waitForTimeout(200);
  await p.selectOption('.ov [data-k="termini"]', '30/60/90 gg FM'); await p.waitForTimeout(400);
  const piano = await p.evaluate(() => [...document.querySelectorAll('.ov [data-k^="rata"]')].map(e => e.dataset.k + '=' + e.value));
  console.log('PIANO:', piano.join(' '), '| metodo:', await p.inputValue('.ov [data-k="metodo"]'), '| rate:', await p.inputValue('.ov [data-k="rateN"]'));
  console.log('INFO:', (await p.innerText('.ov')).match(/Le 3 rate.{0,60}|Le rate fanno.{0,80}/)?.[0]);
  // errore somma
  await p.fill('.ov [data-k="rataI2"]', '300'); await p.press('.ov [data-k="rataI2"]', 'Tab'); await p.waitForTimeout(200);
  await p.click('.ov button[type=submit]'); await p.waitForTimeout(400); console.log('Bloccato se somma sbagliata:', await p.isVisible('.ov [data-k="rataI2"]'));
  await p.fill('.ov [data-k="rataI2"]', '333.34'); await p.press('.ov [data-k="rataI2"]', 'Tab'); await p.waitForTimeout(200);
  await p.click('.ov button[type=submit]'); await p.waitForTimeout(600);
  const nuova = await p.evaluate(() => Object.values(window.__store.contabilita).find(d => d.numero === 'R77'));
  console.log('SALVATA:', JSON.stringify({carico: nuova.carico, scad: nuova.scadenza, pagata: nuova.pagata, metodo: nuova.metodo, rate: nuova.rate, extra: Object.keys(nuova).filter(k => /^rata|rateN/.test(k))}));
  console.log('ELENCO:', (await t()).match(/In ordine di numero di registro.{0,300}/)?.[0]);
  await p.click('[data-consez="scad"]'); await p.waitForTimeout(400);
  console.log('SCAD rate:', (await t()).match(/Fatt\. R77 · rata \d\/3/g));
  const b1 = await p.$('[data-scadok$="#0"]'); await b1.click(); await p.waitForTimeout(500);
  const dopo = await p.evaluate(() => Object.values(window.__store.contabilita).find(d => d.numero === 'R77'));
  console.log('DOPO RATA 1:', JSON.stringify({scad: dopo.scadenza, pagata: dopo.pagata, rate: dopo.rate.map(r => r.pagata)}));
  await p.click('[data-consez="tabella"]'); await p.waitForTimeout(300); await p.click('[data-ttab="acquisti"]'); await p.waitForTimeout(300);
  console.log('TABELLA prima riga:', (await p.innerText('.xls tbody tr >> nth=0')).replace(/\s+/g, ' ').slice(0, 160));
  await p.click('[data-consez="acquisti"]'); await p.waitForTimeout(300); await p.screenshot({path: '/home/claude/work/acquisti-reg.png'});
  console.log('errors', errs); await b.close(); srv.close();
})();
