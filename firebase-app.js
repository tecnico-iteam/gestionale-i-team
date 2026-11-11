// iTeam Gestionale – collegamento a Firebase (dati, accessi, foto) e gestione utenti.
// Fornisce window.claude.use(...) con la stessa interfaccia usata dal gestionale,
// così il resto dell'app non cambia.
(() => {
"use strict";
const OWNER = "segreteria.iteam@gmail.com";
const RUOLI = [["admin", "Amministratore"], ["ufficio", "Ufficio"], ["tecnico", "Tecnico"], ["preventivatore", "Preventivatore"]];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cfg = window.FIREBASE_CONFIG || {};
const configured = !!(cfg.apiKey && !String(cfg.apiKey).includes("INSERIRE"));

let ready, resolveReady;
ready = new Promise(r => { resolveReady = r; });
let db = null, storage = null, auth = null, profilo = null, isOwner = false;

// ---------- stile della schermata di accesso ----------
const st = document.createElement("style");
st.textContent = `
#gate{position:fixed;inset:0;z-index:200;background:var(--bg,#f3f6f9);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}
#gate .box{background:#fff;border:1px solid #e1e7ec;border-radius:16px;padding:24px 20px;width:100%;max-width:400px;text-align:center}
#gate img{height:72px;margin:0 auto 12px;display:block}
#gate h2{margin:4px 0 6px;font-size:20px}
#gate p{color:#5f6f7c;font-size:14px;margin:6px 0 14px}
#gate input{width:100%;padding:11px 12px;border:1px solid #cfd8df;border-radius:10px;margin-bottom:8px;font:inherit}
#gate .g{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;border-radius:10px;border:1px solid #cfd8df;background:#fff;font:inherit;font-weight:600;cursor:pointer}
#gate .or{display:flex;align-items:center;gap:10px;color:#8a99a6;font-size:12px;margin:14px 0}
#gate .or:before,#gate .or:after{content:"";flex:1;height:1px;background:#e1e7ec}
#gate .p{width:100%;padding:12px;border-radius:10px;border:0;background:#3472c2;color:#fff;font:inherit;font-weight:650;cursor:pointer;margin-top:2px}
#gate .lk{background:none;border:0;color:#3472c2;font:inherit;font-size:13px;cursor:pointer;margin-top:10px}
#gate .err{color:#c0392b;font-size:13px;min-height:18px;margin-top:8px}
header.top h1{flex:0 0 auto}
header.top .who{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:400px){header.top{gap:6px;padding-left:10px;padding-right:10px}header.top .logo{height:32px}header.top .hbtn{padding:7px 8px}}
#uacc{position:fixed;inset:0;z-index:120;background:rgba(10,20,30,.45);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:700px){#uacc{align-items:center}}
#uacc .dlg{background:#fff;width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:16px}
@media(min-width:700px){#uacc .dlg{border-radius:16px}}
#uacc .u{border:1px solid #e1e7ec;border-radius:10px;padding:10px;margin-bottom:8px}
#uacc select{padding:7px;border:1px solid #cfd8df;border-radius:8px;font:inherit}
`;
document.head.appendChild(st);

function logoSrc(){ return document.querySelector(".logo")?.src || "icons/icon-192.png"; }
function gate(html){
  let g = document.getElementById("gate");
  if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
  g.innerHTML = `<div class="box"><img src="${logoSrc()}" alt="iTeam">${html}</div>`;
  return g;
}
function hideGate(){ document.getElementById("gate")?.remove(); }

const ERR = {
  "auth/invalid-credential": "Email o password non corretti",
  "auth/wrong-password": "Password non corretta",
  "auth/user-not-found": "Nessun account con questa email",
  "auth/email-already-in-use": "Esiste già un account con questa email: usa «Accedi»",
  "auth/weak-password": "La password deve avere almeno 6 caratteri",
  "auth/invalid-email": "Email non valida",
  "auth/popup-closed-by-user": "Accesso annullato",
  "auth/network-request-failed": "Nessuna connessione a internet",
  "auth/too-many-requests": "Troppi tentativi, riprova tra qualche minuto",
  "auth/unauthorized-domain": "Questo indirizzo non è ancora autorizzato in Firebase (Authentication → Impostazioni → Domini autorizzati)"
};
const errMsg = e => ERR[e && e.code] || (e && e.message) || "Errore";

function showLogin(msg = ""){
  const g = gate(`<h2>Gestionale iTeam</h2><p>Accedi con il tuo account per continuare.</p>
    <button class="g" id="gGoogle"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Accedi con Google</button>
    <div class="or">oppure con email</div>
    <input id="gNome" placeholder="Nome e cognome (solo per nuovo account)" autocomplete="name" hidden>
    <input id="gEmail" type="email" placeholder="Email" autocomplete="email">
    <input id="gPass" type="password" placeholder="Password" autocomplete="current-password">
    <button class="p" id="gLogin">Accedi</button>
    <button class="lk" id="gNew">Non hai un account? Registrati</button><br>
    <button class="lk" id="gReset">Password dimenticata?</button>
    <div class="err" id="gErr">${esc(msg)}</div>`);
  let reg = false;
  const $ = id => g.querySelector("#" + id), err = m => { $("gErr").textContent = m; };
  $("gGoogle").onclick = async () => { err(""); try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch(e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") { try { await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); } catch(e2) { err(errMsg(e2)); } } else err(errMsg(e)); } };
  $("gNew").onclick = () => { reg = !reg; $("gNome").hidden = !reg; $("gLogin").textContent = reg ? "Crea account" : "Accedi"; $("gNew").textContent = reg ? "Hai già un account? Accedi" : "Non hai un account? Registrati"; $("gPass").autocomplete = reg ? "new-password" : "current-password"; };
  $("gLogin").onclick = async () => {
    err(""); const em = $("gEmail").value.trim(), pw = $("gPass").value;
    if (!em || !pw) return err("Inserisci email e password");
    try {
      if (reg) { if (!$("gNome").value.trim()) return err("Scrivi nome e cognome"); sessionStorage.setItem("iteamNome", $("gNome").value.trim()); const c = await auth.createUserWithEmailAndPassword(em, pw); try { await c.user.updateProfile({displayName: $("gNome").value.trim()}); await c.user.sendEmailVerification(); } catch(e){} }
      else await auth.signInWithEmailAndPassword(em, pw);
    } catch(e) { err(errMsg(e)); }
  };
  $("gPass").onkeydown = e => { if (e.key === "Enter") $("gLogin").click(); };
  $("gReset").onclick = async () => { const em = $("gEmail").value.trim(); if (!em) return err("Scrivi prima la tua email"); try { await auth.sendPasswordResetEmail(em); err("Ti abbiamo inviato un'email per reimpostare la password"); } catch(e) { err(errMsg(e)); } };
}

function showWaiting(u){
  const g = gate(`<h2>Account in attesa</h2><p>Ciao <b>${esc(u.displayName || u.email)}</b>, il tuo account è stato registrato.<br>Il titolare deve <b>attivarlo</b> dal gestionale (👤 → Utenti). Questa pagina si aprirà da sola appena attivato.</p><button class="p" id="gOut" style="background:#5f6f7c">Esci</button>`);
  g.querySelector("#gOut").onclick = () => auth.signOut();
}

// ---------- avvio ----------
let started = false, unsubProf = null;
function start(){
  if (!configured) { gate(`<h2>Configurazione mancante</h2><p>Manca il collegamento a Firebase (file <b>firebase-config.js</b>). Chiedi a Claude di completarlo.</p>`); return; }
  firebase.initializeApp(cfg);
  auth = firebase.auth();
  db = firebase.firestore();
  try { db.enablePersistence({synchronizeTabs: true}).catch(() => {}); } catch(e){}
  try { storage = firebase.storage(); } catch(e) { storage = null; }
  auth.getRedirectResult().catch(e => showLogin(errMsg(e)));
  auth.onAuthStateChanged(async u => {
    if (unsubProf) { unsubProf(); unsubProf = null; }
    if (!u) { if (started) location.reload(); else showLogin(); return; }
    isOwner = (u.email || "").toLowerCase() === OWNER;
    if (isOwner && !u.emailVerified) {
      const g = gate(`<h2>Verifica la tua email</h2><p>Ti abbiamo inviato un link di conferma a <b>${esc(u.email)}</b>. Aprilo, poi premi «Ho confermato».</p><button class="p" id="gV">Ho confermato</button><button class="lk" id="gR">Invia di nuovo</button><br><button class="lk" id="gO">Esci</button>`);
      g.querySelector("#gV").onclick = async () => { await u.reload(); if (u.emailVerified) { await u.getIdToken(true); location.reload(); } };
      g.querySelector("#gR").onclick = () => u.sendEmailVerification().catch(() => {});
      g.querySelector("#gO").onclick = () => auth.signOut();
      return;
    }
    const ref = db.collection("utenti").doc(u.uid);
    if (isOwner) {
      try { const s = await ref.get(); if (!s.exists || s.data().ruolo !== "admin" || !s.data().attivo) await ref.set({email: u.email, nome: u.displayName || "Titolare", ruolo: "admin", attivo: true, creato: new Date().toISOString()}, {merge: true}); } catch(e){}
      profilo = {email: u.email, nome: u.displayName || "Titolare", ruolo: "admin", attivo: true};
      return enter();
    }
    unsubProf = ref.onSnapshot(async s => {
      if (!s.exists) {
        try { await ref.set({email: u.email || "", nome: u.displayName || sessionStorage.getItem("iteamNome") || "", ruolo: "nuovo", attivo: false, creato: new Date().toISOString()}); } catch(e){}
        return showWaiting(u);
      }
      profilo = s.data();
      if (!profilo.attivo) { if (started) location.reload(); else showWaiting(u); return; }
      enter();
    }, () => showWaiting(u));
  });
}
function enter(){
  if (started) return;
  started = true; hideGate(); addAccountButton(); resolveReady();
}

// ---------- interfaccia "claude.use" usata dal gestionale ----------
const assets = {
  async upload(blob, opts = {}){
    if (!storage) throw {code: "unavailable"};
    const type = opts.type || blob.type || "application/octet-stream";
    if (blob.size > 50 * 1048576) throw {code: "too_large"};
    const ext = (type.split("/")[1] || "bin").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "." + ext;
    const ref = storage.ref("media/" + id);
    try { await ref.put(blob, {contentType: type}); } catch(e) { throw {code: e && e.code === "storage/quota-exceeded" ? "quota_or_state" : "upload_failed"}; }
    const url = await ref.getDownloadURL();
    return {id, url, sizeBytes: blob.size, contentType: type};
  },
  async delete(id){ if (storage && id) await storage.ref("media/" + id).delete(); },
  async list(){ return {assets: [], usage: {}}; }
};
const downloads = {
  async save({filename, data}){
    const blob = data instanceof Blob ? data : new Blob([data], {type: /\.csv$/i.test(filename) ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8"});
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mobile && navigator.canShare) {
      try { const f = new File([blob], filename, {type: blob.type || "application/octet-stream"}); if (navigator.canShare({files: [f]})) { await navigator.share({files: [f], title: filename}); return; } } catch(e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
};
const user = {
  isOwner: () => isOwner,
  canEdit: () => !!profilo && (profilo.ruolo === "admin" || profilo.ruolo === "ufficio"),
  can: async () => !!profilo && !!profilo.attivo,
  id: async () => auth?.currentUser?.uid || null,
  me: async () => ({id: auth?.currentUser?.uid, name: profilo?.nome || auth?.currentUser?.displayName || "", email: auth?.currentUser?.email || ""})
};
window.claude = { use: async name => { await ready; return {db, assets: storage ? assets : null, downloads, user}[name] || null; } };
window.ITEAM = { profilo: () => profilo, logout: () => auth && auth.signOut() };

// ---------- pulsante account, utenti, backup ----------
function addAccountButton(){
  const h = document.querySelector("header.top"); if (!h || document.getElementById("hacc")) return;
  const b = document.createElement("button"); b.className = "hbtn"; b.id = "hacc"; b.title = "Account"; b.textContent = "👤";
  b.onclick = openAccount; h.appendChild(b);
}
function panel(html){
  document.getElementById("uacc")?.remove();
  const ov = document.createElement("div"); ov.id = "uacc";
  ov.innerHTML = `<div class="dlg">${html}</div>`;
  ov.addEventListener("click", e => { if (e.target === ov || e.target.dataset.close !== undefined) ov.remove(); });
  document.body.appendChild(ov); return ov;
}
function toastMsg(m){ const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function openAccount(){
  const u = auth.currentUser, admin = isOwner || profilo?.ruolo === "admin";
  const ov = panel(`<h2 style="margin-top:0">Account</h2>
    <div class="info" style="margin-bottom:10px"><b>${esc(profilo?.nome || u.displayName || "")}</b><br><span class="m">${esc(u.email)} · ${esc((RUOLI.find(r => r[0] === profilo?.ruolo) || ["", profilo?.ruolo || ""])[1])}</span></div>
    ${admin ? `<h3>Utenti</h3><div id="ulist" class="m">Caricamento…</div>
    <h3>Dati</h3><p class="m">Scarica una copia di tutti i dati (consigliato una volta al mese) o importa i dati del vecchio gestionale.</p>
    <div class="row wrap" style="gap:8px"><button class="btn" id="aBk">⬇️ Scarica backup</button><button class="btn" id="aImp">⬆️ Importa dati</button></div>` : ""}
    <div class="acts"><button class="btn bad" id="aOut">Esci dall'account</button><span class="sp"></span><button class="btn pri" data-close>Chiudi</button></div>`);
  ov.querySelector("#aOut").onclick = () => auth.signOut();
  if (!admin) return;
  const un = db.collection("utenti").onSnapshot(s => {
    const el = ov.querySelector("#ulist"); if (!el) return un();
    const L = s.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => (a.attivo - b.attivo) || (a.nome || a.email || "").localeCompare(b.nome || b.email || ""));
    el.innerHTML = L.length ? L.map(x => { const me = x.id === u.uid; return `<div class="u"><div class="row"><b>${esc(x.nome || "—")}</b>${!x.attivo ? `<span class="chip bad" style="margin-left:6px">Da attivare</span>` : ""}<span class="sp"></span>${me ? `<span class="chip pri">Tu</span>` : ""}</div><div class="m">${esc(x.email)}</div>
      ${me ? "" : `<div class="row wrap" style="gap:8px;margin-top:8px"><select data-ruolo="${x.id}">${(x.ruolo === "nuovo" ? [["nuovo", "— Scegli ruolo —"]] : []).concat(RUOLI).map(([k, l]) => `<option value="${k}" ${x.ruolo === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn sm ${x.attivo ? "" : "ok"}" data-att="${x.id}" data-v="${x.attivo ? 0 : 1}">${x.attivo ? "Disattiva" : "✓ Attiva"}</button><button class="btn sm bad" data-udel="${x.id}">Elimina</button></div>`}</div>`; }).join("") : "Nessun utente.";
  }, () => {});
  ov.addEventListener("change", async e => { const id = e.target.dataset.ruolo; if (id) { try { await db.collection("utenti").doc(id).update({ruolo: e.target.value}); toastMsg("Ruolo aggiornato"); } catch(err) { toastMsg("Non riuscito"); } } });
  ov.addEventListener("click", async e => {
    const t = e.target;
    if (t.dataset.att) { const sel = ov.querySelector(`[data-ruolo="${t.dataset.att}"]`); if (t.dataset.v === "1" && sel && sel.value === "nuovo") return toastMsg("Scegli prima il ruolo"); try { await db.collection("utenti").doc(t.dataset.att).update({attivo: t.dataset.v === "1"}); toastMsg(t.dataset.v === "1" ? "Account attivato" : "Account disattivato"); } catch(err) { toastMsg("Non riuscito"); } }
    if (t.dataset.udel && confirmBox("Eliminare questo utente? Non potrà più accedere.")) { try { await db.collection("utenti").doc(t.dataset.udel).delete(); } catch(err){} }
    if (t.id === "aBk") backup();
    if (t.id === "aImp") importa();
  });
}
function confirmBox(m){ return window.confirm(m); }
const COLLEZIONI = ["clienti","impianti","interventi","preventivi","fatture","magazzino","listino","dico","config"];
async function backup(){
  toastMsg("Preparo il backup…");
  const out = {app: "iteam-gestionale", creato: new Date().toISOString(), collections: {}};
  for (const c of COLLEZIONI) { const s = await db.collection(c).get(); out.collections[c] = s.docs.map(d => ({id: d.id, ...d.data()})); }
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  await downloads.save({filename: `Backup gestionale iTeam ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`, data: new Blob([JSON.stringify(out)], {type: "application/json"})});
}
function importa(){
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch(e) { return toastMsg("File non valido"); }
    const cols = data.collections || {};
    const n = Object.values(cols).reduce((s, l) => s + (Array.isArray(l) ? l.length : 0), 0);
    if (!n) return toastMsg("Il file non contiene dati");
    if (!confirmBox(`Importare ${n} elementi? Quelli con lo stesso codice verranno sovrascritti.`)) return;
    // foto incluse nel file (dal vecchio gestionale): caricale e aggiorna i collegamenti
    const media = data.media || {}, nuovi = {};
    for (const [oldId, dataUrl] of Object.entries(media)) {
      try { toastMsg("Carico le foto…"); const blob = await (await fetch(dataUrl)).blob(); const up = await assets.upload(blob, {type: blob.type || "image/jpeg"}); nuovi[oldId] = up; } catch(e) {}
    }
    if (Object.keys(nuovi).length) for (const list of Object.values(cols)) if (Array.isArray(list)) list.forEach(it => {
      if (Array.isArray(it.media)) it.media = it.media.map(m => nuovi[m.id] ? {...m, id: nuovi[m.id].id, url: nuovi[m.id].url} : m);
      if (it.foto && nuovi[it.foto]) { it.fotoUrl = nuovi[it.foto].url; it.foto = nuovi[it.foto].id; }
    });
    let done = 0, batch = db.batch(), inBatch = 0;
    for (const [c, list] of Object.entries(cols)) {
      if (!COLLEZIONI.includes(c) || !Array.isArray(list)) continue;
      for (const it of list) {
        const {id, ...body} = it; if (!id) continue;
        batch.set(db.collection(c).doc(String(id)), body); inBatch++; done++;
        if (inBatch >= 200) { await batch.commit(); batch = db.batch(); inBatch = 0; toastMsg(`Importati ${done} di ${n}…`); }
      }
    }
    if (inBatch) await batch.commit();
    toastMsg(`✅ Importati ${done} elementi`);
  };
  inp.click();
}

// avvio quando la pagina è pronta
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
