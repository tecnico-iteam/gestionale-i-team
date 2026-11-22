// Prova di cestino e registro delle modifiche, e dei permessi di eliminazione. Dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8787);
const dati = {clienti: {c1: {nome: 'Cliente Prova'}, c2: {nome: 'Altro Prova'}}, interventi: {x1: {clienteId: 'c1', data: '2026-11-25', ora: '09:00', tipo: 'Manutenzione', tecnico: 'Mario Rossi', stato: 'Programmato'}},
  preventivi: {p1: {clienteId: 'c1', numero: '1/2026', data: '2026-11-01', stato: 'Bozza', righe: []}}, listino: {l1: {descrizione: 'Split', prezzo: 500}},
  utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}, u2: {email: 'mario@utenti.iteamservice.it', nome: 'Mario Rossi', ruolo: 'tecnico', attivo: true, tecnico: 'Mario Rossi'}},
  config: {impostazioni: {tecnici: ['Mario Rossi']}}};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const apri = async user => { const p = await (await b.newContext({viewport: {width: 420, height: 900}})).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
    await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
    await p.addInitScript({path: 'test/fbmock.js'});
    await p.addInitScript(([d, u]) => { window.__nextUser = u; Object.assign(window.__store, JSON.parse(JSON.stringify(d))); }, [dati, user]);
    await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
    await p.goto('http://localhost:8787/index.html'); await p.waitForTimeout(400); await p.click('#gGoogle'); await p.waitForTimeout(900); return p; };
  // tecnico: niente elimina, niente preventivi/listino
  const t = await apri({uid: 'u2', email: 'mario@utenti.iteamservice.it', emailVerified: true, displayName: 'Mario Rossi'});
  console.log('Tecnico vede preventivi/listino caricati:', await t.evaluate(() => [typeof S !== 'undefined' ? 'S' : '-'] ));
  const tx = await t.evaluate(() => { try { return [S.preventivi.length, S.listino.length]; } catch(e) { return 'n/d'; } }); console.log('Tecnico S.preventivi/listino:', tx);
  await t.click('[data-int="x1"]').catch(() => {}); await t.waitForTimeout(300);
  const edit = await t.$('.ov [data-a="edit"]'); if (edit) { await edit.click(); await t.waitForTimeout(300); }
  console.log('Tecnico ha il pulsante Elimina:', await t.isVisible('.ov [data-a="del"], .ov button.bad >> text=Elimina').catch(() => false));
  // titolare
  const p = await apri({uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'});
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="clienti"]'); await p.waitForTimeout(300); await p.click('[data-cli="c2"]'); await p.waitForTimeout(300);
  await p.click('[data-a="editcli"]'); await p.waitForTimeout(300); await p.fill('.ov [data-k="nome"]', 'Altro Prova srl'); await p.click('.ov button[type=submit]'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  await p.click('[data-a="editcli"]'); await p.waitForTimeout(300);
  await p.click('.ov [data-a="del"]'); await p.waitForTimeout(300); await p.click('.ov [data-a="ok"]').catch(e => console.log('no ok')); await p.waitForTimeout(600);
  console.log('Cestino:', JSON.stringify(Object.values(await p.evaluate(() => window.__store.cestino || {})).map(c => [c.col, c.docId, c.titolo, c.chi])));
  console.log('Registro:', JSON.stringify(Object.values(await p.evaluate(() => window.__store.registro || {})).map(r => [r.azione, r.col, r.titolo, r.chi, r.campi])));
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="cestino"]'); await p.waitForTimeout(600);
  console.log('Pagina:', (await p.innerText('#app')).replace(/\s+/g, ' ').slice(0, 400));
  await p.click('[data-cestrip]'); await p.waitForTimeout(500);
  console.log('Ripristinato:', JSON.stringify(await p.evaluate(() => [window.__store.clienti.c2, Object.keys(window.__store.cestino || {}).length])));
  await p.click('[data-cestt="registro"]'); await p.waitForTimeout(300);
  console.log('Registro pagina:', (await p.innerText('#app')).replace(/\s+/g, ' ').slice(0, 500));
  await p.screenshot({path: '/tmp/registro.png', fullPage: true});
  console.log('errors', errs); await b.close(); srv.close();
})();
