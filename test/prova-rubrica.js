// Prova: rubrica clienti. Tommy e Irene vedono tutti, gli altri solo i clienti con attività nell'ultimo anno
const {chromium} = require('playwright');
const prova = async (b, uff) => {
  const p = await (await b.newContext({viewport: {width: 430, height: 900}})).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(uff => { const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    window.__nextUser = {uid:'u9', email: uff + '@utenti.iteamservice.it', emailVerified:true, displayName: uff};
    localStorage.setItem('iteam.uff', JSON.stringify(uff));
    Object.assign(window.__store, {
      utenti: {u9: {email: uff + '@utenti.iteamservice.it', nome: uff, ruolo: 'ufficio', attivo: true, postazione: uff}},
      config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}], postazioni: ['Tommy', 'Irene', 'Alessandro']}},
      clienti: {c1: {nome: 'Recente Intervento', importatoIl: d(-30)}, c2: {nome: 'Vecchio Importato', importatoIl: d(-30), aggiornato: d(-1)}, c3: {nome: 'Nuovo a mano', aggiornato: d(-2)}, c4: {nome: 'Vecchio con lavoro 2024', importatoIl: d(-30)}},
      interventi: {i1: {clienteId: 'c1', data: d(-100), stato: 'Completato'}, i2: {clienteId: 'c4', data: d(-500), stato: 'Completato'}}
    }); }, uff);
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(400);
  await p.click('[data-tab="clienti"]').catch(() => {}); await p.waitForTimeout(400);
  console.log(uff, '→', await p.$$eval('[data-cli] .t', l => l.map(x => x.textContent)), errs);
  if (uff === 'Irene') await p.screenshot({path: '/tmp/rubrica-irene.png'});
};
(async () => { const b = await chromium.launch(); await prova(b, 'Irene'); await prova(b, 'Alessandro'); await b.close(); })();
