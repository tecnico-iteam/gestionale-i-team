// Giro completo: apre tutte le pagine, schede, dettagli e moduli per ogni ruolo con dati finti; raccoglie gli errori.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, {'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : 'text/html'}); r.end(e ? '' : d); }); }).listen(8780);
const OUT = '/tmp/giro'; fs.mkdirSync(OUT, {recursive: true});
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const DATI = {
  config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}, {nome: 'Maurizio', codice: 'T02'}, {nome: 'Alessandro', codice: 'T03'}], postazioni: ['Tommy', 'Irene']}},
  clienti: {c1: {nome: 'Mario Rossi', telefono: '333 1112222', email: 'mario@x.it', indirizzo: 'Via Roma 1', citta: 'Torino', cap: '10100'},
            c2: {nome: 'Condominio Aurora', tipo: 'Azienda', piva: '01234567890', telefono: '011 555555', citta: 'Moncalieri'},
            c3: {nome: 'Vecchio Cliente', importatoIl: d(-40)}},
  impianti: {i1: {clienteId: 'c1', tipo: 'Split', marca: 'General', modello: 'ASHH09', gas: 'R32', caricaKg: 0.8, prossimaManutenzione: d(5), frequenzaMesi: 12},
             i2: {clienteId: 'c2', tipo: 'VRF', marca: 'Daikin', modello: 'RXYQ', gas: 'R410A', caricaKg: 12, potenzaKw: 28, prossimaManutenzione: d(-3)}},
  interventi: {
    n1: {clienteId: 'c1', impiantoId: 'i1', data: d(0), ora: '09:00', tipo: 'Manutenzione', tecnico: 'Andrea', stato: 'Programmato', descrizione: 'Pulizia filtri', promemoria: true},
    n2: {clienteId: 'c2', impiantoId: 'i2', data: d(1), ora: '14:00', tipo: 'Riparazione', tecnico: 'Maurizio', tecnico2: 'Andrea', stato: 'Programmato'},
    n3: {clienteId: 'c1', data: d(-2), ora: '10:00', tipo: 'Installazione', tecnico: 'Andrea', stato: 'Completato', verificato: false,
         rapportino: {inizio: '10:00', fine: '13:00', minutiLavoro: 180, viaggioMin: 30, lavori: ['Installazione'], materiali: [{descrizione: 'Staffa', qta: 1}], esito: 'Risolto', inviato: d(-2) + 'T13:00:00Z', tecnico: 'Andrea'}},
    n4: {clienteId: 'c2', data: d(3), dataFine: d(17), cantiere: true, giorniLav: '5', ora: '08:00', oraDa: '08:00', oraFine: '17:00', tipo: 'Installazione', tecnico: 'Alessandro', stato: 'Programmato'},
    n5: {clienteId: 'c1', data: d(2), ora: '', tipo: 'Sopralluogo', tecnico: '', stato: 'Programmato'}},
  preventivi: {p1: {numero: '1/2026', data: d(-5), clienteId: 'c1', stato: 'Inviato', iva: 10, oggetto: 'Climatizzatore', righe: [{descrizione: 'Split 9000', qta: 1, prezzo: 900, costo: 500}, {descrizione: 'Installazione', qta: 1, prezzo: 300}]}},
  fatture: {f1: {numero: '1/2026', data: d(-40), scadenza: d(-10), clienteId: 'c1', stato: 'Da pagare', iva: 10, imponibile: 120, descrizione: 'Manutenzione'},
            f2: {numero: '2/2026', data: d(-3), scadenza: d(27), clienteId: 'c2', stato: 'Pagata', pagata: true, iva: 22, imponibile: 160, descrizione: 'Riparazione'}},
  magazzino: {m1: {descrizione: 'Tubo rame 1/4', codice: 'TR14', categoria: 'Rame', quantita: 1, scortaMin: 5, unita: 'rotoli', prezzoAcquisto: 40, prezzoVendita: 70, fornitore: 'Sacchi', furgoni: {Andrea: 2}},
              m2: {descrizione: 'Staffa a muro', codice: 'ST1', categoria: 'Accessori', quantita: 10, prezzoVendita: 35}},
  contratti: {k1: {clienteId: 'c2', descrizione: 'Manutenzione annuale VRF', canone: 600, inizio: d(-300), fine: d(65), visite: 2, stato: 'Attivo'}},
  ordini: {o1: {fornitore: 'Sacchi', data: d(-1), stato: 'Da inviare', righe: [{descrizione: 'Tubo rame 1/4', qta: 5, artId: 'm1'}]}},
  commesse: {cm1: {clienteId: 'c2', nome: 'Impianto VRF palazzina', stato: 'Aperta', note: 'Lavori fase 1'}},
  dico: {dc1: {clienteId: 'c1', data: d(-2), numero: '1/2026', impianto: 'Climatizzazione'}}
};
const UTENTI = {
  admin: {uid: 'u1', email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin'},
  irene: {uid: 'u2', email: 'irene@utenti.iteamservice.it', nome: 'Irene Cavicchio', ruolo: 'ufficio', postazione: 'Irene'},
  andrea: {uid: 'u3', email: 'andrea@utenti.iteamservice.it', nome: 'Andrea D\'Amico', ruolo: 'tecnico', tecnico: 'Andrea'},
  alessandro: {uid: 'u4', email: 'alessandro@utenti.iteamservice.it', nome: 'Alessandro Doleatti', ruolo: 'tecnico_preventivatore', tecnico: 'Alessandro'},
  prev: {uid: 'u5', email: 'luca@utenti.iteamservice.it', nome: 'Luca Prev', ruolo: 'preventivatore'}
};
const problemi = [];
const nota = (chi, dove, cosa) => { problemi.push(`[${chi}] ${dove}: ${cosa}`); };
async function apri(b, chi, vp) {
  const u = UTENTI[chi];
  const p = await (await b.newContext({viewport: vp || {width: 1200, height: 900}, acceptDownloads: true})).newPage();
  p.__where = 'avvio';
  p.on('pageerror', e => nota(chi, p.__where, 'ERRORE JS ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text())) nota(chi, p.__where, 'console ' + m.text().slice(0, 200)); });
  await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({path: '/tmp/node_modules/jspdf/dist/jspdf.umd.min.js', contentType: 'text/javascript'}));
  await p.route(/^https:\/\/(?!cdnjs)/, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(([u, dati]) => { window.__nextUser = {uid: u.uid, email: u.email, emailVerified: true, displayName: u.nome};
    Object.assign(window.__store, JSON.parse(JSON.stringify(dati)));
    window.__store.utenti = {[u.uid]: {email: u.email, nome: u.nome, ruolo: u.ruolo, attivo: true, ...(u.postazione ? {postazione: u.postazione} : {}), ...(u.tecnico ? {tecnico: u.tecnico} : {})}}; }, [u, DATI]);
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8780/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(1000);
  return p;
}
let n = 0;
const foto = async (p, chi, nome) => { await p.screenshot({path: `${OUT}/${String(++n).padStart(3, '0')}-${chi}-${nome}.png`}); };
const chiudi = async p => { await p.evaluate(() => document.querySelectorAll('.acc-ov,.fb-ov,#accOv,#pwdOv').forEach(o => o.remove())); for (const b of await p.$$('button:has-text("Chiudi")')) { try { if (await b.isVisible()) await b.click({timeout: 800}); } catch(e){} } for (let i = 0; i < 3 && await p.$('.ov'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); const ov = await p.$('.ov'); if (ov) await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove())); } };
const clic = async (p, chi, sel, nome, opz = {}) => {
  p.__where = nome; const el = await p.$(sel);
  if (!el) { if (!opz.facoltativo) nota(chi, nome, 'manca ' + sel); return false; }
  try { await el.click({timeout: 3000}); } catch (e) { nota(chi, nome, 'clic non riuscito su ' + sel + ': ' + e.message.split('\n')[0]); return false; }
  await p.waitForTimeout(opz.attesa || 350); if (opz.foto !== false) await foto(p, chi, nome.replace(/\W+/g, '_'));
  return true;
};
// apre il primo elemento di ogni tipo nella pagina e prova "Modifica"
const dettagli = async (p, chi, dove) => {
  for (const s of ['[data-int]', '[data-cli]', '[data-imp]', '[data-prev]', '[data-fat]', '[data-art]', '[data-dico]']) {
    const els = await p.$$(s); if (!els.length) continue;
    if (await clic(p, chi, s, `${dove} apri ${s}`, {facoltativo: true})) {
      if (await p.$('.ov [data-a="edit"]')) { await clic(p, chi, '.ov [data-a="edit"]', `${dove} modifica ${s}`, {facoltativo: true}); }
      await chiudi(p);
    }
  }
};
(async () => {
  const b = await chromium.launch();
  // ---------- UFFICIO (titolare)
  for (const chi of ['admin', 'irene']) {
    const p = await apri(b, chi);
    await clic(p, chi, '[data-mode="ufficio"]', 'entra ufficio', {facoltativo: true});
    for (const tab of ['oggi', 'calendario', 'interventi', 'clienti', 'documenti', 'magazzino', 'altro']) {
      if (!await clic(p, chi, `[data-tab="${tab}"]`, 'tab ' + tab)) continue;
      if (tab === 'interventi') for (const f of ['oggi', 'prossimi', 'verifica', 'aperti', 'completati', 'tutti', 'ore']) { await clic(p, chi, `[data-intf="${f}"]`, 'interventi ' + f, {facoltativo: true}); await dettagli(p, chi, 'interventi ' + f); }
      else if (tab === 'documenti') for (const f of ['calc', 'preventivi', 'fatture', 'dico', 'listino']) { await clic(p, chi, `[data-doc="${f}"]`, 'documenti ' + f, {facoltativo: true}); await dettagli(p, chi, 'documenti ' + f); }
      else if (tab === 'calendario') { await clic(p, chi, '[data-calv="mese"]', 'cal mese'); await clic(p, chi, '[data-cald]', 'cal giorno', {facoltativo: true}); await chiudi(p); await clic(p, chi, '[data-calv="settimana"]', 'cal settimana'); await clic(p, chi, '[data-calmv="1"]', 'cal avanti'); await dettagli(p, chi, 'calendario'); }
      else if (tab === 'altro') { const ks = await p.$$eval('[data-altro]', l => l.map(x => x.dataset.altro)); for (const k of ks) { await clic(p, chi, `[data-altro="${k}"]`, 'gestione ' + k); await dettagli(p, chi, 'gestione ' + k); await chiudi(p); await clic(p, chi, '[data-altro=""]', 'torna a Gestione', {foto: false}); } }
      else await dettagli(p, chi, 'tab ' + tab);
      for (const a of ['newint', 'newcli', 'newprev', 'newimp', 'newart', 'newdico']) if (await p.$(`[data-a="${a}"]`)) { await clic(p, chi, `[data-a="${a}"]`, `${tab} nuovo ${a}`); await chiudi(p); }
      if (await p.$('.fab')) { await clic(p, chi, '.fab', `${tab} pulsante +`); await chiudi(p); }
    }
    for (const h of ['#hqr', '#hguida', '#htec', '#hset', '#hacc', '#hpwd']) if (await p.$(h + ':not([hidden])')) { await clic(p, chi, h, 'intestazione ' + h); await chiudi(p); }
    // ricerca
    await chiudi(p); await clic(p, chi, '[data-tab="clienti"]', 'ricerca clienti'); const q = await p.$('input[data-q]');
    if (q) { await q.click(); await p.keyboard.type('ross', {delay: 40}); await p.waitForTimeout(400); const v = await p.$eval('input[data-q]', e => e.value); if (v !== 'ross') nota(chi, 'ricerca clienti', 'la casella di ricerca non tiene il testo: "' + v + '"'); }
    await p.close();
  }
  // ---------- TECNICO
  for (const chi of ['andrea', 'alessandro']) {
    const p = await apri(b, chi, {width: 400, height: 860});
    await clic(p, chi, '[data-mode="tecnico"]', 'entra tecnico', {facoltativo: true});
    for (const f of ['oggi', 'prossimi', 'inviati', 'cal', 'cli', 'furgone']) { await clic(p, chi, `[data-tecf="${f}"]`, 'tecnico ' + f, {facoltativo: f !== 'oggi'}); await dettagli(p, chi, 'tecnico ' + f); }
    await clic(p, chi, '[data-tecf="oggi"]', 'tecnico oggi', {foto: false});
    if (await clic(p, chi, '[data-int]', 'tecnico apre intervento', {facoltativo: true})) {
      await clic(p, chi, '.ov [data-start], .ov [data-a="start"]', 'tecnico inizia', {facoltativo: true}); await chiudi(p);
      await clic(p, chi, '[data-int]', 'tecnico riapre', {facoltativo: true});
      await clic(p, chi, '.ov [data-rap], .ov [data-a="rap"]', 'tecnico rapportino', {facoltativo: true}); await chiudi(p);
    }
    if (chi === 'alessandro') { await clic(p, chi, '[data-mode="comm"], #hmode', 'alessandro cambia area', {facoltativo: true}); await clic(p, chi, '[data-mode="comm"]', 'alessandro preventivatore', {facoltativo: true}); }
    await p.close();
  }
  // ---------- PREVENTIVATORE
  { const chi = 'prev'; const p = await apri(b, chi, {width: 400, height: 860}); await foto(p, chi, 'home');
    for (const s of ['[data-doc="calc"]', '[data-doc="preventivi"]', '[data-doc="listino"]', '[data-tab="clienti"]']) await clic(p, chi, s, 'prev ' + s, {facoltativo: true});
    await dettagli(p, chi, 'prev'); await p.close(); }
  await b.close(); srv.close();
  console.log('PROBLEMI', problemi.length); problemi.forEach(x => console.log(' -', x));
})();
