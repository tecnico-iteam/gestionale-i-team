// Prova: foto condivisa da WhatsApp (Condividi → iTeam) salvata in un intervento
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, {'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'}); r.end(d); }); }).listen(8765);
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({viewport: {width: 430, height: 900}, serviceWorkers: 'block'}); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { const t = new Date().toISOString().slice(0, 10);
    window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {clienti: {c1: {nome: 'Rossi Mario'}}, interventi: {i1: {clienteId: 'c1', data: t, ora: '09:00', tipo: 'Installazione', tecnico: 'Andrea', stato: 'Programmato'}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  // una "foto di WhatsApp" già ricevuta dal service worker
  await p.goto('http://localhost:8765/test/vuota.html').catch(() => {});
  await p.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const bl = await new Promise(r => cv.toBlob(r, 'image/jpeg'));
    const c = await caches.open('iteam-condivisi'); await c.put(new Request('/condivisi/1'), new Response(bl, {headers: {'content-type': 'image/jpeg', 'x-nome': 'IMG-WA0001.jpg'}})); });
  await p.goto('http://localhost:8765/index.html?condividi=1'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(800);
  await p.screenshot({path: '/tmp/condividi-scelta.png'});
  console.log('finestra:', await p.evaluate(() => document.querySelector('.ov h2')?.textContent));
  await p.click('[data-condint="i1"]'); await p.waitForTimeout(1200);
  console.log('foto salvate:', JSON.stringify(await p.evaluate(() => window.__store.interventi.i1.media)));
  console.log('cache svuotata:', await p.evaluate(async () => !(await caches.keys()).includes('iteam-condivisi')));
  console.log('indirizzo pulito:', await p.evaluate(() => location.search === ''));
  console.log('errori', errs); await b.close(); srv.close();
})();
