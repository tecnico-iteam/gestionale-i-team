// Prova: promemoria email ai clienti (scripts/promemoria-clienti.js) con un finto database
const {esegui} = require('../scripts/promemoria-clienti.js');
const dati = {
  interventi: {
    a: {clienteId: 'c1', data: '2026-11-16', ora: '09:00', tipo: 'Manutenzione', tecnico: 'Maurizio Failaci', stato: 'Programmato'},
    b: {clienteId: 'c2', data: '2026-11-16', ora: '14:30', tipo: 'Installazione', stato: 'Programmato'},
    c: {clienteId: 'c3', data: '2026-11-16', ora: '', tipo: 'Riparazione', stato: 'Programmato'},
    d: {clienteId: 'c1', data: '2026-11-16', ora: '16:00', stato: 'Annullato'},
    e: {clienteId: 'c1', data: '2026-11-17', ora: '10:00', stato: 'Programmato'}
  },
  clienti: {c1: {nome: 'Rossi Mario', email: 'mario@example.com', indirizzo: 'Via Roma 1', citta: 'Torino'}, c2: {nome: 'Bianchi', email: ''}, c3: {nome: 'Verdi', email: 'v@example.com', noPromemoria: true}},
  promemoriaClienti: {}
};
const doc = (col, id) => ({_col: col, id, async get(){ const v = (dati[col] || {})[id]; return {id, exists: !!v, data: () => v}; }, async set(v, o){ dati[col] = dati[col] || {}; dati[col][id] = o && o.merge ? {...(dati[col][id] || {}), ...v} : v; }});
const db = {
  collection: col => ({doc: id => doc(col, id), where: (k, op, val) => ({async get(){ return {docs: Object.entries(dati[col] || {}).filter(([, v]) => v[k] === val).map(([id, v]) => ({id, data: () => v}))}; }})}),
  getAll: async (...refs) => Promise.all(refs.map(r => r.get()))
};
(async () => {
  const mail = [];
  const invia = async m => mail.push(m);
  await esegui({db, invia, now: new Date('2026-11-15T15:00:00Z'), log: m => console.log('16:00 →', m)});
  await esegui({db, invia, now: new Date('2026-11-15T16:10:00Z'), log: m => console.log('17:10 →', m)});
  await esegui({db, invia, now: new Date('2026-11-15T16:20:00Z'), log: m => console.log('17:20 →', m)});
  console.log('email inviate:', mail.length, mail.map(m => m.to + ' | ' + m.subject));
  console.log('---\n' + mail[0].text);
  dati.interventi.a.ora = '11:00';
  await esegui({db, invia, now: new Date('2026-11-15T17:00:00Z'), log: m => console.log('18:00 (spostato) →', m)});
})();
