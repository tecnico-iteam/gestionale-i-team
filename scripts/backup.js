// Copia di sicurezza notturna di tutto il database (gira su GitHub ogni notte, .github/workflows/backup.yml).
// Salva un file JSON in Firebase Storage → backups/backup-AAAA-MM-GG.json e tiene gli ultimi 30 giorni.
// Il file ha lo stesso formato del backup manuale (👤 → Backup) e si può reimportare da lì.
"use strict";

const GIORNI = 30;
const escluse = new Set(["dispositivi", "avvisi"]);   // dati tecnici che si ricreano da soli

async function esegui({db, bucket, log = console.log, oggi = new Date()}){
  const out = {app: "iteam-gestionale", versione: 1, esportato: oggi.toISOString(), automatico: true, collections: {}};
  let docs = 0;
  for (const col of await db.listCollections()) {
    if (escluse.has(col.id)) continue;
    const snap = await col.get();
    out.collections[col.id] = snap.docs.map(d => ({id: d.id, ...d.data()}));
    docs += snap.size;
  }
  // gli account restano, ma senza password in attesa
  (out.collections.utenti || []).forEach(u => { delete u.nuovaPassword; });
  const nome = `backups/backup-${oggi.toISOString().slice(0, 10)}.json`;
  await bucket.file(nome).save(JSON.stringify(out), {contentType: "application/json", resumable: false});
  log(`Backup salvato: ${nome} (${Object.keys(out.collections).length} raccolte, ${docs} documenti)`);
  const limite = new Date(oggi.getTime() - GIORNI * 86400000).toISOString().slice(0, 10);
  const [files] = await bucket.getFiles({prefix: "backups/"});
  let tolti = 0;
  for (const f of files) {
    const m = f.name.match(/backup-(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && m[1] < limite) { await f.delete().catch(() => {}); tolti++; }
  }
  if (tolti) log(`Tolti ${tolti} backup più vecchi di ${GIORNI} giorni`);
  return {nome, docs, tolti};
}

module.exports = {esegui};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT: backup non attivo."); process.exit(0); }
  const cred = JSON.parse(chiave);
  const admin = require("firebase-admin");
  const bucketName = process.env.BUCKET || `${cred.project_id}.firebasestorage.app`;
  admin.initializeApp({credential: admin.credential.cert(cred), storageBucket: bucketName});
  esegui({db: admin.firestore(), bucket: admin.storage().bucket()})
    .then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
