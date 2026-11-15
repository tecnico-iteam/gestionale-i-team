// Prova: "Fotografa e aggiungi articolo" dal telefono (fotocamera) e dal PC (richiesta al telefono)
const {chromium, devices} = require('playwright');
const avvia = async (b, ctxOpts, errs) => {
  const p = await (await b.newContext(ctxOpts)).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**', r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone'}; });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  await p.click('#gGoogle'); await p.waitForTimeout(800);
  await p.click('[data-mode="ufficio"]'); await p.waitForTimeout(400);
  await p.click('[data-tab="magazzino"]'); await p.waitForTimeout(400);
  return p;
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  // telefono
  const t = await avvia(b, {...devices['iPhone 13']}, errs);
  const [fc] = await Promise.all([t.waitForEvent('filechooser'), t.click('[data-a="artfoto"]')]);
  console.log('telefono: fotocamera diretta =', await fc.element().getAttribute('capture'));
  await fc.setFiles('/tmp/planimetria-piano-terra.png'); await t.waitForTimeout(1200);
  await t.fill('[data-k="descrizione"]', 'Lampada LED 18W'); await t.fill('[data-k="codice"]', 'LAMP18');
  await t.screenshot({path:'/tmp/m1-telefono.png'});
  await t.click('button[type=submit]'); await t.waitForTimeout(600);
  console.log('articolo salvato con foto:', JSON.stringify(await t.evaluate(() => Object.values(window.__store.magazzino || {}).map(m => [m.descrizione, m.codice, !!m.fotoUrl]))));
  // PC
  const pc = await avvia(b, {viewport:{width:1280,height:800}}, errs);
  await pc.click('[data-a="artfoto"]'); await pc.waitForTimeout(800);
  const token = await pc.evaluate(() => Object.keys(window.__store.scansioni || {})[0]);
  await pc.evaluate(tk => firebase.firestore().collection('scansioni').doc(tk).set({stato:'fatto', url:'https://example.test/lampada.jpg', assetId:'lampada.jpg'}, {merge:true}), token);
  await pc.waitForTimeout(1000);
  console.log('PC: modulo nuovo articolo aperto con la foto:', await pc.evaluate(() => !!document.querySelector('.dlg img[src*="lampada"]')));
  await pc.screenshot({path:'/tmp/m2-pc.png'});
  console.log('errors', errs); await b.close();
})();
