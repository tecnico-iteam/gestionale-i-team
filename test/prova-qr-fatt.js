const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor: 2}); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Carone Tommaso'}; window.__store.config = {impostazioni: {iban: 'IT60X0542811101000000123456', banca: 'Banca di prova', tecnici: [{nome:'Carone Tommaso', codice:'T01', telefono:'', ruolo:'Titolare', telefono:'+39 333 1234567', email:'tommaso@iteamservice.it'}, {nome:'Alessandro Doleatti', codice:'T02', ruolo:'Responsabile tecnico'}]}}; });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(900);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(e => errs.push('notec ' + e.message)); await p.waitForTimeout(500);
  await p.screenshot({path:'/tmp/anteprima-1-app.png'});
  await p.click('#hqr'); await p.waitForTimeout(600);
  await p.screenshot({path:'/tmp/anteprima-2-qr.png', fullPage: false});
  const dlg = await p.$('.dlg'); if (dlg) await dlg.screenshot({path:'/tmp/anteprima-3-qr-intero.png'});
  console.log('vcard', await p.evaluate(() => document.querySelector('.qrcard svg') ? 'svg ok' : 'NO SVG')); console.log('errors', errs); await b.close();
})();
