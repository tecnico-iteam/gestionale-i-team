// Prova dei flussi principali: rapportino del tecnico -> verifica e fattura in ufficio -> pagata; preventivo -> accettato -> fattura.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8781);
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const errs = [];
const apri = async (b, u, store, vp) => {
  const p = await (await b.newContext({viewport: vp || {width: 1100, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(u.nome + ': ' + e.message)); p.on('dialog', dl => dl.accept());
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(([u, st]) => { window.__nextUser = {uid: u.uid, email: u.email, emailVerified: true, displayName: u.nome}; Object.assign(window.__store, st);
    window.__store.utenti = {[u.uid]: {email: u.email, nome: u.nome, ruolo: u.ruolo, attivo: true, ...(u.tecnico ? {tecnico: u.tecnico} : {})}}; }, [u, store]);
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8781/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  return p;
};
(async () => {
  const b = await chromium.launch();
  let store = {config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}},
    clienti: {c1: {nome: 'Mario Rossi', telefono: '333 1112222'}}, impianti: {i1: {clienteId: 'c1', tipo: 'Split', marca: 'General', gas: 'R32', caricaKg: 0.8, frequenzaMesi: 12}},
    magazzino: {m1: {descrizione: 'Staffa a muro', quantita: 10, prezzoVendita: 35, prezzoAcquisto: 15}},
    interventi: {n1: {clienteId: 'c1', impiantoId: 'i1', data: d(0), ora: '09:00', tipo: 'Manutenzione', tecnico: 'Andrea', stato: 'Programmato'}},
    preventivi: {p1: {numero: '1/2026', data: d(-5), clienteId: 'c1', stato: 'Inviato', iva: 10, oggetto: 'Clima', righe: [{descrizione: 'Split', qta: 1, prezzo: 900}]}}};
  // 1) tecnico: inizia e invia il rapportino
  const t = await apri(b, {uid: 'u3', email: 'andrea@utenti.iteamservice.it', nome: "Andrea D'Amico", ruolo: 'tecnico', tecnico: 'Andrea'}, store, {width: 400, height: 860});
  await t.click('[data-start]'); await t.waitForTimeout(500);
  await t.click('[data-rap]'); await t.waitForTimeout(500);
  await t.fill('[data-k="inizio"]', '09:00'); await t.fill('[data-k="fine"]', '11:30'); await t.dispatchEvent('[data-k="fine"]', 'change');
  await t.locator('.dlg input[type=checkbox]').first().click(); await t.waitForTimeout(300);
  const add = await t.$('button:has-text("Aggiungi materiale")'); if (add) { await add.click(); await t.waitForTimeout(200); const sel = await t.$('select[data-rk="articoloId"], [data-rows] select'); if (sel) await sel.selectOption('m1'); }
  await t.check('[data-k="clienteAssente"]').catch(() => {}); await t.waitForTimeout(200);
  await t.screenshot({path: '/tmp/flusso-rap.png', fullPage: true});
  await t.click('button[type=submit]'); await t.waitForTimeout(900);
  store = await t.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const n1 = store.interventi.n1; console.log('rapportino inviato:', n1.stato, !!n1.rapportino, 'minuti', n1.rapportino && n1.rapportino.minutiLavoro, 'materiali', JSON.stringify(n1.rapportino && n1.rapportino.materiali), 'magazzino', store.magazzino.m1.quantita);
  // 2) ufficio: verifica, crea fattura, segna pagata; preventivo accettato -> fattura
  const u = await apri(b, {uid: 'u1', email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin'}, store);
  await u.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await u.waitForTimeout(300);
  await u.click('[data-tab="interventi"]'); await u.click('[data-intf="verifica"]'); await u.waitForTimeout(300);
  await u.click('[data-int]'); await u.waitForTimeout(300); await u.click('.ov [data-a="ver"]'); await u.waitForTimeout(500);
  await u.click('[data-intf="completati"]'); await u.click('[data-int]'); await u.waitForTimeout(300);
  const fb = await u.$('.ov [data-a="fat"]'); if (fb) { await fb.click(); await u.waitForTimeout(400); await u.screenshot({path: '/tmp/flusso-fat.png'}); const co = await u.$('.ov button:has-text("Continua")'); if (co) { await co.click(); await u.waitForTimeout(400); } await u.click('button[type=submit]'); await u.waitForTimeout(600); } else console.log('manca pulsante fattura');
  await u.click('[data-tab="documenti"]'); await u.click('[data-doc="preventivi"]'); await u.waitForTimeout(300);
  await u.click('[data-prev]'); await u.waitForTimeout(300); const acc = await u.$('.ov [data-a="acc"]'); if (acc) { await acc.click(); await u.waitForTimeout(500); } else console.log('manca Accettato');
  await u.click('[data-prev]'); await u.waitForTimeout(300); const pf = await u.$('.ov [data-a="fat"]'); if (pf) { await pf.click(); await u.waitForTimeout(400); const c2 = await u.$('.ov button:has-text("Continua")'); if (c2) { await c2.click(); await u.waitForTimeout(400); } await u.click('button[type=submit]'); await u.waitForTimeout(600); } else console.log('manca fattura da preventivo');
  await u.click('[data-doc="fatture"]'); await u.waitForTimeout(300); const pg = await u.$('[data-paga]'); if (pg) { await pg.click(); await u.waitForTimeout(500); }
  const st = await u.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  console.log('verificato:', st.interventi.n1.verificato, '| preventivo:', st.preventivi.p1.stato, '| fatture:', JSON.stringify(Object.values(st.fatture || {}).map(f => [f.numero, f.imponibile, f.pagata, f.interventoId || f.preventivoId || ''])));
  await u.screenshot({path: '/tmp/flusso-fatture.png'});
  console.log('errors', errs); await b.close(); srv.close();
})();
