// Allarmi ai tecnici (notifica forte: suono, vibrazione, resta sullo schermo), dal lunedì al venerdì:
//  - alle 8: "⏰ Hai aperto l'attività?" a chi non ha ancora aperto la giornata (giornate/{data}_{tecnico}, creato dal pulsante
//    "Apri l'attività" o da ▶ Inizia) e non è in ferie/permesso/malattia per tutto il giorno (oreLibere);
//  - alle 17:30: "📝 Hai compilato il rapportino?" a chi ha lavori di oggi (o iniziati e non chiusi) senza rapportino inviato.
// Gira da .github/workflows/allarmi.yml (poco prima: aspetta l ora esatta) e, come riserva, dal workflow degli avvisi
// (manda solo tra le 8 e le 10). Ogni tecnico riceve l'allarme una volta sola: allarmi/mattina-{data}-{tecnico} creato con create().
"use strict";
const {adessoRoma} = require("./avvisi.js");
const APP_URL = "https://tecnico-iteam.github.io/gestionale-i-team/";
const TURNI = {mattina: {ora: 8 * 60, fino: 10 * 60, nome: "delle 8"}, sera: {ora: 17 * 60 + 30, fino: 19 * 60 + 30, nome: "delle 17:30"}};
const turnoDa = min => min >= TURNI.sera.ora - 40 ? "sera" : "mattina";
const addGiorni = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const norm = s => String(s || "").trim().toLowerCase();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const giornataId = (tec, data) => data + "_" + slug(tec);

async function esegui({db, messaging, now = new Date(), aspetta = false, turno, log = console.log, dorme = ms => new Promise(r => setTimeout(r, ms))}){
  let {data: oggi, min} = adessoRoma(now);
  turno = turno || turnoDa(min); const T = TURNI[turno];
  const g = new Date(oggi + "T12:00:00Z").getUTCDay();
  if (g === 0 || g === 6) { log("Fine settimana: niente allarme."); return {inviati: 0}; }
  if (min < T.ora) {
    if (!aspetta || T.ora - min > 40) { log(`Allarme ${T.nome}: non è ancora l'ora.`); return {inviati: 0}; }
    log(`Aspetto l'ora dell'allarme ${T.nome} (${T.ora - min} minuti)…`); await dorme((T.ora - min) * 60000 - now.getSeconds() * 1000); min = T.ora;
  }
  if (min > T.fino) { log(`Allarme ${T.nome}: è passata l'ora, non parte più.`); return {inviati: 0}; }
  const [cfg, disp, gior, lib, ints] = await Promise.all([db.collection("config").doc("impostazioni").get(), db.collection("dispositivi").get(),
    db.collection("giornate").where("data", "==", oggi).get(), db.collection("oreLibere").get(),
    turno === "sera" ? db.collection("interventi").where("data", ">=", addGiorni(oggi, -14)).get() : null]);
  const tecnici = ((cfg.exists && cfg.data().tecnici) || []).map(t => t && t.nome).filter(Boolean);
  const tokens = {}; disp.docs.forEach(d => { const t = norm(d.data().tecnico); if (t) (tokens[t] = tokens[t] || []).push(d.id); });
  const aperte = new Set(gior.docs.map(d => norm(d.data().tecnico)));
  const assenti = new Set(lib.docs.map(d => d.data()).filter(e => ["Ferie", "Permesso", "Malattia"].includes(e.tipo) && Number(e.minuti) >= 480 && e.data <= oggi && (e.dataFine || e.data) >= oggi).map(e => norm(e.tecnico)));
  // sera: lavori di oggi (o iniziati e non chiusi) senza rapportino inviato, per tecnico
  const senzaRap = {};
  if (ints) ints.docs.forEach(d => { const x = d.data(); if (x.stato === "Annullato" || x.stato === "Completato" || (x.rapportino && x.rapportino.inviatoIl)) return;
    if (!(x.data === oggi || x.stato === "In corso")) return;
    [x.tecnico, x.tecnico2].filter(Boolean).forEach(t => { senzaRap[norm(t)] = (senzaRap[norm(t)] || 0) + 1; }); });
  let inviati = 0;
  for (const tec of tecnici) {
    const t = norm(tec);
    if (assenti.has(t) || !tokens[t]) continue;
    if (turno === "mattina" && aperte.has(t)) continue;
    if (turno === "sera" && !senzaRap[t]) continue;
    try { await db.collection("allarmi").doc(turno + "-" + giornataId(tec, oggi)).create({tecnico: tec, data: oggi, turno, il: new Date().toISOString()}); } catch(e) { continue; } // già mandato
    const n = senzaRap[t] || 0;
    const titolo = turno === "sera" ? "📝 Sono le 17:30: hai compilato il rapportino?" : "⏰ Sono le 8: hai aperto l'attività?";
    const corpo = turno === "sera" ? `Hai ${n === 1 ? "un lavoro" : n + " lavori"} di oggi senza rapportino. Apri il gestionale e invialo prima di staccare.` : "Apri il gestionale e tocca 🟢 Apri l'attività (oppure ▶ Inizia sul primo lavoro).";
    const tag = turno === "sera" ? "rapportino" : "apertura";
    const r = await messaging.sendEach(tokens[t].map(token => ({token, data: {title: titolo, body: corpo, tag, url: APP_URL, forte: "1"},
      webpush: {headers: {Urgency: "high", TTL: "7200"}, notification: {title: titolo, body: corpo, tag, renotify: true, requireInteraction: true, vibrate: [600, 200, 600, 200, 900], icon: APP_URL + "icons/icon-192.png"}, fcmOptions: {link: APP_URL}}})));
    r.responses.forEach((res, j) => { if (res.success) inviati++; else { const code = res.error && res.error.code; log(`Invio non riuscito a ${tec}: ${code}`);
      if (/not-registered|invalid-registration|invalid-argument/.test(code || "")) db.collection("dispositivi").doc(tokens[t][j]).delete().catch(() => {}); } });
  }
  log(`${oggi}: allarme ${T.nome} · tecnici ${tecnici.length} · ${turno === "mattina" ? "già aperti " + aperte.size : "con rapportini mancanti " + Object.keys(senzaRap).length} · notifiche inviate ${inviati}`);
  return {inviati};
}
module.exports = {esegui, giornataId};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT."); process.exit(0); }
  const admin = require("firebase-admin");
  admin.initializeApp({credential: admin.credential.cert(JSON.parse(chiave))});
  esegui({db: admin.firestore(), messaging: admin.messaging(), aspetta: process.argv.includes("--aspetta"), turno: process.argv.includes("--sera") ? "sera" : process.argv.includes("--mattina") ? "mattina" : undefined}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
