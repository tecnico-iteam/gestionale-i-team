// Prova dei dati riservati: prezzi d'acquisto, documenti commesse non condivisi, rubrica clienti recenti. Dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8788);
const oggi = new Date().toISOString().slice(0, 10);
const dati = {clienti: {c1: {nome: 'Cliente Nuovo'}, c2: {nome: 'Cliente Vecchio', importatoIl: '2025-01-01'}},
  interventi: {x1: {clienteId: 'c1', data: oggi, ora: '09:00', tipo: 'Manutenzione', tecnico: 'Mario Rossi', stato: 'Programmato'}},
  magazzino: {m1: {descrizione: 'Split 9000', quantita: 3, prezzoAcquisto: 300, prezzoListino: 800, sconto: 40, prezzoVendita: 480}},
  commesse: {k1: {clienteId: 'c1', numero: '2026/1', titolo: 'Cantiere', descrizione: 'nota interna', stato: 'Aperta',
    documenti: [{id: 'd1', nome: 'pianta.pdf', url: 'https://x/1', condiviso: true}, {id: 'd2', nome: 'contratto.pdf', url: 'https://x/2', condiviso: false}]}},
  utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}, u2: {email: 'mario@utenti.iteamservice.it', nome: 'Mario Rossi', ruolo: 'tecnico', attivo: true, tecnico: 'Mario Rossi'}},
  config: {impostazioni: {tecnici: ['Mario Rossi']}}};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const apri = async (user, store) => { const p = await (await b.newContext({viewport: {width: 420, height: 900}})).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
    await p.addInitScript({path: 'test/fbmock.js'});
    await p.addInitScript(([d, u]) => { window.__nextUser = u; Object.assign(window.__store, JSON.parse(JSON.stringify(d))); }, [store, user]);
    await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
    await p.goto('http://localhost:8788/index.html'); await p.waitForTimeout(400); await p.click('#gGoogle'); await p.waitForTimeout(3500); return p; };
  const p = await apri({uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'}, dati);
  const st = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  console.log('Magazzino pubblico:', JSON.stringify(st.magazzino.m1));
  console.log('Prezzi riservati:', JSON.stringify(st.magazzinoPrezzi));
  console.log('Commessa pubblica:', JSON.stringify(st.commesse.k1));
  console.log('Commessa riservata:', JSON.stringify(st.commesseRiservate));
  console.log('Clienti:', JSON.stringify(Object.fromEntries(Object.entries(st.clienti).map(([k, v]) => [k, v.recente]))));
  console.log('Titolare vede in app:', JSON.stringify(await p.evaluate(() => (S => [S.magazzino[0].prezzoAcquisto, S.commesse[0].documenti.length, S.commesse[0].descrizione, S.clienti.length])(window.__S))));
  // il titolare cambia lo sconto da app: deve finire nei riservati
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  const t = await apri({uid: 'u2', email: 'mario@utenti.iteamservice.it', emailVerified: true, displayName: 'Mario Rossi'}, st);
  console.log('Tecnico vede in app:', JSON.stringify(await t.evaluate(() => (S => [S.magazzino[0].prezzoAcquisto, S.magazzino[0].prezzoVendita, S.commesse[0].documenti.map(d => d.nome), S.commesse[0].descrizione, S.clienti.map(c => c.nome)])(window.__S))));
  console.log('errors', errs); await b.close(); srv.close();
})();
