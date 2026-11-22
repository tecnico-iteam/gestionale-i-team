// Importazione sicura di dati riservati preparati da Claude (es. furgoni con libretti e fatture), senza metterli in chiaro nel repository pubblico.
// 1) Senza importa/pacchetto.enc: crea una coppia di chiavi; la privata resta in Firebase Storage (importa/chiave-privata.pem, nessun accesso
//    dall'app), la pubblica si stampa nel registro dell'esecuzione. 2) Con importa/pacchetto.enc (cifrato con la chiave pubblica: RSA-OAEP +
//    AES-256-GCM): lo apre, carica i file in media/ e scrive i documenti in Firestore (set con merge), poi DISTRUGGE la chiave privata.
"use strict";
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const FILE = path.join(__dirname, "..", "importa", "pacchetto.enc"), CHIAVE = "importa/chiave-privata.pem";
const COLL_OK = new Set(["mezzi", "attrezzature"]);

async function esegui({db, bucket, log = console.log}){
  const k = bucket.file(CHIAVE);
  if (!fs.existsSync(FILE)) {
    const {publicKey, privateKey} = crypto.generateKeyPairSync("rsa", {modulusLength: 4096, publicKeyEncoding: {type: "spki", format: "pem"}, privateKeyEncoding: {type: "pkcs8", format: "pem"}});
    await k.save(privateKey, {contentType: "text/plain", resumable: false});
    log("CHIAVE PUBBLICA PER L'IMPORTAZIONE:\n" + publicKey);
    return {fase: "chiave"};
  }
  const [esiste] = await k.exists();
  if (!esiste) { log("Chiave privata non trovata (già usata o mai creata): niente da importare."); return {fase: "nessuna"}; }
  const [pem] = await k.download();
  const b = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const aes = crypto.privateDecrypt({key: pem.toString(), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256"}, Buffer.from(b.chiave, "base64"));
  const dec = crypto.createDecipheriv("aes-256-gcm", aes, Buffer.from(b.iv, "base64"));
  dec.setAuthTag(Buffer.from(b.tag, "base64"));
  const dati = JSON.parse(Buffer.concat([dec.update(Buffer.from(b.dati, "base64")), dec.final()]).toString("utf8"));
  // file allegati → media/ con link di download come quelli dell'app
  const nuovi = {};
  for (const [vecchio, dataUrl] of Object.entries(dati.media || {})) {
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/); if (!m) continue;
    const tipo = m[1], ext = (tipo.split("/")[1] || "bin").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
    const id = Date.now().toString(36) + crypto.randomBytes(4).toString("hex").slice(0, 6) + "." + ext, token = crypto.randomUUID();
    await bucket.file("media/" + id).save(Buffer.from(m[2], "base64"), {resumable: false, contentType: tipo, metadata: {metadata: {firebaseStorageDownloadTokens: token}}});
    nuovi[vecchio] = {id, url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent("media/" + id)}?alt=media&token=${token}`};
  }
  // "Tommaso" → nome esatto del tecnico registrato nel gestionale (es. "Carone Tommaso")
  let tec = []; try { const c = await db.collection("config").doc("impostazioni").get(); tec = ((c.exists && c.data().tecnici) || []).map(t => t.nome).filter(Boolean); } catch(e) {}
  const nomeTec = x => { if (!x) return x; const w = String(x).toLowerCase(); return tec.find(t => t.toLowerCase() === w) || tec.find(t => t.toLowerCase().split(/\s+/).includes(w)) || x; };
  let n = 0;
  for (const [col, lista] of Object.entries(dati.collections || {})) {
    if (!COLL_OK.has(col)) { log("Raccolta non permessa, saltata: " + col); continue; }
    for (const it of lista) {
      const {id, ...body} = it; if (!id) continue;
      if (body.tecnico) body.tecnico = nomeTec(body.tecnico);
      if (Array.isArray(body.documenti)) body.documenti = body.documenti.map(d => nuovi[d.id] ? {...d, ...nuovi[d.id]} : d);
      await db.collection(col).doc(String(id)).set(body, {merge: true});
      await db.collection("registro").add({col, docId: String(id), azione: "crea", titolo: body.nome || "", campi: Object.keys(body), chi: "Claude (importazione)", il: new Date().toISOString()});
      n++;
    }
  }
  await k.delete();
  log(`Importati ${n} elementi e ${Object.keys(nuovi).length} file. Chiave privata distrutta.`);
  return {fase: "importato", n};
}
module.exports = {esegui};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT."); process.exit(0); }
  const cred = JSON.parse(chiave), admin = require("firebase-admin");
  admin.initializeApp({credential: admin.credential.cert(cred), storageBucket: process.env.BUCKET || `${cred.project_id}.firebasestorage.app`});
  esegui({db: admin.firestore(), bucket: admin.storage().bucket()}).then(() => process.exit(0)).catch(e => { console.error(e && e.message || e); process.exit(1); });
}
