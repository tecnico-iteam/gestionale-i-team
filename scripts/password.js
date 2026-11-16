// Cambio password degli account, deciso dal titolare (pulsante 🔑 nel gestionale).
// Il titolare scrive la nuova password in utenti/{uid}.nuovaPassword (solo l'amministratore può scrivere lì,
// vedi firestore.rules). Questo script gira su GitHub insieme agli avvisi (ogni 10 minuti),
// applica la password all'account e la cancella subito dal database.
"use strict";

const ADESSO = () => new Date().toISOString();

async function esegui({db, auth, FieldValue, log = console.log}){
  const snap = await db.collection("utenti").where("nuovaPassword", ">", "").get();
  let ok = 0, ko = 0;
  for (const d of snap.docs) {
    const x = d.data(), pw = String(x.nuovaPassword || "");
    const via = {nuovaPassword: FieldValue.delete(), nuovaPasswordIl: FieldValue.delete()};
    try {
      if (pw.length < 6) throw {code: "auth/invalid-password"};
      await auth.updateUser(d.id, {password: pw});
      await d.ref.update({...via, passwordCambiata: ADESSO(), passwordErrore: FieldValue.delete()});
      ok++; log(`Password cambiata: ${x.nome || d.id}`);
    } catch(e) {
      const code = e && e.code;
      const msg = code === "auth/user-not-found" ? "Account non trovato: forse è stato eliminato"
        : code === "auth/invalid-password" ? "Password non valida: servono almeno 6 caratteri"
        : "Cambio non riuscito, riprova";
      await d.ref.update({...via, passwordErrore: msg, passwordErroreIl: ADESSO()}).catch(() => {});
      ko++; log(`Cambio password non riuscito (${x.nome || d.id}): ${code || e}`);
    }
  }
  log(`Cambi password: ${ok} fatti${ko ? `, ${ko} non riusciti` : ""}`);
  return {ok, ko};
}

module.exports = {esegui};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT: cambio password non attivo."); process.exit(0); }
  const admin = require("firebase-admin");
  admin.initializeApp({credential: admin.credential.cert(JSON.parse(chiave))});
  esegui({db: admin.firestore(), auth: admin.auth(), FieldValue: admin.firestore.FieldValue})
    .then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
