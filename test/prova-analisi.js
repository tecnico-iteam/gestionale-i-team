// Prova della pagina 📊 Analisi della contabilità con dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8784);
const cli = {}, fat = {}, con = {}; const F = ['Erre Di srl','Doppler','Sacchi Giuseppe','Albergo Prova','Wind Tre','Carrozzeria Prova','Doppler SRL','Lasi Massimo'];
for (let i = 1; i <= 12; i++) cli['c' + i] = {nome: 'Cliente Prova ' + i};
let n = 1; for (let m = 1; m <= 11; m++) for (let k = 0; k < 4; k++) { const imp = 300 + ((m * 7 + k * 13) % 9) * 900; fat['f' + n] = {clienteId: 'c' + (1 + (n % 12)), numero: n + '/2026', data: `2026-${String(m).padStart(2,'0')}-${String(3 + k * 6).padStart(2,'0')}`, imponibile: imp, iva: k % 3 ? '22' : '0', pagata: n % 9 !== 0, tipo: 'Fattura'}; n++; }
fat.nc = {clienteId: 'c2', numero: n + '/2026', data: '2026-03-10', imponibile: -500, iva: '22', pagata: true, tipo: 'Nota di credito'};
let j = 1; for (let m = 1; m <= 11; m++) for (let k = 0; k < 5; k++) { con['a' + j] = {tipo: 'Fattura fornitore', fornitore: F[(j * 3) % F.length], numero: 'X' + j, data: `2026-${String(m).padStart(2,'0')}-${String(2 + k * 5).padStart(2,'0')}`, importo: 200 + ((m * 5 + k * 11) % 8) * 700, pagata: j % 6 !== 0}; j++; }
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 420, height: 900}, deviceScaleFactor: 2})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(d => { window.__nextUser = {uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'};
    Object.assign(window.__store, {...d, utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}}}); }, {clienti: cli, fatture: fat, contabilita: con});
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8784/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="contab"]'); await p.waitForTimeout(500);
  console.log((await p.innerText('#app')).replace(/\s+/g, ' ').slice(0, 1500));
  await p.screenshot({path: '/tmp/analisi.png', fullPage: true});
  for (const sez of ['vendite','acquisti']) { await p.click(`[data-consez="${sez}"]`); await p.waitForTimeout(300); console.log('--', sez, (await p.innerText('#app')).replace(/\s+/g,' ').slice(0, 700)); await p.click('[data-conmese="03"]'); await p.waitForTimeout(300); console.log('-- marzo', (await p.innerText('#app')).replace(/\s+/g,' ').slice(0, 500)); await p.screenshot({path:`/tmp/con-${sez}.png`}); await p.click('[data-conmese=""]'); }
  await p.click('[data-contabd="a1"]'); await p.waitForTimeout(300);
  console.log('Campo tipo:', await p.isVisible('.ov [data-k="categoria"]'));
  console.log('errors', errs); await b.close(); srv.close();
})();
