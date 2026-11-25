// Prova: ⏱ ore dei tecnici dal rapportino, divise per tecnico e giorno, totale del mese; due tecnici con orari diversi. Dati finti.
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const T = new Date(), iso = d => d.toISOString().slice(0, 10), add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return iso(d); };
  const oggi = iso(T), domani = add(1);
  const dati = {
    utenti: {u1:{email:'carone.t46@gmail.com', nome:'Tommy', ruolo:'admin', attivo:true},
      u2:{email:'mario@utenti.iteamservice.it', nome:'Mario Rossi', ruolo:'tecnico', attivo:true, tecnico:'Mario Rossi'},
      u3:{email:'irene@utenti.iteamservice.it', nome:'Irene', ruolo:'ufficio', attivo:true, contabilita:true},
      u4:{email:'ale@utenti.iteamservice.it', nome:'Alessandro', ruolo:'tecnico_preventivatore', attivo:true, tecnico:'Mario Rossi'}},
    config: {impostazioni: {tecnici:[{nome:'Mario Rossi', codice:'T01'}, {nome:'Luca Bianchi', codice:'T02'}], costoOra:45, costoInterno:25, postazioni:['Tommy','Irene','Alessandro'], fornitori:[{nome:'Erredi', telefono:'3331112222', email:'ordini@erredi.test', referente:'Luca'}]}},
    clienti: {c1:{nome:'Cliente Prova', telefono:'3330000000', email:'cliente@prova.test', indirizzo:'Via Test 1', citta:'Vinovo'}},
    impianti: {i1:{clienteId:'c1', tipo:'Canalizzato', marca:'General', modello:'ARXCO', gas:'R410A', caricaKg:3, dataInstallazione:'2024-01-10', ultimoControlloPerdite:'2025-06-01', potenza:'14 kW'}, i2:{clienteId:'c1', tipo:'Split', marca:'Fujitsu', gas:'R32', caricaKg:1, potenza:'9000 BTU'}},
    magazzino: {m1:{descrizione:'Tubo rame 3/8 isolato', codice:'RAME38', quantita:2, scortaMinima:5, unita:'m', prezzoAcquisto:4, prezzoVendita:9, fornitore:'Sacchi'},
      m2:{descrizione:'Staffa unità esterna', codice:'STAFFA45', quantita:10, scortaMinima:2, unita:'pz', prezzoAcquisto:12, prezzoVendita:25, fornitore:'Erredi', furgoni:{'Mario Rossi':3}}},
    listino: {lx:{items:[{marca:'Erredi', codice:'ER-RAME38', descrizione:'Tubo rame 3/8 isolato 9 mm', prezzo:6, costo:3.2},
      {marca:'Sacchi', codice:'SA-RAME38X', descrizione:'Rame 3/8 isolato rotolo', prezzo:7, costo:3.9}]}},
    interventi: {
      x1:{clienteId:'c1', impiantoId:'i1', data:oggi, tipo:'Manutenzione', tecnico:'Mario Rossi', stato:'Completato', rapportino:{inizio:'08:00', fine:'13:00', pausaMin:0, viaggioMin:30, minutiLavoro:300, lavori:['x'], materiali:[], esito:'Risolto', inviatoIl:T.toISOString(), inviatoDa:'Mario Rossi'}},
      x4:{clienteId:'c1', data:oggi, tipo:'Installazione', tecnico:'Mario Rossi', tecnico2:'Luca Bianchi', stato:'Completato', rapportino:{inizio:'14:00', fine:'18:30', pausaMin:0, minutiLavoro:270, minutiTec:{'Mario Rossi':270, 'Luca Bianchi':150}, lavori:['x'], materiali:[], esito:'Risolto', inviatoIl:T.toISOString(), inviatoDa:'Mario Rossi'}},
      x5:{clienteId:'c1', data:add(-1) < oggi.slice(0,7) + '-01' ? oggi : add(-1), tipo:'Riparazione', tecnico:'Luca Bianchi', stato:'Completato', rapportino:{inizio:'09:00', fine:'12:00', minutiLavoro:180, lavori:['x'], materiali:[], esito:'Risolto', inviatoIl:T.toISOString(), inviatoDa:'Luca Bianchi'}},
      x6:{clienteId:'c1', data:oggi, ora:'15:00', tipo:'Riparazione', tecnico:'Mario Rossi', tecnico2:'Luca Bianchi', stato:'In corso'}},
    oreLibere: {
      l1:{tecnico:'Luca Bianchi', tipo:'Ferie', data:oggi.slice(0,7)+'-02', dataFine:oggi.slice(0,7)+'-06', minuti:480, descrizione:'Ferie', da:'Irene', uid:''},
      l2:{tecnico:'Mario Rossi', tipo:'Permesso', data:oggi, minuti:120, descrizione:'Visita', da:'Mario Rossi', uid:'u2'},
      l3:{tecnico:'Luca Bianchi', tipo:'Altro lavoro', data:oggi, minuti:90, descrizione:'Magazzino', da:'Luca', uid:'u9'}},
    fatture: {f1:{clienteId:'c1', numero:'12/2026', data:add(-60), scadenza:add(-30), imponibile:500, iva:'22', interventoId:'x1'}},
    preventivi: {p1:{clienteId:'c1', numero:'3/2026', data:oggi, stato:'Accettato', iva:'22', righe:[{descrizione:'ER-RAME38 - Tubo rame 3/8 isolato 9 mm', codice:'ER-RAME38', qta:10, prezzo:6, costo:3.2}, {descrizione:'Manodopera tecnico (a ore) (4 h × € 45,00)', qta:4, prezzo:45, unita:'ore'}]}},
    fgasOps: {o1:{impiantoId:'i1', clienteId:'c1', data:add(-26), operazione:'Controllo perdite', gas:'R410A', perdite:'no', tecnico:'Mario Rossi', comunicato:false}},
    mezzi: {v1:{nome:'Ducato bianco', targa:'GH123AB', modello:'Fiat Ducato', tecnico:'Mario Rossi', immatricolazione:'2021-03-10', ultimaRevisione:'', assicScad:add(12), bolloScad:add(-3), kmAttuali:58500, ultimoTagliando:add(-200), ultimoTagliandoKm:30000, tagliandoOgniKm:30000, tagliandoOgniMesi:12, possesso:'Noleggio a lungo termine', rata:450, contrattoScad:add(400), kmCompresi:120000, documenti:[]}},
    attrezzature: {a1:{nome:'Cercafughe', matricola:'CF9', ultimaVerifica:add(-350), ogniMesi:12}},
    contratti: {k1:{clienteId:'c1', canone:150, scadenza:add(10), durataMesi:12, rinnovoAuto:true, stato:'Attivo', inizio:add(-355)}}
  };
  const apri = async (utente, qs = '') => {
    const ctx = await b.newContext({viewport:{width:1100,height:1000}, permissions:['geolocation'], geolocation:{latitude:44.95, longitude:7.63}});
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
    await p.addInitScript({path: 'test/fbmock.js'});
    await p.addInitScript(([u, pr]) => { window.__nextUser = u;
      const t = setInterval(() => { if (window.firebase && window.firebase.firestore && !window.firebase.firestore.FieldValue) window.firebase.firestore.FieldValue = {delete: () => undefined}; if (window.__store && !window.__fatto) { window.__fatto = 1; Object.assign(window.__store, JSON.parse(pr)); } }, 1); setTimeout(() => clearInterval(t), 3000); }, [utente, JSON.stringify(dati)]);
    await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p",storageBucket:"b"};', contentType:'text/javascript'}));
    await p.goto('file://' + process.cwd() + '/index.html' + qs); await p.waitForTimeout(500);
    await p.click('#gGoogle'); await p.waitForTimeout(900);
    return p;
  };
  const txt = async (p, s) => (await p.innerText(s)).replace(/\s+/g, ' ');
  const p = await apri({uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone', providerData:[{providerId:'google.com'}]});
  await p.click('[data-mode="ufficio"] >> nth=0').catch(()=>{}); await p.waitForTimeout(500);
  await p.click('[data-tab="interventi"]'); await p.waitForTimeout(300); await p.click('[data-intf="ore"]'); await p.waitForTimeout(300);
  console.log('UFFICIO:', (await txt(p, '#app')).slice(0, 1200)); await p.screenshot({path:'/home/claude/work/ore-uff.png', fullPage:true});
  await p.click('[data-oretec="Luca Bianchi"]'); await p.waitForTimeout(300);
  console.log('LUCA:', (await txt(p, '#app')).slice(0, 600));
  await p.click('[data-oretec=""]'); await p.waitForTimeout(200);
  const t = await apri({uid:'u2', email:'mario@utenti.iteamservice.it', emailVerified:true, displayName:'Mario Rossi', providerData:[{providerId:'password'}]});
  await t.click('[data-a="tecmenu"]'); await t.click('.ov [data-m="ore"]'); await t.waitForTimeout(300);
  console.log('MARIO:', (await txt(t, '#app')).slice(0, 700)); await t.screenshot({path:'/home/claude/work/ore-tec.png', fullPage:true});
  // rapportino in due con orari diversi
  await t.click('[data-tecf="oggi"]'); await t.waitForTimeout(300);
  await t.click('[data-rap="x6"]'); await t.waitForTimeout(400);
  await t.fill('.ov [data-k="inizio"]', '15:00'); await t.fill('.ov [data-k="fine"]', '18:00');
  await t.uncheck('.ov [data-k="stessoOrario"]'); await t.waitForTimeout(300);
  await t.fill('.ov [data-k="oreT0"]', '3'); await t.fill('.ov [data-k="oreT1"]', '1.5');
  await t.click('.ov [data-ck="lavori"] >> nth=0'); await t.check('.ov [data-k="clienteAssente"]'); await t.waitForTimeout(200);
  await t.click('.ov button[type=submit]'); await t.waitForTimeout(800);
  console.log('SALVATO minutiTec:', JSON.stringify(await t.evaluate(() => window.__store.interventi.x6.rapportino && window.__store.interventi.x6.rapportino.minutiTec)));
  await t.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  await t.click('[data-a="tecmenu"]'); await t.click('.ov [data-m="ore"]'); await t.waitForTimeout(300);
  console.log('MARIO DOPO:', (await txt(t, '#app')).slice(0, 200));
  // ufficio segna malattia per Luca
  await p.click('[data-orelibnew=""]'); await p.waitForTimeout(300);
  await p.selectOption('.ov [data-k="tecnico"]', 'Luca Bianchi'); await p.selectOption('.ov [data-k="tipo"]', 'Malattia'); await p.waitForTimeout(200);
  await p.check('.ov [data-k="giornata"]'); await p.waitForTimeout(200); await p.click('.ov button[type=submit]'); await p.waitForTimeout(600);
  console.log('UFF DOPO:', (await txt(p, '#app')).match(/GIORNO PER GIORNO.*/)?.[0].slice(0, 700)); await p.screenshot({path:'/home/claude/work/ore-uff2.png', fullPage:true});
  // tecnico segna 2 ore di magazzino
  await t.click('[data-orelibnew=""]'); await t.waitForTimeout(300);
  await t.fill('.ov [data-k="ore"]', '2'); await t.fill('.ov [data-k="descrizione"]', 'Giro fornitori'); await t.click('.ov button[type=submit]'); await t.waitForTimeout(600);
  console.log('TEC SALVATO:', JSON.stringify(Object.values(await t.evaluate(() => window.__store.oreLibere)).filter(o => o.descrizione === 'Giro fornitori')));
  console.log('MARIO FINE:', (await txt(t, '#app')).slice(0, 500)); await t.screenshot({path:'/home/claude/work/ore-tec2.png', fullPage:true});
  console.log('ERRORI:', errs.length ? errs : 'nessuno');
  await b.close();
})();
