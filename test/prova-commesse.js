// Prova: ricerca cliente, commesse con documenti condivisi/non condivisi, vista tecnico, QR con logo
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor: 2})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => {
    const oggi = new Date().toISOString().slice(0, 10);
    window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {
      config: {impostazioni: {tecnici: [{nome:'Tommaso Carone', codice:'T01', telefono:'+39 300 0000000', ruolo:'Titolare', email:'tommaso@iteamservice.it'}]}},
      clienti: {c1: {nome:'Rossi Mario', citta:'Torino', indirizzo:'Via Roma 1'}, c2: {nome:'Bianchi Anna', citta:'Moncalieri'}, c3: {nome:'Condominio Rosa', citta:'Vinovo'}},
      interventi: {i1: {clienteId:'c1', data: oggi, ora:'09:00', tipo:'Installazione', tecnico:'Tommaso Carone', stato:'Programmato'}}
    });
  });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"]'); await p.waitForTimeout(500);
  // 1. ricerca cliente nel nuovo intervento
  await p.click('.fab'); await p.waitForTimeout(400);
  await p.fill('[data-s="clienteId"]', 'ros'); await p.waitForTimeout(200);
  await p.screenshot({path:'/tmp/t1-ricerca.png'});
  console.log('risultati "ros":', await p.$$eval('.smi', l => l.map(x => x.textContent)));
  await p.click('.smi >> nth=0'); await p.waitForTimeout(200);
  console.log('cliente scelto:', await p.$eval('select[data-k="clienteId"]', s => s.value));
  await p.click('[data-a="x"]'); await p.waitForTimeout(200);
  // 2. commessa sul cliente
  await p.click('[data-tab="clienti"]'); await p.waitForTimeout(300);
  await p.click('[data-cli="c1"]'); await p.waitForTimeout(300);
  await p.click('[data-commnew]'); await p.waitForTimeout(300);
  await p.fill('[data-k="titolo"]', 'Multisplit villa Rossi');
  await p.fill('[data-k="notaTecnici"]', 'Chiavi dal portinaio. Unità esterna sul tetto.');
  await p.fill('[data-k="descrizione"]', 'Prezzo concordato 4.800 €');
  await p.click('button[type=submit]'); await p.waitForTimeout(800);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-docup]')]);
  await fc.setFiles(['/tmp/planimetria-piano-terra.png', '/tmp/progetto.pdf']); await p.waitForTimeout(1500);
  await p.click('.commov [data-docsh] >> nth=0'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/t2-commessa-ufficio.png'});
  console.log('commesse:', JSON.stringify(await p.evaluate(() => Object.values(window.__store.commesse || {}).map(c => ({titolo: c.titolo, numero: c.numero, docs: c.documenti.map(d => [d.nome, d.tipo, d.categoria, d.condiviso])})))));
  // foto dal telefono (il browser di prova è un PC)
  await p.click('.commov [data-docfoto]'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/t7-pc-attesa.png'});
  const token = await p.evaluate(() => Object.keys(window.__store.scansioni || {})[0]);
  console.log('richiesta creata:', !!token, JSON.stringify(await p.evaluate(t => window.__store.scansioni[t], token)));
  await p.evaluate(t => firebase.firestore().collection('scansioni').doc(t).set({stato:'fatto', url:'https://example.test/dal-telefono.jpg', assetId:'dal-telefono.jpg'}, {merge:true}), token);
  await p.waitForTimeout(1200);
  console.log('documento arrivato nella commessa:', await p.evaluate(() => Object.values(window.__store.commesse)[0].documenti.some(d => d.url.includes('dal-telefono'))));
  await p.click('.commov [data-x="close"]'); await p.waitForTimeout(200);
  // 3. vista tecnico
  await p.click('#hmode'); await p.waitForTimeout(300);
  await p.click('[data-mode="tecnico"]'); await p.waitForTimeout(500);
  await p.screenshot({path:'/tmp/t3-tecnico-lista.png'});
  await p.click('[data-commcli]'); await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/t4-tecnico-documenti.png'});
  console.log('pulsante fotocamera per il tecnico?', !!(await p.$('.ov [data-docfoto]')));
  console.log('documenti visti dal tecnico:', await p.$$eval('.ov [data-docview]', l => l.map(x => x.textContent.trim())));
  console.log('note interne visibili al tecnico?', (await p.content()).includes('4.800'));
  await p.click('.ov [data-docview] >> nth=0'); await p.waitForTimeout(400);
  await p.fill('#docnota', 'Tubi passano dal controsoffitto del corridoio'); await p.click('[data-x="nota"]'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/t5-tecnico-nota.png'});
  console.log('note:', JSON.stringify(await p.evaluate(() => Object.values(window.__store.commesse)[0].documenti.map(d => d.note))));
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  // 4. QR con logo
  await p.click('#hqr'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/t6-qr.png'});
  console.log('email sul biglietto:', (await p.content()).includes('tommaso@iteamservice.it'));
  console.log('QR moduli:', await p.$eval('.qrimg', s => s.getAttribute('viewBox')));
  console.log('errors', errs); await b.close();
})();
