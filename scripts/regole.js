// Pubblica da solo le regole di sicurezza (firestore.rules e storage.rules) quando cambiano nel repository.
// Gira su GitHub (.github/workflows/regole.yml). Se l'account di servizio non ha il permesso,
// il titolare le incolla a mano nella console Firebase (istruzioni in CLAUDE.md).
"use strict";
const fs = require("fs"), path = require("path");

async function esegui({admin, bucket, log = console.log}){
  const dir = path.join(__dirname, "..");
  const sr = admin.securityRules();
  await sr.releaseFirestoreRulesetFromSource(fs.readFileSync(path.join(dir, "firestore.rules"), "utf8"));
  log("Regole del database pubblicate");
  await sr.releaseStorageRulesetFromSource(fs.readFileSync(path.join(dir, "storage.rules"), "utf8"), bucket);
  log("Regole dei file pubblicate");
}
module.exports = {esegui};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT."); process.exit(0); }
  const cred = JSON.parse(chiave), admin = require("firebase-admin");
  const bucket = process.env.BUCKET || `${cred.project_id}.firebasestorage.app`;
  admin.initializeApp({credential: admin.credential.cert(cred), storageBucket: bucket});
  esegui({admin, bucket}).then(() => process.exit(0)).catch(e => {
    console.error("Pubblicazione delle regole non riuscita:", e.code || "", e.message || e);
    console.error("Vanno incollate a mano: Firebase → Firestore Database → Regole, e Firebase → Storage → Regole.");
    process.exit(1);
  });
}
