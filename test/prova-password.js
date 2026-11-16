// Prova: pulsante 🔑 solo per il titolare, cambio password richiesto in utenti/{uid}.nuovaPassword
const {chromium} = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const apri = async (utente, prepara) => {
    const p = await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
    await p.addInitScript({path: 'test/fbmock.js'});
    await p.addInitScript(([u, pr]) => { window.__nextUser = u; window.__prepara = pr;
      const t = setInterval(() => { if (window.firebase && window.firebase.firestore && !window.firebase.firestore.FieldValue) { window.firebase.firestore.FieldValue = {delete: () => undefined}; } if (window.__store && pr && !window.__fatto) { window.__fatto = 1; Object.assign(window.__store, JSON.parse(pr)); } }, 1); setTimeout(() => clearInterval(t), 3000); }, [utente, prepara]);
    await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
    await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
    await p.click('#gGoogle'); await p.waitForTimeout(900);
    return p;
  };
  const dati = JSON.stringify({utenti: {
    u2: {email:'maurizio@utenti.iteamservice.it', nome:'Maurizio', ruolo:'tecnico', attivo:true},
    u3: {email:'irene@utenti.iteamservice.it', nome:'Irene', ruolo:'ufficio', attivo:true, passwordCambiata:'2026-11-10T09:30:00Z'}}});
  const p = await apri({uid:'u1', email:'carone.t46@gmail.com', emailVerified:true, displayName:'Tommaso Carone', providerData:[{providerId:'google.com'}]}, dati);
  await p.click('[data-mode="ufficio"]').catch(()=>{}); await p.waitForTimeout(400);
  console.log('gate', await p.evaluate(() => document.getElementById('gate')?.innerText), errs);
  console.log('titolare vede 🔑:', await p.isVisible('#hpw'));
  await p.click('#hpw'); await p.waitForTimeout(400);
  await p.fill('[data-pw="u2"]', '123'); await p.click('[data-pwset="u2"]'); await p.waitForTimeout(200);
  console.log('troppo corta → nessun cambio:', JSON.stringify((await p.evaluate(() => window.__store.utenti.u2)).nuovaPassword));
  await p.fill('[data-pw="u2"]', 'Clima2026'); await p.click('[data-pwset="u2"]'); await p.waitForTimeout(500);
  console.log('richiesta salvata:', (await p.evaluate(() => window.__store.utenti.u2)).nuovaPassword);
  await p.screenshot({path: 'test/password-pannello.png'});
  await p.click('#hpw ~ #hacc').catch(()=>{});
  const q = await apri({uid:'u2', email:'maurizio@utenti.iteamservice.it', emailVerified:true, displayName:'Maurizio', providerData:[{providerId:'password'}]}, dati);
  console.log('tecnico vede 🔑:', await q.isVisible('#hpw'));
  await q.click('#hacc'); await q.waitForTimeout(400);
  console.log('tecnico può cambiare la sua password:', await q.isVisible('#pOld'));
  console.log('errori', errs); await b.close();
})();
