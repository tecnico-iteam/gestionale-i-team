// Prova: listino Würth (prezzi netti) caricato con ricarico, nel listino e nel magazzino
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, {'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/json'}); r.end(d); }); }).listen(8773);
  const b = await chromium.launch({args: ['--disable-dev-shm-usage']}); const errs = [];
  const p = await (await b.newContext({viewport: {width: 430, height: 900}, serviceWorkers: 'block'})).newPage();
  p.on("pageerror", e => errs.push(e.message)); p.on("crash", () => console.log("CRASH")); p.on("console", m => { if (m.type() === "error") console.log("console:", m.text().slice(0, 200)); });
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'}; });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('http://localhost:8773/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(600);
  await p.click('[data-tab="documenti"]'); await p.waitForTimeout(300); await p.click('[data-doc="listino"]'); await p.waitForTimeout(400); await p.click('[data-bundle="listino-wurth-2026.json"]'); await p.waitForTimeout(400);
  await p.screenshot({path: '/tmp/ts-form.png'});
  await p.fill('.ov input[type=number]', '30'); await p.click('.ov button[type=submit]'); await p.waitForTimeout(1500);
  const L = await p.evaluate(() => Object.values(window.__store.listino || {}).flatMap(c => c.items));
  console.log('listino:', L.length, 'articoli · esempio', JSON.stringify(L[0]));
  // l'importazione in magazzino di centinaia di articoli manda in crash il finto database di prova (succede anche con General): qui si prova solo il listino
  await p.click('[data-tab="documenti"]'); await p.waitForTimeout(300); await p.click('[data-doc="listino"]'); await p.waitForTimeout(500); await p.fill('[data-q]', 'avvitatore batteria'); await p.waitForTimeout(500); await p.evaluate(() => document.querySelector('[data-q]').scrollIntoView()); await p.screenshot({path: '/tmp/claude-0/-home-claude/1a0bb026-3731-507e-8f5a-b97da8a06395/scratchpad/wu-listino.png'}); await p.fill('[data-q]', 'tassello'); await p.waitForTimeout(500); await p.evaluate(() => document.querySelector('[data-q]').scrollIntoView()); await p.screenshot({path: '/tmp/claude-0/-home-claude/1a0bb026-3731-507e-8f5a-b97da8a06395/scratchpad/wu-listino2.png'});
  console.log('foto caricate:', await p.evaluate(() => [...document.querySelectorAll('img.pimg')].filter(i => i.src.includes('img/fornitori') && i.naturalWidth > 0).length));
  console.log('errori', errs); await b.close(); srv.close();
})();
