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
  return {nome, docs, tolti, out};
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
    .then(r => copiaPerEmail(r)).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

// Copia FUORI da Firebase: ogni domenica (o con EMAIL_ORA=1) il backup compresso arriva per email al titolare.
// Così, anche se Firebase avesse un problema, i dati sono anche nella sua casella. Mittente: ufficio@iteamservice.it.
async function copiaPerEmail({out, docs}){
  const pass = process.env.SMTP_PASSWORD, oggi = new Date();
  if (!pass) { console.log("Manca SMTP_PASSWORD: copia per email non inviata"); return; }
  if (oggi.getUTCDay() !== 0 && !process.env.EMAIL_ORA) return;
  const zlib = require("zlib"), nodemailer = require("nodemailer");
  const giorno = oggi.toISOString().slice(0, 10), gz = zlib.gzipSync(JSON.stringify(out));
  const user = process.env.SMTP_USER || "ufficio@iteamservice.it";
  const tr = nodemailer.createTransport({host: process.env.SMTP_HOST || "smtp.hostinger.com", port: 465, secure: true, auth: {user, pass}});
  await tr.sendMail({from: `"Gestionale iTeam" <${user}>`, to: process.env.BACKUP_EMAIL || "carone.t46@gmail.com",
    subject: `Copia di sicurezza gestionale – ${giorno}`,
    text: `Ciao Tommaso,\n\nin allegato la copia di sicurezza settimanale del gestionale (${docs} schede: clienti, interventi, fatture, magazzino…).\n\n` +
      `Non serve fare niente: tienila nella posta. Se un giorno servisse ripristinare i dati, si apre il gestionale → 👤 → Backup → Importa e si sceglie questo file.\n` +
      `Le foto e i PDF restano in Firebase; qui ci sono tutti i dati scritti.\n\nAttenzione: contiene i dati dei clienti, non inoltrarla.\n`,
    attachments: [{filename: `backup-gestionale-${giorno}.json.gz`, content: gz}]});
  console.log(`Copia per email inviata (${Math.round(gz.length / 1024)} KB)`);
}
