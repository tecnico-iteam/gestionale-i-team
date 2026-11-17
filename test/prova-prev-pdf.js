const {chromium} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  const root = process.cwd();
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8765);
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({viewport: {width: 1280, height: 900}, acceptDownloads: true}); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {
      config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}},
      clienti: {c1: {nome: 'Mario Rossi', indirizzo: 'Via Roma 10', citta: 'Torino', cap: '10100', telefono: '333 1234567', email: 'mario.rossi@email.it'}},
      preventivi: {p1: {numero: '2026/045', data: '2026-11-17', validita: 30, clienteId: 'c1', stato: 'Bozza', iva: 10, sconto: 0,
        oggetto: 'Fornitura e posa climatizzatore monosplit 9000 BTU',
        righe: [
          {descrizione: 'ASHH09KJCAL+AOHH09KJCA - Set Parete Serie Performance E Design General Fujitsu 2,5 kW', qta: 1, prezzo: 1290, img: 'img/p004_839557.jpg', codice: 'ASHH09KJCAL'},
          {descrizione: 'Staffa a muro per unità esterna', qta: 1, prezzo: 35},
          {descrizione: 'Tubo rame coibentato 1/4 - 3/8 (al metro)', qta: 5, prezzo: 14},
          {descrizione: 'Installazione monosplit (fino a 3 m di linee)', qta: 1, prezzo: 380},
          {descrizione: 'Smaltimento imballi e collaudo', qta: 1, prezzo: 0}],
        note: 'Pagamento: 50% all\'ordine, saldo a fine lavori. Tempi di installazione: entro 15 giorni dalla conferma. Garanzia: 2 anni sul prodotto e sull\'installazione.'}}
    }); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(600);
  await p.click('#gGoogle'); await p.waitForTimeout(900);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(400);
  await p.click('[data-tab="documenti"]'); await p.waitForTimeout(400);
  await p.click('[data-prev="p1"]'); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 60000}).catch(async e => { await p.screenshot({path:'/tmp/dbg.png'}); console.log('toast:', await p.$$eval('.toast', l => l.map(x => x.textContent))); throw e; }), p.click('.dlg [data-a="pdf"]')]);
  await dl.saveAs('/tmp/preventivo-esempio.pdf');
  console.log('ok', errs); await b.close(); srv.close();
})();
