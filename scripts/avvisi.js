// Avvisi degli appuntamenti ai tecnici (notifiche sul telefono).
// Gira in automatico su GitHub ogni 10 minuti (.github/workflows/avvisi.yml):
//  - "Nuovo appuntamento" quando a un tecnico viene assegnato (o spostato) un intervento programmato;
//  - "Tra poco": entro 2 ore prima dell orario (GitHub fa girare il controllo circa ogni ora).
// Cosa è già stato avvisato si segna in avvisi/{idIntervento}, così ogni avviso parte una volta sola.
// La chiave di accesso a Firebase sta nel segreto GitHub FIREBASE_SERVICE_ACCOUNT (mai nel repository).
"use strict";

const APP_URL = "https://tecnico-iteam.github.io/gestionale-i-team/";
const PRIMA_MIN = 120; // il promemoria parte quando mancano al massimo 2 ore (GitHub spesso fa girare il controllo solo una volta l'ora)
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function adessoRoma(d = new Date()){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(d).map(x => [x.type, x.value]));
  return {data: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute)};
}
const addGiorni = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const minuti = ora => { const m = /^(\d{1,2}):(\d{2})$/.exec(ora || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const norm = s => String(s || "").trim().toLowerCase();
function quando(x, oggi){
  const g = x.data === oggi ? "Oggi" : x.data === addGiorni(oggi, 1) ? "Domani" : (() => { const d = new Date(x.data + "T12:00:00Z"); return GIORNI[d.getUTCDay()] + " " + x.data.slice(8, 10) + "/" + x.data.slice(5, 7); })();
  return g.charAt(0).toUpperCase() + g.slice(1) + (x.ora ? " alle " + x.ora : "");
}

async function esegui({db, messaging, now = new Date(), log = console.log}){
  const {data: oggi, min: oraMin} = adessoRoma(now);
  const [dispSnap, intSnap, cfgSnap] = await Promise.all([
    db.collection("dispositivi").get(),
    db.collection("interventi").where("data", ">=", oggi).get(),
    db.collection("config").doc("avvisi").get()
  ]);
  const tokens = {};
  dispSnap.docs.forEach(d => { const t = norm(d.data().tecnico); if (t) (tokens[t] = tokens[t] || []).push(d.id); });
  // un appuntamento può avere due tecnici: ognuno riceve i suoi avvisi (stato in avvisi/{id} e avvisi/{id}-2)
  const ints = [];
  intSnap.docs.forEach(d => { const x = {id: d.id, ...d.data()}; if (x.stato !== "Programmato") return;
    if (norm(x.tecnico)) ints.push({...x, _doc: x.id, _tec: norm(x.tecnico)});
    if (norm(x.tecnico2) && norm(x.tecnico2) !== norm(x.tecnico)) ints.push({...x, _doc: x.id + "-2", _tec: norm(x.tecnico2)}); });
  const stati = {};
  if (ints.length) (await db.getAll(...ints.map(x => db.collection("avvisi").doc(x._doc)))).forEach(s => { stati[s.id] = s.exists ? s.data() : {}; });
  const prima = !cfgSnap.exists; // primo avvio: segna tutto come già avvisato, senza inviare nulla
  const clienti = {};
  const cids = [...new Set(ints.map(x => x.clienteId).filter(Boolean))];
  if (cids.length && !prima) (await db.getAll(...cids.map(id => db.collection("clienti").doc(id)))).forEach(s => { if (s.exists) clienti[s.id] = s.data(); });

  const invii = [], scritture = [];
  for (const x of ints) {
    const tec = x._tec, sig = [tec, x.data, x.ora || ""].join("|"), st = stati[x._doc] || {};
    const inizio = minuti(x.ora), mancano = x.data === oggi && inizio !== null ? inizio - oraMin : null;
    const passato = x.data === oggi && mancano !== null && mancano < 0;
    const nuovo = st.sig !== sig, promemoria = mancano !== null && mancano >= 0 && mancano <= PRIMA_MIN && st.promemoria !== sig;
    if (!nuovo && !promemoria) continue;
    scritture.push([x._doc, {sig, tecnico: tec, ...(promemoria || passato || nuovo && mancano !== null && mancano <= PRIMA_MIN ? {promemoria: sig} : {}), aggiornato: now.toISOString()}]);
    if (prima || passato || !tokens[tec]) continue;
    const c = clienti[x.clienteId] || {}, dove = [c.indirizzo, c.citta].filter(Boolean).join(", ");
    const corpo = [quando(x, oggi) + " · " + (c.nome || "Cliente"), [x.tipo, dove].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
    const titolo = promemoria && !nuovo ? `⏰ Tra ${mancano < 60 ? mancano + " minuti" : Math.floor(mancano / 60) + (Math.floor(mancano / 60) === 1 ? " ora" : " ore") + (mancano % 60 ? " e " + (mancano % 60) + " min" : "")}: ${c.nome || "appuntamento"}`
      : st.sig && st.tecnico === tec ? "🔄 Appuntamento spostato" : "📅 Nuovo appuntamento";
    for (const token of tokens[tec]) invii.push({token, tec, titolo, corpo, tag: "int-" + x.id});
  }

  let ok = 0, ko = 0;
  for (let i = 0; i < invii.length; i += 400) {
    const parte = invii.slice(i, i + 400);
    const r = await messaging.sendEach(parte.map(v => ({
      token: v.token,
      data: {title: v.titolo, body: v.corpo, tag: v.tag, url: APP_URL},
      webpush: {headers: {Urgency: "high", TTL: "21600"}, notification: {title: v.titolo, body: v.corpo, tag: v.tag, icon: APP_URL + "icons/icon-192.png"}, fcmOptions: {link: APP_URL}}
    })));
    for (let j = 0; j < r.responses.length; j++) {
      const res = r.responses[j];
      if (res.success) { ok++; continue; }
      ko++;
      const code = res.error && res.error.code;
      log(`Invio non riuscito a ${parte[j].tec}: ${code}`);
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument")
        await db.collection("dispositivi").doc(parte[j].token).delete().catch(() => {});
    }
  }
  for (const [id, body] of scritture) await db.collection("avvisi").doc(id).set(body, {merge: true});
  if (prima) await db.collection("config").doc("avvisi").set({attivatoIl: now.toISOString()});
  log(`${oggi} ${String(Math.floor(oraMin / 60)).padStart(2, "0")}:${String(oraMin % 60).padStart(2, "0")} · appuntamenti controllati: ${ints.length} · notifiche inviate: ${ok}${ko ? ` · non riuscite: ${ko}` : ""}${prima ? " · primo avvio (nessun invio)" : ""}`);
  return {ok, ko, invii, scritture, prima};
}

module.exports = {esegui, adessoRoma};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT: avvisi non ancora attivi."); process.exit(0); }
  const admin = require("firebase-admin");
  admin.initializeApp({credential: admin.credential.cert(JSON.parse(chiave))});
  esegui({db: admin.firestore(), messaging: admin.messaging()}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
