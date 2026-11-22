// Ogni notte ricalcola quali clienti sono "recenti" (attività nell'ultimo anno).
// I tecnici vedono solo i clienti con recente = true (lo impongono le regole del database);
// Tommaso e Irene vedono sempre tutti. Gira dopo il backup (.github/workflows/backup.yml).
"use strict";

const GIORNO = 864e5;

async function esegui({db, log = console.log, oggi = new Date()}){
  const lim = new Date(oggi.getTime() - 365 * GIORNO).toISOString().slice(0, 10);
  const last = {};
  const su = (id, d) => { d = String(d || "").slice(0, 10); if (id && d && (!last[id] || d > last[id])) last[id] = d; };
  const leggi = async col => { try { return (await db.collection(col).get()).docs.map(d => d.data()); } catch(e) { return []; } };
  (await leggi("interventi")).forEach(x => su(x.clienteId, x.dataFine && x.dataFine > (x.data || "") ? x.dataFine : x.data));
  (await leggi("preventivi")).forEach(x => su(x.clienteId, x.data));
  (await leggi("fatture")).forEach(x => su(x.clienteId, x.data));
  (await leggi("contratti")).forEach(x => su(x.clienteId, x.scadenza));
  (await leggi("commesse")).forEach(x => su(x.clienteId, x.aggiornato));
  (await leggi("dico")).forEach(x => su(x.clienteId, x.data || x.aggiornato));
  const clienti = (await db.collection("clienti").get()).docs;
  clienti.forEach(d => { const c = d.data(); if (!c.importatoIl) su(d.id, c.aggiornato); if (c.ultimoMs) su(d.id, new Date(c.ultimoMs).toISOString()); });
  let cambiati = 0, batch = db.batch(), n = 0;
  for (const d of clienti) {
    const c = d.data(), ld = last[d.id], rec = !!ld && ld >= lim;
    if (c.recente === rec) continue;
    batch.update(d.ref, {recente: rec, ...(ld && !c.ultimoMs ? {ultimoMs: new Date(ld + "T12:00:00Z").getTime()} : {})});
    cambiati++; if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  log(`Clienti: ${clienti.length}, recenti: ${clienti.filter(d => (last[d.id] || "") >= lim).length}, aggiornati: ${cambiati}`);
  return {cambiati};
}
module.exports = {esegui};

if (require.main === module) {
  const admin = require("firebase-admin");
  admin.initializeApp({credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
  esegui({db: admin.firestore()}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
