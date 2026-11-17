// Prova: preventivatore con voce libera (non a listino) e PDF del preventivo
const {chromium} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  const root = process.cwd();
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8766);
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({viewport: {width: 430, height: 932}, deviceScaleFactor: 2, acceptDownloads: true}); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}},
      clienti: {c1: {nome: 'Mario Rossi', indirizzo: 'Via Roma 10', citta: 'Torino', cap: '10100', telefono: '333 1234567'}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(600);
  await p.click('#gGoogle'); await p.waitForTimeout(900);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(400);
  await p.click('[data-tab="documenti"]'); await p.waitForTimeout(300);
  await p.click('[data-doc="calc"]'); await p.waitForTimeout(400);
  await p.selectOption('[data-qcli]', 'c1'); await p.dispatchEvent('[data-qcli]', 'change'); await p.waitForTimeout(200);
  await p.fill('[data-qobj]', 'Installazione climatizzatore e opere murarie'); await p.dispatchEvent('[data-qobj]', 'change');
  await p.click('[data-a="qora"]'); await p.waitForTimeout(200);
  for (const [d, q, pr] of [['Carotaggio muro portante 60 cm', '1', '90'], ['Ripristino intonaco e tinteggiatura', '1', '120']]) {
    await p.click('[data-a="qfree"]'); await p.waitForTimeout(250);
    const n = (await p.$$('[data-qf="descrizione"]')).length - 1;
    await p.fill(`[data-qf="descrizione"] >> nth=${n}`, d); await p.dispatchEvent(`[data-qf="descrizione"] >> nth=${n}`, 'change');
    await p.fill(`[data-qf="qta"] >> nth=${n}`, q); await p.dispatchEvent(`[data-qf="qta"] >> nth=${n}`, 'change');
    await p.fill(`[data-qf="listino"] >> nth=${n}`, pr); await p.dispatchEvent(`[data-qf="listino"] >> nth=${n}`, 'change'); await p.waitForTimeout(200);
  }
  const h = await p.$('h3:has-text("Lavori e accessori")'); await h.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -10));
  await p.screenshot({path: '/tmp/vl-1.png'});
  await p.click('[data-a="qsave"]'); await p.waitForTimeout(800);
  await p.click('[data-prev] >> nth=0').catch(() => {}); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 30000}), p.click('.dlg [data-a="pdf"]')]);
  await dl.saveAs('/tmp/preventivo-voce-libera.pdf');
  console.log('righe', await p.evaluate(() => Object.values(window.__store.preventivi)[0].righe.map(r => r.descrizione + ' ' + r.qta + 'x' + r.prezzo))); console.log('errors', errs); await b.close(); srv.close();
})();
