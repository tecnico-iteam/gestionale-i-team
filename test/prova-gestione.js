// Prova: pagina Gestione (margini, confronto prezzi, incassi, ordini, furgoni, contratti, F-gas, contabilità),
// scheda impianto con QR, furgone del tecnico. Usa dati finti (nessun dato reale di clienti).
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const T = new Date(), iso = d => d.toISOString().slice(0, 10), add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return iso(d); };
  const oggi = iso(T), domani = add(1);
  const dati = {
    utenti: {u1:{email:'carone.t46@gmail.com', nome:'Tommy', ruolo:'admin', attivo:true},
      u2:{email:'mario@utenti.iteamservice.it', nome:'Mario Rossi', ruolo:'tecnico', attivo:true, tecnico:'Mario Rossi'},
      u3:{email:'irene@utenti.iteamservice.it', nome:'Irene', ruolo:'ufficio', attivo:true, contabilita:true},
      u4:{email:'ale@utenti.iteamservice.it', nome:'Alessandro', ruolo:'ufficio', attivo:true}},
    config: {impostazioni: {tecnici:[{nome:'Mario Rossi', codice:'T01'}], costoOra:45, costoInterno:25, postazioni:['Tommy','Irene','Alessandro'], fornitori:[{nome:'Erredi', telefono:'3331112222', email:'ordini@erredi.test', referente:'Luca'}]}},
    clienti: {c1:{nome:'Cliente Prova', telefono:'3330000000', email:'cliente@prova.test', indirizzo:'Via Test 1', citta:'Vinovo'}},
    impianti: {i1:{clienteId:'c1', tipo:'Canalizzato', marca:'General', modello:'ARXCO', gas:'R410A', caricaKg:3, dataInstallazione:'2024-01-10', ultimoControlloPerdite:'2025-06-01'}},
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
  console.log('Oggi - da non dimenticare:', (await txt(p, '#app')).match(/Da non dimenticare.{0,200}/i)?.[0]);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300);
  console.log('Tile:', await p.$$eval('#app [data-altro]', l => l.map(x => x.innerText.split('\n')[1]).join(' | ')));
  await p.screenshot({path:'test/gestione-hub.png'});
  for (const k of ['margini','prezzi','incassi','ordini','furgoni','contratti','fgas','contab']) {
    await p.click(`[data-altro="${k}"]`); await p.waitForTimeout(300);
    console.log('--', k, ':', (await txt(p, '#app')).slice(0, 330));
    await p.screenshot({path:`test/gestione-${k}.png`, fullPage:true});
    await p.click('[data-altro=""]'); await p.waitForTimeout(200);
  }
  // ordini dalla scorta e ricevimento
  await p.click('[data-altro="ordini"]'); await p.click('[data-ord="scorta"]'); await p.waitForTimeout(500);
  const ord = await p.evaluate(() => Object.values(window.__store.ordini || {}));
  console.log('Ordini creati:', JSON.stringify(ord.map(o => [o.fornitore, o.righe.map(r => r.codice + ' x' + r.qta + ' @' + r.prezzo)])));
  await p.click('[data-ordine]'); await p.waitForTimeout(300);
  console.log('Dettaglio ordine:', (await txt(p, '.ov')).slice(0, 260));
  await p.click('.ov [data-a="ric"]'); await p.waitForTimeout(500);
  console.log('Rame in sede dopo ricevuto:', await p.evaluate(() => window.__store.magazzino.m1.quantita), 'prezzo acquisto', await p.evaluate(() => window.__store.magazzino.m1.prezzoAcquisto));
  // ordine dal preventivo
  await p.click('details summary'); await p.click('[data-ordprev="p1"]'); await p.waitForTimeout(500);
  console.log('Ordini dopo preventivo:', await p.evaluate(() => Object.values(window.__store.ordini).map(o => o.fornitore + ':' + o.rif).join(' | ')));
  // incassi
  await p.click('[data-altro=""]'); await p.click('[data-altro="incassi"]'); await p.waitForTimeout(200);
  console.log('Link WhatsApp sollecito:', (await p.getAttribute('a[href*="wa.me"]', 'href')).slice(0, 120));
  await p.click('[data-sollecitato]'); await p.waitForTimeout(300);
  console.log('Sollecito registrato:', JSON.stringify(await p.evaluate(() => window.__store.fatture.f1.solleciti)));
  // contratto: rinnova
  await p.click('[data-altro=""]'); await p.click('[data-altro="contratti"]'); await p.click('[data-contrrin="k1"]'); await p.waitForTimeout(300);
  console.log('Nuova scadenza contratto:', await p.evaluate(() => window.__store.contratti.k1.scadenza));
  // furgone: carica 2 rame su Mario
  await p.click('[data-altro=""]'); await p.click('[data-altro="furgoni"]'); await p.click('[data-furc="1"]'); await p.waitForTimeout(200);
  await p.selectOption('.ov select[data-k="articoloId"]', 'm1'); await p.fill('.ov [data-k="qta"]', '2'); await p.click('.ov button[type=submit]'); await p.waitForTimeout(300);
  console.log('Rame dopo carico furgone:', JSON.stringify(await p.evaluate(() => [window.__store.magazzino.m1.quantita, window.__store.magazzino.m1.furgoni])));
  // contabilità: carica un PDF
  await p.click('[data-altro=""]'); await p.click('[data-altro="contab"]');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-contab="up"]')]);
  await fc.setFiles({name:'DDT 445 Erredi.pdf', mimeType:'application/pdf', buffer: Buffer.from('%PDF-1.4 prova')}); await p.waitForTimeout(600);
  await p.fill('.ov [data-k="fornitore"]', 'Erredi'); await p.fill('.ov [data-k="numero"]', '445'); await p.click('.ov button[type=submit]'); await p.waitForTimeout(400);
  console.log('Contabilità salvata:', JSON.stringify(await p.evaluate(() => Object.values(window.__store.contabilita || {}).map(d => [d.tipo, d.fornitore, d.numero, d.file && d.file.path]))));
  await p.screenshot({path:'test/gestione-contab-dopo.png', fullPage:true});
  // scheda impianto + QR
  await p.click('[data-altro=""]'); await p.click('[data-altro="fgas"]'); await p.click('[data-impd="i1"]'); await p.waitForTimeout(300);
  console.log('Scheda impianto:', (await txt(p, '.ov')).slice(0, 300));
  await p.click('.ov [data-a="qr"]'); await p.waitForTimeout(700);
  console.log('QR presente:', await p.isVisible('.etq svg'));
  await p.screenshot({path:'test/gestione-qr.png'});
  await p.click('.ov [data-a="x"]'); await p.waitForTimeout(100); await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  // preventivo: margine
  await p.click('[data-altro=""]'); await p.click('[data-altro="margini"]'); await p.click('[data-prev="p1"]'); await p.waitForTimeout(300);
  console.log('Margine preventivo:', (await txt(p, '.ov')).match(/Margine stimato.{0,90}/)?.[0]);
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  await p.click('[data-int="x1"]'); await p.waitForTimeout(300);
  console.log('Posizione nel rapportino:', (await txt(p, '.ov')).match(/Posizione.{0,80}/)?.[0]);
  // Alessandro (ufficio senza contabilità) e Irene (con contabilità)
  const a = await apri({uid:'u4', email:'ale@utenti.iteamservice.it', emailVerified:true, displayName:'Alessandro', providerData:[{providerId:'password'}]});
  await a.click('[data-tab="altro"]').catch(()=>{}); await a.waitForTimeout(300);
  console.log('Alessandro vede Contabilità:', await a.isVisible('[data-altro="contab"]'));
  const i = await apri({uid:'u3', email:'irene@utenti.iteamservice.it', emailVerified:true, displayName:'Irene', providerData:[{providerId:'password'}]});
  await i.click('[data-tab="altro"]').catch(()=>{}); await i.waitForTimeout(300);
  console.log('Irene vede Contabilità:', await i.isVisible('[data-altro="contab"]'));
  // tecnico: furgone e rapportino che scarica dal furgone, con posizione
  const t = await apri({uid:'u2', email:'mario@utenti.iteamservice.it', emailVerified:true, displayName:'Mario Rossi', providerData:[{providerId:'password'}]});
  await t.waitForTimeout(300);
  console.log('Tecnico: nav visibile?', await t.isVisible('#nav'), 'menu:', await t.isVisible('[data-a="tecmenu"]'));
  await t.click('[data-a="tecmenu"]'); await t.click('.ov [data-m="furgone"]'); await t.waitForTimeout(300);
  console.log('Furgone tecnico:', (await txt(t, '#app')).slice(0, 400));
  await t.screenshot({path:'test/gestione-tecnico-furgone.png', fullPage:true});
  await t.click('[data-tecf="oggi"]'); await t.waitForTimeout(200);
  await t.click('[data-start="x3"]'); await t.waitForTimeout(800);
  console.log('Posizione inizio salvata:', JSON.stringify(await t.evaluate(() => window.__store.interventi.x3.inizioPos)));
  await t.click('[data-rap="x3"]'); await t.waitForTimeout(300);
  await t.click('.ov .checks label:has-text("Controllo perdite")');
  await t.click('.ov [data-add="materiali"]'); await t.selectOption('.ov .rw select[data-c="articoloId"]', 'm2'); await t.fill('.ov .rw [data-c="qta"]', '4');
  await t.check('.ov [data-k="clienteAssente"]'); await t.waitForTimeout(300); console.log('assente spuntato:', await t.isChecked('.ov [data-k="clienteAssente"]'), 'campo firma visibile:', await t.isVisible('.ov [data-k="firmatoDa"]'));
  await t.click('.ov button[type=submit]'); await t.waitForTimeout(300); console.log('Toast:', await t.evaluate(() => [...document.querySelectorAll('[class*=toast]')].map(x => x.innerText).join(' / '))); await t.screenshot({path:'test/gestione-rap.png', fullPage:true}); await t.waitForTimeout(700);
  console.log('Staffe dopo rapportino (sede, furgone):', JSON.stringify(await t.evaluate(() => [window.__store.magazzino.m2.quantita, window.__store.magazzino.m2.furgoni])));
  console.log('Controllo perdite aggiornato:', await t.evaluate(() => window.__store.impianti.i1.ultimoControlloPerdite));
  console.log('Costo nel rapportino:', await t.evaluate(() => window.__store.interventi.x3.rapportino.materiali[0].costo), 'finePos:', !!(await t.evaluate(() => window.__store.interventi.x3['rapportino.finePos'])));
  // link QR ?imp=
  const q = await apri({uid:'u2', email:'mario@utenti.iteamservice.it', emailVerified:true, displayName:'Mario Rossi', providerData:[{providerId:'password'}]}, '?imp=i1'); await q.waitForTimeout(600);
  console.log('Link QR apre scheda:', await q.isVisible('.ov h2'), (await q.innerText('.ov h2').catch(()=> '')));
  console.log('ERRORI', errs); await b.close();
})();
