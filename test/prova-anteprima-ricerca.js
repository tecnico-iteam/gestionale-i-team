// Prova: nel preventivatore la ricerca trova anche gli articoli di magazzino, e l'anteprima mostra il PDF senza salvarlo
const {chromium} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  const root = process.cwd();
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8767);
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 1100, height: 1000}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}},
      clienti: {c1: {nome: 'Mario Rossi', indirizzo: 'Via Roma 10', citta: 'Torino'}},
      magazzino: {m1: {descrizione: 'Pompa scarico condensa Sauermann Si-30', codice: 'SI30', categoria: 'Accessori', quantita: 4, unita: 'pz', prezzoVendita: 95, prezzoAcquisto: 52},
                  m2: {descrizione: 'Tubo rame 1/4 coibentato rotolo 25 m', codice: 'TR14', categoria: 'Rame', quantita: 2, unita: 'rotoli', prezzoVendita: 120}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('http://localhost:8767/index.html'); await p.waitForTimeout(600);
  await p.click('#gGoogle'); await p.waitForTimeout(900);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(400);
  await p.click('[data-tab="documenti"]'); await p.waitForTimeout(300);
  await p.click('[data-doc="calc"]'); await p.waitForTimeout(400);
  await p.selectOption('[data-qcli]', 'c1'); await p.dispatchEvent('[data-qcli]', 'change'); await p.waitForTimeout(500);
  await p.click('input[placeholder^="🔍 Cerca in tutti"]'); await p.keyboard.type('pompa', {delay: 60}); await p.waitForTimeout(900);
  console.log('debug', await p.evaluate(() => [window.__store.magazzino && Object.keys(window.__store.magazzino).length, document.querySelectorAll('[data-q]').length, document.activeElement.outerHTML.slice(0,120), document.querySelector('input[placeholder^="🔍 Cerca in tutti"]')?.value, document.body.innerText.includes('Pompa scarico condensa Sauermann')])); console.log('ERR', errs); console.log('trovati in magazzino:', await p.$$eval('[data-qmag]', l => l.length));
  await p.screenshot({path: '/tmp/ar-ricerca.png'});
  await p.click('[data-qmag] >> nth=0'); await p.waitForTimeout(300);
  await p.setInputFiles('input[data-qimg="0"]', 'icons/icon-192.png'); await p.waitForTimeout(800);
  console.log('foto voce cambiata:', await p.evaluate(() => (document.querySelector('.qimg img') || {}).src?.slice(0, 22)));
  await p.click('[data-a="qprev"]'); await p.waitForTimeout(2500);
  await p.fill('.pv-mid textarea', 'Pompa scarico condensa Sauermann Si-30 installata a vista'); await p.dispatchEvent('.pv-mid textarea', 'input'); await p.fill('.pv-mid [data-qf="qta"]', '2'); await p.dispatchEvent('.pv-mid [data-qf="qta"]', 'input'); await p.waitForTimeout(300);
  console.log('anteprima aperta:', !!(await p.$('.pv-sheet')), 'totale:', await p.textContent('[data-pvsum] .big'), 'preventivi salvati:', await p.evaluate(() => Object.keys(window.__store.preventivi || {}).length));
  await p.screenshot({path: '/tmp/ar-anteprima.png'});
  await p.click('[data-a="qok"]'); await p.waitForTimeout(800);
  console.log('dopo "Crea":', await p.evaluate(() => Object.values(window.__store.preventivi || {}).map(x => x.numero + ' ' + x.righe.map(r => r.descrizione + ' ' + r.prezzo).join(' | '))));
  console.log('errors', errs); await b.close(); srv.close();
})();
