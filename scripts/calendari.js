// Trasferimento degli appuntamenti dal calendario dell'iPhone (iCloud) al gestionale. Gira ogni 10 minuti con gli avvisi
// (.github/workflows/avvisi.yml) finché in Firestore → calendariFeed/impostazioni c'è {icloudUrl} (il link del
// "Calendario pubblico" che il titolare incolla nel gestionale). Copia gli appuntamenti futuri in eventiCal/{id}:
// nel gestionale il titolare li trasforma uno per uno in interventi (eventiCal.convertito) o li salta (nascosto).
// Con "Ho finito" il gestionale cancella il link e la lista.
"use strict";

const GIORNI_PRIMA = 0, GIORNI_DOPO = 365;
const pad = n => String(n).padStart(2, "0");
const addGiorni = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function romaDa(d){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(d).map(x => [x.type, x.value]));
  return {data: `${p.year}-${p.month}-${p.day}`, ora: `${p.hour}:${p.minute}`};
}
const oggiRoma = () => romaDa(new Date()).data;

// ---------- 2) iPhone → gestionale ----------
function righe(txt){
  const out = [];
  for (const r of String(txt).replace(/\r\n/g, "\n").split("\n")) { if (/^[ \t]/.test(r) && out.length) out[out.length - 1] += r.slice(1); else if (r) out.push(r); }
  return out;
}
const unesc = v => String(v || "").replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
// valore di data/ora → {data, ora} in ora italiana; ora vuota = tutto il giorno
function quando(prop){
  if (!prop) return null;
  const v = prop.v, m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  if (!m[4]) return {data: `${m[1]}-${m[2]}-${m[3]}`, ora: ""};
  if (m[7]) return romaDa(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])));
  return {data: `${m[1]}-${m[2]}-${m[3]}`, ora: `${m[4]}:${m[5]}`}; // con TZID: lo trattiamo come ora locale italiana
}
function eventi(txt){
  const evs = []; let cur = null;
  for (const r of righe(txt)) {
    if (r === "BEGIN:VEVENT") { cur = {exdate: []}; continue; }
    if (r === "END:VEVENT") { if (cur) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = r.indexOf(":"); if (i < 0) continue;
    const testa = r.slice(0, i), v = r.slice(i + 1), nome = testa.split(";")[0].toUpperCase();
    if (nome === "EXDATE") v.split(",").forEach(x => { const q = quando({v: x}); if (q) cur.exdate.push(q.data); });
    else cur[nome] = {v, p: testa};
  }
  return evs;
}
const GG = {SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6};
// date in cui cade l'evento (ripetizioni semplici: giornaliere, settimanali, mensili, annuali)
function ricorrenze(ini, rrule, da, a){
  if (!rrule) return [ini];
  const R = Object.fromEntries(rrule.split(";").map(x => x.split("=")));
  const passo = Math.max(1, +(R.INTERVAL || 1)), fino = R.UNTIL ? (quando({v: R.UNTIL}) || {}).data : "", max = R.COUNT ? +R.COUNT : 2000;
  const byday = R.BYDAY ? R.BYDAY.split(",").map(x => GG[x.slice(-2)]).filter(x => x !== undefined) : null;
  const out = []; let n = 0, d = ini;
  for (let k = 0; k < 4000 && n < max; k++) {
    if (fino && d > fino) break;
    if (d > a) break;
    const giorni = R.FREQ === "WEEKLY" && byday ? (() => { const g = new Date(d + "T12:00:00Z"), lun = addGiorni(d, -((g.getUTCDay() + 6) % 7)); return byday.map(w => addGiorni(lun, (w + 6) % 7)).sort(); })() : [d];
    for (const x of giorni) { if (x < ini || (fino && x > fino) || n >= max) continue; n++; if (x >= da && x <= a) out.push(x); }
    if (R.FREQ === "DAILY") d = addGiorni(d, passo);
    else if (R.FREQ === "WEEKLY") d = addGiorni(d, 7 * passo);
    else if (R.FREQ === "MONTHLY") { const g = new Date(d + "T12:00:00Z"); g.setUTCMonth(g.getUTCMonth() + passo); d = g.toISOString().slice(0, 10); }
    else if (R.FREQ === "YEARLY") { const g = new Date(d + "T12:00:00Z"); g.setUTCFullYear(g.getUTCFullYear() + passo); d = g.toISOString().slice(0, 10); }
    else break;
  }
  return out;
}
const idDi = s => require("crypto").createHash("sha1").update(s).digest("hex").slice(0, 24);
async function importa({db, cfg, log, scarica}){
  const url = String(cfg.icloudUrl || "").trim().replace(/^webcal:\/\//i, "https://");
  const r = await scarica(url);
  if (!r.ok) throw new Error(`il link del calendario risponde ${r.status}`);
  const txt = await r.text();
  if (!/BEGIN:VCALENDAR/.test(txt)) throw new Error("il link non contiene un calendario");
  const oggi = oggiRoma(), da = addGiorni(oggi, -GIORNI_PRIMA), a = addGiorni(oggi, GIORNI_DOPO);
  const nuovi = {};
  const tutti = eventi(txt);
  const cambiati = new Set(tutti.filter(e => e["RECURRENCE-ID"]).map(e => (e.UID || {}).v + "|" + (quando(e["RECURRENCE-ID"]) || {}).data));
  for (const e of tutti) {
    const uid = (e.UID || {}).v || "";
    if (/@gestionale-iteam$/i.test(uid) || /CANCELLED/i.test((e.STATUS || {}).v || "")) continue;
    const s = quando(e.DTSTART); if (!s) continue;
    const f = quando(e.DTEND) || s;
    const durata = Math.max(0, Math.round((new Date(f.data + "T12:00:00Z") - new Date(s.data + "T12:00:00Z")) / 864e5) - (s.ora ? 0 : 1));
    const date = e["RECURRENCE-ID"] ? [s.data] : ricorrenze(s.data, (e.RRULE || {}).v, da, a).filter(x => !e.exdate.includes(x) && !cambiati.has(uid + "|" + x));
    for (const d of date) {
      if (d < da || d > a) continue;
      const id = idDi(uid + "|" + d);
      nuovi[id] = {uid, titolo: unesc((e.SUMMARY || {}).v) || "Appuntamento", luogo: unesc((e.LOCATION || {}).v), note: unesc((e.DESCRIPTION || {}).v).slice(0, 1500),
        data: d, dataFine: durata > 0 ? addGiorni(d, durata) : "", ora: s.ora, oraFine: s.ora && f.data === s.data ? f.ora : "", fonte: "iPhone"};
    }
  }
  const vecchi = await db.collection("eventiCal").get();
  const batch = []; let agg = 0, tolti = 0;
  for (const d of vecchi.docs) {
    const x = d.data();
    if (!nuovi[d.id]) { if (!x.convertito || x.data < da) { batch.push(d.ref.delete()); tolti++; } continue; }
    const n = nuovi[d.id]; delete nuovi[d.id];
    if (["titolo", "luogo", "note", "data", "dataFine", "ora", "oraFine"].some(k => (x[k] || "") !== (n[k] || ""))) { batch.push(d.ref.set({...n, convertito: !!x.convertito, nascosto: !!x.nascosto}, {merge: true})); agg++; }
  }
  for (const [id, n] of Object.entries(nuovi)) { batch.push(db.collection("eventiCal").doc(id).set(n)); agg++; }
  await Promise.all(batch);
  log(`Calendario iPhone: ${agg} aggiornati, ${tolti} tolti`);
  return Object.keys(nuovi).length + vecchi.size;
}

async function esegui({db, log = console.log, scarica = (u) => fetch(u)}){
  const ref = db.doc("calendariFeed/impostazioni"), snap = await ref.get();
  if (!snap.exists || !snap.data().icloudUrl) { log("Nessun calendario iPhone da trasferire"); return; }
  const cfg = snap.data(), stato = {controllato: new Date().toISOString()};
  if (cfg.icloudUrl) { try { await importa({db, cfg, log, scarica}); stato.importato = stato.controllato; stato.erroreImport = ""; } catch(e) { stato.erroreImport = String(e.message || e); log("Errore importazione: " + stato.erroreImport); } }
  await ref.set(stato, {merge: true});
}
module.exports = {esegui, eventi, ricorrenze, quando};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT: calendari non attivi."); process.exit(0); }
  const cred = JSON.parse(chiave);
  const admin = require("firebase-admin");
  admin.initializeApp({credential: admin.credential.cert(cred)});
  esegui({db: admin.firestore()}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
