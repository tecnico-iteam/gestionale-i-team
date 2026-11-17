// Prova: cantiere di più giorni (inizio, durata/fine, orario 8-17) segnato in calendario ogni giorno
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 430, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => {
    window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'};
    Object.assign(window.__store, {
      config: {impostazioni: {tecnici: [{nome: 'Andrea', codice: 'T01'}]}},
      clienti: {c1: {nome: 'Cantiere Rossi', telefono: '333 1112222'}}
    }); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"] >> nth=0'); await p.waitForTimeout(500);
  await p.click('.fab');  await p.waitForTimeout(300);
  await p.selectOption('[data-k="clienteId"]', 'c1'); await p.dispatchEvent('[data-k="clienteId"]', 'change'); await p.waitForTimeout(200);
  const lun = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await p.fill('[data-k="data"]', lun); await p.dispatchEvent('[data-k="data"]', 'change');
  await p.fill('[data-k="ora"]', '09:00');
  await p.check('[data-k="cantiere"]'); await p.waitForTimeout(200);
  await p.fill('[data-k="durataGg"]', '15'); await p.dispatchEvent('[data-k="durataGg"]', 'change'); await p.waitForTimeout(200);
  console.log('fine calcolata', await p.inputValue('[data-k="dataFine"]'), await p.inputValue('[data-k="oraDa"]'), await p.inputValue('[data-k="oraFine"]'));
  await p.screenshot({path: '/tmp/cant-form.png', fullPage: true});
  await p.click('button[type=submit]'); await p.waitForTimeout(600);
  const x = await p.evaluate(() => Object.values(window.__store.interventi)[0]);
  console.log('salvato', JSON.stringify(x));
  await p.screenshot({path: '/tmp/cant-oggi.png', fullPage: true});
  await p.click('[data-tab="calendario"]'); await p.waitForTimeout(400);
  await p.click('[data-calv="mese"]'); await p.waitForTimeout(300);
  await p.screenshot({path: '/tmp/cant-mese.png', fullPage: true});
  await p.click('[data-calv="settimana"]'); await p.waitForTimeout(300); await p.click('[data-calmv="1"]'); await p.waitForTimeout(300);
  await p.screenshot({path: '/tmp/cant-sett.png', fullPage: true});
  await p.click('.card.tap >> nth=0'); await p.waitForTimeout(300);
  await p.screenshot({path: '/tmp/cant-det.png'});
  console.log('errors', errs); await b.close();
})();
