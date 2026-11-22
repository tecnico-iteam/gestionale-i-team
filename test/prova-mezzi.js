// Prova: 🚚 Mezzi e scadenze (furgoni, attrezzature, patentini): solo Tommaso e Irene. Dati finti.
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
    config: {impostazioni: {tecnici:[{nome:'Mario Rossi', codice:'T01', patentino:'FG-1', patScad:add(40)}], costoOra:45, costoInterno:25, postazioni:['Tommy','Irene','Alessandro'], fornitori:[{nome:'Erredi', telefono:'3331112222', email:'ordini@erredi.test', referente:'Luca'}]}},
    clienti: {c1:{nome:'Cliente Prova', telefono:'3330000000', email:'cliente@prova.test', indirizzo:'Via Test 1', citta:'Vinovo'}},
    impianti: {i1:{clienteId:'c1', tipo:'Canalizzato', marca:'General', modello:'ARXCO', gas:'R410A', caricaKg:3, dataInstallazione:'2024-01-10', ultimoControlloPerdite:'2025-06-01', potenza:'14 kW'}, i2:{clienteId:'c1', tipo:'Split', marca:'Fujitsu', gas:'R32', caricaKg:1, potenza:'9000 BTU'}},
    magazzino: {m1:{descrizione:'Tubo rame 3/8 isolato', codice:'RAME38', quantita:2, scortaMinima:5, unita:'m', prezzoAcquisto:4, prezzoVendita:9, fornitore:'Sacchi'},
      m2:{descrizione:'Staffa unità esterna', codice:'STAFFA45', quantita:10, scortaMinima:2, unita:'pz', prezzoAcquisto:12, prezzoVendita:25, fornitore:'Erredi', furgoni:{'Mario Rossi':3}}},
    listino: {lx:{items:[{marca:'Erredi', codice:'ER-RAME38', descrizione:'Tubo rame 3/8 isolato 9 mm', prezzo:6, costo:3.2},
      {marca:'Sacchi', codice:'SA-RAME38X', descrizione:'Rame 3/8 isolato rotolo', prezzo:7, costo:3.9}]}},
    interventi: {x1:{clienteId:'c1', impiantoId:'i1', data:oggi, tipo:'Manutenzione', tecnico:'Mario Rossi', stato:'Completato', inizioPos:{lat:44.95,lng:7.63,acc:12,il:T.toISOString()},
        rapportino:{inizio:'09:00', fine:'11:00', minutiLavoro:120, lavori:['Pulizia filtri unità interna'], materiali:[{articoloId:'m2', descrizione:'Staffa unità esterna', qta:1, prezzo:25, costo:12, unita:'pz'}], esito:'Risolto', inviatoIl:T.toISOString(), finePos:{lat:44.95,lng:7.63,acc:8,il:T.toISOString()}}},
      x2:{clienteId:'c1', impiantoId:'i1', data:domani, ora:'09:00', tipo:'Manutenzione', tecnico:'Mario Rossi', stato:'Programmato', materialiPrevisti:[{articoloId:'m2', qta:5}, {articoloId:'m1', qta:2}]},
      x3:{clienteId:'c1', impiantoId:'i1', data:oggi, ora:'15:00', tipo:'Riparazione', tecnico:'Mario Rossi', stato:'Programmato'}},
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
  const t = await apri({uid:'u2', email:'mario@utenti.iteamservice.it', emailVerified:true, displayName:'Mario Rossi', providerData:[{providerId:'password'}]});
  await t.click('[data-tab="altro"]').catch(()=>{}); console.log('Tecnico vede Mezzi:', await t.isVisible('[data-altro="mezzi"]'));
  const p = await apri({uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone', providerData:[{providerId:'google.com'}]});
  await p.click('[data-mode="ufficio"] >> nth=0').catch(()=>{}); await p.waitForTimeout(500);
  console.log('Oggi:', (await txt(p, '#app')).match(/🚚.{0,120}/)?.[0]);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300);
  await p.click('[data-altro="mezzi"]'); await p.waitForTimeout(300);
  console.log('Mezzi:', (await txt(p, '#app')).slice(0, 700)); await p.screenshot({path:'test/mezzi-elenco.png', fullPage:true});
  await p.click('[data-mzd="v1"]'); await p.waitForTimeout(300);
  console.log('Scheda:', (await txt(p, '.ov')).slice(0, 900)); await p.screenshot({path:'test/mezzi-scheda.png', fullPage:true});
  await p.click('.ov [data-mf="bol"]'); await p.waitForTimeout(300); await p.click('.ov button[type=submit] >> nth=-1'); await p.waitForTimeout(600);
  console.log('Bollo nuovo:', await p.evaluate(() => window.__store.mezzi.v1.bolloScad));
  await p.click('.ov [data-a="km"]'); await p.waitForTimeout(300); await p.fill('.ov [data-k="km"] >> nth=-1', '61000'); await p.click('.ov button[type=submit] >> nth=-1'); await p.waitForTimeout(600);
  console.log('Km:', await p.evaluate(() => window.__store.mezzi.v1.kmAttuali));
  await p.click('.ov [data-a="x"]').catch(()=>{}); await p.waitForTimeout(200);
  await p.click('[data-mz="new"]'); await p.waitForTimeout(300);
  await p.fill('.ov [data-k="nome"]', 'Doblò'); await p.fill('.ov [data-k="targa"]', 'ab 123 cd'); await p.fill('.ov [data-k="immatricolazione"]', '2023-05-02'); await p.waitForTimeout(300);
  console.log('Info revisione:', (await txt(p, '.ov')).match(/Prossima revisione[^A-Z]{0,40}/)?.[0]);
  await p.click('.ov button[type=submit]'); await p.waitForTimeout(600);
  console.log('Nuovo:', JSON.stringify(Object.values(await p.evaluate(() => window.__store.mezzi)).map(m => m.nome + ' ' + m.targa)));
  for (const k of ['attr', 'pat']) { await p.click(`[data-mztab="${k}"]`); await p.waitForTimeout(300); console.log('--', k, (await txt(p, '#app')).slice(0, 400)); }
  await p.click('[data-mztab="attr"]'); await p.click('[data-mzattr="a1"]'); await p.waitForTimeout(300); await p.click('.ov [data-a="ok"]'); await p.waitForTimeout(300); await p.click('.ov button[type=submit] >> nth=-1'); await p.waitForTimeout(600);
  console.log('Verifica:', await p.evaluate(() => window.__store.attrezzature.a1.ultimaVerifica));
  console.log('ERRORI:', errs.length ? errs : 'nessuno');
  await b.close();
})();
