const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const run = async (user, name) => {
    const ctx = await b.newContext({viewport:{width:390,height:844}}); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.route('https://www.gstatic.com/**', r => r.fulfill({body: '', contentType: 'text/javascript'}));
    await p.addInitScript({path: 'test/fbmock.js'});
    await p.addInitScript(u => { window.__nextUser = u; window.FIREBASE_CONFIG_OVERRIDE = 1; }, user);
    await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType:'text/javascript'}));
    await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
    await p.screenshot({path: `test/${name}-login.png`});
    await p.click('#gGoogle'); await p.waitForTimeout(800);
    await p.screenshot({path: `test/${name}-after.png`});
    return p;
  };
  const p = await run({uid:'u1', email:'segreteria.iteam@gmail.com', emailVerified:true, displayName:'Tommaso'}, 'owner');
  await p.click('[data-mode="ufficio"]').catch(()=>{}); await p.waitForTimeout(400);
  await p.screenshot({path:'test/owner-app.png'});
  console.log('utenti', JSON.stringify(await p.evaluate(() => window.__store.utenti)));
  await p.click('#hacc'); await p.waitForTimeout(400); await p.screenshot({path:'test/owner-acc.png'});
  const q = await run({uid:'u2', email:'tecnico@x.it', emailVerified:false, displayName:'Luca'}, 'tec');
  console.log('utenti2', JSON.stringify(await q.evaluate(() => window.__store.utenti)));
  console.log('errors', errs); await b.close();
})();
