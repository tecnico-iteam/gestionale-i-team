// Promemoria ai CLIENTI il giorno prima dell'appuntamento, via email.
// Gira insieme agli avvisi dei tecnici (.github/workflows/avvisi.yml, ogni 10 minuti) ma invia solo dalle 17:00 (ora italiana)
// per gli interventi "Programmato" di domani. Ogni email parte una volta sola: si segna in promemoriaClienti/{idIntervento}.mail
// (se l'appuntamento viene spostato a un'altra data o ora, il promemoria riparte).
// Il WhatsApp ai clienti lo manda l'ufficio con un tocco dalla pagina "Oggi" del gestionale (promemoriaClienti/{id}.wa).
// Mittente: ufficio@iteamservice.it (Hostinger). La password sta nel segreto GitHub SMTP_PASSWORD, mai nel repository.
"use strict";

const ORA_INVIO = 17 * 60; // dalle 17:00
const UFFICIO = {nome: "iTeam", email: "ufficio@iteamservice.it", tel: "+39 345 0736526", indirizzo: "Via dei Mille 2, Moncalieri (TO)"};
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function adessoRoma(d = new Date()){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(d).map(x => [x.type, x.value]));
  return {data: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute)};
}
const addGiorni = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const giornoLungo = s => { const d = new Date(s + "T12:00:00Z"); return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`; };
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c]));

function componi(x, c){
  const quando = `domani, ${giornoLungo(x.data)}${x.ora ? ", alle " + x.ora : ""}`;
  const dove = [c.indirizzo, c.citta].filter(Boolean).join(", ");
  const lavoro = String(x.tipo || "intervento").toLowerCase();
  const oggetto = `⚠️ Promemoria: appuntamento ${UFFICIO.nome} domani${x.ora ? " alle " + x.ora : ""}`;
  const righe = [
    `Gentile ${c.nome || "cliente"},`,
    "",
    `le ricordiamo l'appuntamento con ${UFFICIO.nome} per ${lavoro} ${quando}${dove ? ", in " + dove : ""}.`,
    x.tecnico ? `Il tecnico sarà ${x.tecnico}.` : "",
    "",
    `Se ha bisogno di spostarlo o annullarlo ci contatti al ${UFFICIO.tel} (anche WhatsApp) o rispondendo a questa email.`,
    "",
    "Grazie e a domani,",
    `${UFFICIO.nome} – Climatizzazione e fotovoltaico`,
    `${UFFICIO.indirizzo} · ${UFFICIO.tel} · ${UFFICIO.email}`
  ].filter((r, i, a) => !(r === "" && a[i - 1] === ""));
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2933;max-width:560px">
<p style="background:#fff4d6;border-radius:8px;padding:10px 14px;font-weight:bold;margin:0 0 16px">⚠️ Promemoria appuntamento: ${esc(quando)}</p>
<p>Gentile ${esc(c.nome || "cliente")},</p>
<p>le ricordiamo l'appuntamento con <b>${esc(UFFICIO.nome)}</b> per <b>${esc(lavoro)}</b> <b>${esc(quando)}</b>${dove ? `, in ${esc(dove)}` : ""}.${x.tecnico ? `<br>Il tecnico sarà <b>${esc(x.tecnico)}</b>.` : ""}</p>
<p>Se ha bisogno di spostarlo o annullarlo ci contatti al <a href="tel:${UFFICIO.tel.replace(/\s/g, "")}">${esc(UFFICIO.tel)}</a> (anche WhatsApp) o rispondendo a questa email.</p>
<p>Grazie e a domani,<br><b>${esc(UFFICIO.nome)}</b> – Climatizzazione e fotovoltaico<br><span style="color:#5a6672;font-size:13px">${esc(UFFICIO.indirizzo)} · ${esc(UFFICIO.tel)} · ${esc(UFFICIO.email)}</span></p>
</div>`;
  return {oggetto, testo: righe.join("\n"), html};
}

async function esegui({db, invia, now = new Date(), log = console.log}){
  const {data: oggi, min} = adessoRoma(now);
  if (min < ORA_INVIO) { log("Promemoria clienti: si inviano dalle 17:00"); return {inviate: 0, saltate: 0}; }
  const domani = addGiorni(oggi, 1);
  const snap = await db.collection("interventi").where("data", "==", domani).get();
  const ints = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(x => x.stato === "Programmato" && x.clienteId);
  if (!ints.length) { log(`Promemoria clienti: nessun appuntamento il ${domani}`); return {inviate: 0, saltate: 0}; }
  const stati = {}, clienti = {};
  (await db.getAll(...ints.map(x => db.collection("promemoriaClienti").doc(x.id)))).forEach(s => { stati[s.id] = s.exists ? s.data() : {}; });
  const cids = [...new Set(ints.map(x => x.clienteId))];
  (await db.getAll(...cids.map(id => db.collection("clienti").doc(id)))).forEach(s => { if (s.exists) clienti[s.id] = s.data(); });
  let inviate = 0, saltate = 0;
  for (const x of ints) {
    const sig = `${x.data}|${x.ora || ""}`, st = stati[x.id] || {}, c = clienti[x.clienteId];
    if (st.mail === sig) continue;
    if (!c || c.noPromemoria || !emailOk(c.email)) { saltate++; continue; }
    const m = componi(x, c);
    try {
      await invia({to: String(c.email).trim(), subject: m.oggetto, text: m.testo, html: m.html});
      await db.collection("promemoriaClienti").doc(x.id).set({mail: sig, mailIl: now.toISOString(), mailA: String(c.email).trim()}, {merge: true});
      inviate++;
    } catch(e) { log(`Email non inviata a ${c.nome || x.clienteId}: ${e && (e.code || e.message)}`); }
  }
  log(`Promemoria clienti per ${domani}: email inviate ${inviate}${saltate ? ` · senza email o disattivati ${saltate}` : ""}`);
  return {inviate, saltate};
}

module.exports = {esegui, componi, adessoRoma};

if (require.main === module) {
  const chiave = process.env.FIREBASE_SERVICE_ACCOUNT, pass = process.env.SMTP_PASSWORD;
  if (!chiave) { console.log("Manca il segreto FIREBASE_SERVICE_ACCOUNT."); process.exit(0); }
  if (!pass) { console.log("Manca il segreto SMTP_PASSWORD: email ai clienti non ancora attive."); process.exit(0); }
  const admin = require("firebase-admin"), nodemailer = require("nodemailer");
  admin.initializeApp({credential: admin.credential.cert(JSON.parse(chiave))});
  const user = process.env.SMTP_USER || UFFICIO.email;
  const tr = nodemailer.createTransport({host: process.env.SMTP_HOST || "smtp.hostinger.com", port: 465, secure: true, auth: {user, pass}});
  const invia = m => tr.sendMail({from: `"${UFFICIO.nome}" <${user}>`, replyTo: UFFICIO.email, ...m});
  esegui({db: admin.firestore(), invia}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
