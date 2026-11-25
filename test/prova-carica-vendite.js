// Prova del pulsante ⬆ Carica fatture emesse (Contabilità → Vendite): XML fattura elettronica + PDF con lo stesso nome, e PDF da solo. Dati finti.
const {chromium} = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
const srv = http.createServer((q, r) => { const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(e ? '' : d); }); }).listen(8791);
const xml = (num, cli, piva) => `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>99999999999</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>ITEAM SRLS</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore><CessionarioCommittente><DatiAnagrafici>${piva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${piva}</IdCodice></IdFiscaleIVA>` : '<CodiceFiscale>RSSMRA80A01L219X</CodiceFiscale>'}<Anagrafica>${piva ? `<Denominazione>${cli}</Denominazione>` : '<Nome>Mario</Nome><Cognome>Rossi</Cognome>'}</Anagrafica></DatiAnagrafici><Sede><Indirizzo>Via Prova</Indirizzo><NumeroCivico>3</NumeroCivico><CAP>10024</CAP><Comune>Moncalieri</Comune><Provincia>TO</Provincia></Sede></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-20</Data><Numero>${num}</Numero><ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DettaglioLinee><Descrizione>Installazione climatizzatore</Descrizione></DettaglioLinee><DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>1000.00</ImponibileImporto><Imposta>220.00</Imposta></DatiRiepilogo></DatiBeniServizi><DatiPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-12-20</DataScadenzaPagamento></DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
const dir = '/tmp/provafat'; fs.mkdirSync(dir, {recursive: true});
fs.writeFileSync(dir + '/IT01_a1.xml', xml('45', 'Condominio Prova', '01234567890')); fs.writeFileSync(dir + '/IT01_a1.pdf', '%PDF-1.4 prova');
fs.writeFileSync(dir + '/IT01_a2.xml', xml('46', '', '')); fs.writeFileSync(dir + '/fattura-47.pdf', '%PDF-1.4 prova');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({viewport: {width: 1200, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route(/^https:\/\//, r => r.fulfill({body: '', contentType: 'text/javascript'}));
  await p.addInitScript({path: 'test/fbmock.js'});
  await p.addInitScript(() => { window.__nextUser = {uid: 'u1', email: 'carone.t46@gmail.com', emailVerified: true, displayName: 'Tommaso Carone'};
    Object.assign(window.__store, {clienti: {c1: {nome: 'Condominio Prova', piva: 'IT01234567890'}}, fatture: {}, utenti: {u1: {email: 'carone.t46@gmail.com', nome: 'Tommaso Carone', ruolo: 'admin', attivo: true}}}); });
  await p.route('**/firebase-config.js', r => r.fulfill({body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"p"};', contentType: 'text/javascript'}));
  await p.goto('http://localhost:8791/index.html'); await p.waitForTimeout(500); await p.click('#gGoogle'); await p.waitForTimeout(1000);
  await p.click('[data-mode="ufficio"] >> nth=0').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-tab="altro"]'); await p.waitForTimeout(300); await p.click('[data-altro="contab"]'); await p.waitForTimeout(500);
  await p.click('[data-consez="vendite"]'); await p.waitForTimeout(400);
  console.log('PULSANTI:', await p.innerText('[data-contab="upv"]'), '|', await p.innerText('[data-contab="newv"]'));
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-contab="upv"]')]);
  await fc.setFiles(['IT01_a1.xml', 'IT01_a1.pdf', 'IT01_a2.xml', 'fattura-47.pdf'].map(n => dir + '/' + n));
  await p.waitForTimeout(2500);
  console.log('SCHEDA PDF aperta:', await p.isVisible('.ov'), (await p.innerText('.ov')).replace(/\s+/g, ' ').slice(0, 160));
  await p.screenshot({path: '/home/claude/work/vendite-pdf.png'});
  const st = await p.evaluate(() => ({fat: Object.values(window.__store.fatture).map(f => [f.numero, f.clienteId, f.imponibile, f.iva, f.scadenza, f.metodo, f.file && f.file.nome, f.descrizione]), cli: Object.values(window.__store.clienti).map(c => [c.nome, c.cf, c.citta])}));
  console.log(JSON.stringify(st, null, 1));
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove())); await p.waitForTimeout(300);
  // ricarico lo stesso XML: deve saltarlo
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-contab="upv"]')]); await fc2.setFiles([dir + '/IT01_a1.xml']); await p.waitForTimeout(1200);
  console.log('DOPPIONE:', (await p.innerText('body')).match(/già presenti[^·\n]*/)?.[0], Object.keys(await p.evaluate(() => window.__store.fatture)).length);
  await p.click('[data-contab="newv"]'); await p.waitForTimeout(300); console.log('A MANO:', (await p.innerText('.ov')).slice(0, 20));
  await p.evaluate(() => document.querySelectorAll('.ov').forEach(o => o.remove())); await p.waitForTimeout(300);
  await p.screenshot({path: '/home/claude/work/vendite.png'});
  console.log('errors', errs); await b.close(); srv.close();
})();
