// iTeam Gestionale – collegamento a Firebase (dati, accessi, foto) e gestione utenti.
// Fornisce window.claude.use(...) con la stessa interfaccia usata dal gestionale,
// così il resto dell'app non cambia.
(() => {
"use strict";
const OWNER = "carone.t46@gmail.com";
// secondo titolare di riserva: se si perde l'account principale si entra con questo, con gli stessi poteri
const OWNERS = [OWNER, "segreteria.iteam@gmail.com"];
const RUOLI = [["admin", "Amministratore"], ["ufficio", "Ufficio"], ["ufficio_tecnico", "Ufficio + Tecnico"], ["tecnico", "Tecnico"], ["tecnico_preventivatore", "Tecnico + Preventivatore"], ["preventivatore", "Preventivatore"]];
// Chi non ha un'email accede con un semplice nome utente (es. "maurizio"):
// dietro le quinte diventa "maurizio@utenti.iteamservice.it" (nessuna email viene inviata lì).
const DOMINIO_UTENTI = "utenti.iteamservice.it";
const toEmail = v => { v = String(v || "").trim().toLowerCase(); return !v ? "" : v.includes("@") ? v : v.replace(/\s+/g, ".") + "@" + DOMINIO_UTENTI; };
const showName = e => String(e || "").replace("@" + DOMINIO_UTENTI, "");
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
#uacc input{padding:10px 11px;border:1px solid #cfd8df;border-radius:8px;font:inherit;box-sizing:border-box}
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
  "auth/user-not-found": "Nessun account con questo nome",
  "auth/requires-recent-login": "Per sicurezza esci e rientra, poi riprova",
  "auth/email-already-in-use": "Esiste già un account con questo nome utente o email",
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
    <input id="gEmail" type="text" placeholder="Nome utente o email" autocomplete="username" autocapitalize="none" spellcheck="false">
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
    err(""); const em = toEmail($("gEmail").value), pw = $("gPass").value;
    if (!em || !pw) return err("Inserisci nome utente e password");
    try {
      if (reg) { if (!$("gNome").value.trim()) return err("Scrivi nome e cognome"); sessionStorage.setItem("iteamNome", $("gNome").value.trim()); const c = await auth.createUserWithEmailAndPassword(em, pw); try { await c.user.updateProfile({displayName: $("gNome").value.trim()}); await c.user.sendEmailVerification(); } catch(e){} }
      else await auth.signInWithEmailAndPassword(em, pw);
    } catch(e) { err(errMsg(e)); }
  };
  $("gPass").onkeydown = e => { if (e.key === "Enter") $("gLogin").click(); };
  $("gReset").onclick = async () => { const em = toEmail($("gEmail").value); if (!em) return err("Scrivi prima la tua email"); if (em.endsWith("@" + DOMINIO_UTENTI)) return err("Chiedi al titolare di reimpostare la tua password"); try { await auth.sendPasswordResetEmail(em); err("Ti abbiamo inviato un'email per reimpostare la password"); } catch(e) { err(errMsg(e)); } };
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
    isOwner = OWNERS.includes((u.email || "").toLowerCase());
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
      try { const s = await ref.get(); if (s.exists) profilo = {...s.data(), email: u.email, ruolo: "admin", attivo: true}; } catch(e){}
      unsubProf = ref.onSnapshot(s => { if (s.exists) { profilo = {...s.data(), email: u.email, ruolo: "admin", attivo: true}; if (started) window.dispatchEvent(new Event("iteam-profilo")); } }, () => {});
      return enter();
    }
    unsubProf = ref.onSnapshot(async s => {
      if (!s.exists) {
        try { await ref.set({email: u.email || "", nome: u.displayName || sessionStorage.getItem("iteamNome") || "", ruolo: "nuovo", attivo: false, creato: new Date().toISOString()}); } catch(e){}
        return showWaiting(u);
      }
      profilo = s.data();
      if (!profilo.attivo) { if (started) location.reload(); else showWaiting(u); return; }
      if (started) window.dispatchEvent(new Event("iteam-profilo"));
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
    const cartella = opts.cartella === "contabilita" ? "contabilita/" : "media/";
    const ref = storage.ref(cartella + id);
    try { await ref.put(blob, {contentType: type}); } catch(e) { console.warn("upload", e); throw {code: e && e.code === "storage/quota-exceeded" ? "quota_or_state" : "upload_failed", detail: (e && e.code) || String(e && e.message || e)}; }
    let url; try { url = await ref.getDownloadURL(); } catch(e) { throw {code: "upload_failed", detail: (e && e.code) || "download-url"}; }
    return {id, url, path: cartella + id, sizeBytes: blob.size, contentType: type};
  },
  async delete(id, cartella){ if (storage && id) await storage.ref((cartella === "contabilita" ? "contabilita/" : "media/") + id).delete(); },
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
  canEdit: () => !!profilo && ["admin", "ufficio", "ufficio_tecnico"].includes(profilo.ruolo),
  can: async () => !!profilo && !!profilo.attivo,
  id: async () => auth?.currentUser?.uid || null,
  me: async () => ({id: auth?.currentUser?.uid, name: profilo?.nome || auth?.currentUser?.displayName || "", email: auth?.currentUser?.email || ""})
};
window.claude = { use: async name => { await ready; return {db, assets: storage ? assets : null, downloads, user}[name] || null; } };
// ---------- notifiche push (avvisi appuntamenti ai tecnici) ----------
// Il telefono riceve un "codice dispositivo" che salviamo in dispositivi/{codice} insieme al nome del tecnico.
// L'invio degli avvisi lo fa il controllo automatico su GitHub (scripts/avvisi.js).
const notifiche = (() => {
  const LS = "iteamPush", iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const mem = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch(e) { return null; } };
  const setMem = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch(e){} };
  let refreshed = false;
  async function token(){
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    return firebase.messaging().getToken({vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg});
  }
  async function salva(tk, tecnico){
    await db.collection("dispositivi").doc(tk).set({tecnico: tecnico || "", uid: auth.currentUser?.uid || "", utente: profilo?.nome || "", dispositivo: iOS ? "iPhone" : /Android/i.test(navigator.userAgent) ? "Android" : "Computer", aggiornato: new Date().toISOString()});
    setMem({token: tk, tecnico: tecnico || ""});
  }
  return {
    disponibili: () => configured && !!cfg.vapidKey && "serviceWorker" in navigator && location.protocol === "https:" && !!(firebase && firebase.messaging),
    stato(){
      if (iOS && !standalone()) return "serve-home";
      if (!("Notification" in window) || !("PushManager" in window)) return "non-supportate";
      if (Notification.permission === "denied") return "bloccate";
      if (Notification.permission === "granted" && mem()?.token) return "attive";
      return "da-attivare";
    },
    async attiva(tecnico){
      if (!("Notification" in window)) throw new Error("Questo telefono non supporta le notifiche");
      const p = await Notification.requestPermission();
      if (p !== "granted") throw new Error("Notifiche non consentite: riattivale dalle impostazioni del telefono");
      let tk; try { tk = await token(); } catch(e) { throw new Error("Non riesco ad attivare le notifiche. Riprova tra poco."); }
      if (!tk) throw new Error("Non riesco ad attivare le notifiche. Riprova tra poco.");
      await salva(tk, tecnico);
    },
    async collega(tecnico){
      const m = mem(); if (!m || !m.token || !("Notification" in window) || Notification.permission !== "granted") return;
      if (!refreshed) { refreshed = true; try { const tk = await token(); if (tk && tk !== m.token) { try { await db.collection("dispositivi").doc(m.token).delete(); } catch(e){} return salva(tk, tecnico); } } catch(e){} }
      if ((m.tecnico || "") !== (tecnico || "")) salva(m.token, tecnico).catch(() => {});
    }
  };
})();
window.ITEAM = { profilo: () => profilo, isOwner: () => isOwner, logout: () => auth && auth.signOut(), notifiche };

// ---------- pulsante account, utenti, backup ----------
function addAccountButton(){
  const h = document.querySelector("header.top"); if (!h || document.getElementById("hacc")) return;
  const b = document.createElement("button"); b.className = "hbtn"; b.id = "hacc"; b.title = "Account"; b.textContent = "👤";
  b.onclick = openAccount;
  if (isOwner) { const k = document.createElement("button"); k.className = "hbtn"; k.id = "hpw"; k.title = "Password degli account"; k.textContent = "🔑"; k.onclick = openPasswords; h.appendChild(k); }
  h.appendChild(b);
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
    <div class="info" style="margin-bottom:10px"><b>${esc(profilo?.nome || u.displayName || "")}</b><br><span class="m">${esc(showName(u.email))} · ${esc((RUOLI.find(r => r[0] === profilo?.ruolo) || ["", profilo?.ruolo || ""])[1])}</span></div>
    ${admin ? `<h3>Utenti</h3>
    <details id="nuDet" class="u" style="background:#f7fafc"><summary style="cursor:pointer;font-weight:650">➕ Crea nuovo account</summary>
      <div style="margin-top:10px">
        <input id="nuNome" placeholder="Nome (es. Maurizio)" style="width:100%;margin-bottom:6px">
        <input id="nuUser" placeholder="Nome utente per entrare (es. maurizio) o email" autocapitalize="none" spellcheck="false" style="width:100%;margin-bottom:6px">
        <input id="nuPass" type="text" placeholder="Password scelta da te (almeno 6 caratteri)" autocapitalize="none" spellcheck="false" autocomplete="off" style="width:100%;margin-bottom:6px">
        <div class="row wrap" style="gap:8px"><select id="nuRuolo">${RUOLI.map(([k, l]) => `<option value="${k}" ${k === "tecnico" ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button class="btn pri" id="nuCrea">Crea account</button></div>
        <p class="m" style="margin:8px 0 0">L'account è subito attivo: comunica alla persona nome utente e password.</p>
      </div></details>
    <div id="ulist" class="m">Caricamento…</div>
    <h3>Dati</h3><p class="m">Scarica una copia di tutti i dati (consigliato una volta al mese) o importa i dati del vecchio gestionale.</p>
    <div class="row wrap" style="gap:8px"><button class="btn" id="aBk">⬇️ Scarica backup</button><button class="btn" id="aImp">⬆️ Importa dati</button></div>` : ""}
    <div class="acts"><button class="btn bad" id="aOut">Esci dall'account</button><span class="sp"></span><button class="btn pri" data-close>Chiudi</button></div>`);
  ov.querySelector("#aOut").onclick = () => auth.signOut();
  if (!admin) return;
  ov.querySelector("#nuCrea").onclick = async () => {
    const nome = ov.querySelector("#nuNome").value.trim(), em = toEmail(ov.querySelector("#nuUser").value), pw = ov.querySelector("#nuPass").value, ruolo = ov.querySelector("#nuRuolo").value;
    if (!nome) return toastMsg("Scrivi il nome");
    if (!em) return toastMsg("Scrivi il nome utente");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toastMsg("Nome utente non valido: usa solo lettere, numeri e punti");
    if (pw.length < 6) return toastMsg("La password deve avere almeno 6 caratteri");
    const btn = ov.querySelector("#nuCrea"); btn.disabled = true; btn.textContent = "Creo…";
    try {
      // seconda istanza di Firebase: crea l'account senza far uscire l'amministratore
      const sec = firebase.apps.find(a => a.name === "creaUtenti") || firebase.initializeApp(cfg, "creaUtenti");
      const c = await sec.auth().createUserWithEmailAndPassword(em, pw);
      try { await c.user.updateProfile({displayName: nome}); } catch(e){}
      await db.collection("utenti").doc(c.user.uid).set({email: em, nome, ruolo, attivo: true, creato: new Date().toISOString(), creatoDa: u.email});
      try { await sec.auth().signOut(); } catch(e){}
      toastMsg(`✅ Account di ${nome} creato`);
      ["#nuNome", "#nuUser", "#nuPass"].forEach(k => ov.querySelector(k).value = "");
    } catch(e) { toastMsg(errMsg(e)); }
    btn.disabled = false; btn.textContent = "Crea account";
  };
  const un = db.collection("utenti").onSnapshot(s => {
    const el = ov.querySelector("#ulist"); if (!el) return un();
    const L = s.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => (a.attivo - b.attivo) || (a.nome || a.email || "").localeCompare(b.nome || b.email || ""));
    const O = (window.ITEAM_OPZIONI && window.ITEAM_OPZIONI()) || {postazioni: [], tecnici: []};
    const sel = (x, campo, lista, label) => `<label class="m" style="display:flex;align-items:center;gap:6px;margin-top:6px">${label}<select data-link="${x.id}" data-campo="${campo}" style="flex:1;min-width:0"><option value="">Automatico (dal nome)</option>${lista.map(n => `<option ${x[campo] === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
    const links = x => (["admin", "ufficio", "ufficio_tecnico"].includes(x.ruolo) || (x.id === u.uid && isOwner) ? sel(x, "postazione", O.postazioni, "🏢 Postazione") : "") + (["admin", "ufficio_tecnico", "tecnico", "tecnico_preventivatore"].includes(x.ruolo) || (x.id === u.uid && isOwner) ? sel(x, "tecnico", O.tecnici, "🔧 Tecnico") : "") + (isOwner && !sonoIo(x) && !["tecnico", "tecnico_preventivatore", "nuovo"].includes(x.ruolo) ? `<label class="m" style="display:flex;align-items:center;gap:6px;margin-top:6px"><input type="checkbox" data-contab="${x.id}" ${x.contabilita ? "checked" : ""}> 📒 Vede la contabilità (fatture fornitori e DDT)</label>` : "");
    const sonoIo = x => x.id === u.uid;
    el.innerHTML = L.length ? L.map(x => { const me = x.id === u.uid; return `<div class="u"><div class="row"><b>${esc(x.nome || "—")}</b>${!x.attivo ? `<span class="chip bad" style="margin-left:6px">Da attivare</span>` : ""}<span class="sp"></span>${me ? `<span class="chip pri">Tu</span>` : ""}</div><div class="m">${x.email && x.email.endsWith("@" + DOMINIO_UTENTI) ? "Nome utente: <b>" + esc(showName(x.email)) + "</b>" : esc(x.email)}</div>
      ${me ? "" : `<div class="row wrap" style="gap:8px;margin-top:8px"><select data-ruolo="${x.id}">${(x.ruolo === "nuovo" ? [["nuovo", "— Scegli ruolo —"]] : []).concat(RUOLI).map(([k, l]) => `<option value="${k}" ${x.ruolo === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn sm ${x.attivo ? "" : "ok"}" data-att="${x.id}" data-v="${x.attivo ? 0 : 1}">${x.attivo ? "Disattiva" : "✓ Attiva"}</button><button class="btn sm bad" data-udel="${x.id}">Elimina</button></div>`}${links(x)}</div>`; }).join("") : "Nessun utente.";
  }, () => {});
  ov.addEventListener("change", async e => { if (e.target.dataset.contab) { try { await db.collection("utenti").doc(e.target.dataset.contab).update({contabilita: e.target.checked}); toastMsg(e.target.checked ? "Contabilità abilitata" : "Contabilità tolta"); } catch(err) { toastMsg("Non riuscito"); } return; } if (e.target.dataset.link) { try { await db.collection("utenti").doc(e.target.dataset.link).update({[e.target.dataset.campo]: e.target.value}); toastMsg("Collegamento salvato"); } catch(err) { toastMsg("Non riuscito"); } return; } const id = e.target.dataset.ruolo; if (id) { try { await db.collection("utenti").doc(id).update({ruolo: e.target.value}); toastMsg("Ruolo aggiornato"); } catch(err) { toastMsg("Non riuscito"); } } });
  ov.addEventListener("click", async e => {
    const t = e.target;
    if (t.dataset.att) { const sel = ov.querySelector(`[data-ruolo="${t.dataset.att}"]`); if (t.dataset.v === "1" && sel && sel.value === "nuovo") return toastMsg("Scegli prima il ruolo"); try { await db.collection("utenti").doc(t.dataset.att).update({attivo: t.dataset.v === "1"}); toastMsg(t.dataset.v === "1" ? "Account attivato" : "Account disattivato"); } catch(err) { toastMsg("Non riuscito"); } }
    if (t.dataset.udel && confirmBox("Eliminare questo utente? Non potrà più accedere.")) { try { await db.collection("utenti").doc(t.dataset.udel).delete(); } catch(err){} }
    if (t.id === "aBk") backup();
    if (t.id === "aImp") importa();
  });
}
// ---------- password degli account (solo il titolare) ----------
// La nuova password va in utenti/{uid}.nuovaPassword (scrivibile solo dall'amministratore):
// il controllo automatico su GitHub (scripts/password.js) la applica entro ~10-15 minuti e la cancella.
function openPasswords(){
  if (!isOwner) return;
  const me = auth.currentUser.uid;
  const ov = panel(`<h2 style="margin-top:0">🔑 Password degli account</h2>
    <p class="m" style="margin-top:0">Scrivi la nuova password e premi <b>Cambia</b>. Diventa attiva entro circa 15 minuti: poi comunicala alla persona. Solo tu puoi cambiare le password.</p>
    <div id="pwlist" class="m">Caricamento…</div>
    <div class="acts"><span class="sp"></span><button class="btn pri" data-close>Chiudi</button></div>`);
  const data = v => { try { const d = new Date(v); return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", {hour: "2-digit", minute: "2-digit"}); } catch(e) { return ""; } };
  const un = db.collection("utenti").onSnapshot(s => {
    const el = ov.querySelector("#pwlist"); if (!el) return un();
    const L = s.docs.map(d => ({id: d.id, ...d.data()})).filter(x => x.id !== me && x.ruolo !== "nuovo").sort((a, b) => (a.nome || a.email || "").localeCompare(b.nome || b.email || ""));
    el.innerHTML = L.length ? L.map(x => {
      const stato = x.nuovaPassword ? `<span class="chip warn">⏳ In attesa: attiva entro 15 minuti circa</span>`
        : x.passwordErrore ? `<span class="chip bad">${esc(x.passwordErrore)}</span>`
        : x.passwordCambiata ? `<span class="chip ok">✓ Cambiata il ${esc(data(x.passwordCambiata))}</span>` : "";
      return `<div class="u"><div class="row"><b>${esc(x.nome || "—")}</b><span class="sp"></span>${x.attivo ? "" : `<span class="chip bad">Disattivato</span>`}</div>
        <div class="m">${x.email && x.email.endsWith("@" + DOMINIO_UTENTI) ? "Nome utente: <b>" + esc(showName(x.email)) + "</b>" : esc(x.email || "")}</div>
        <div class="row" style="gap:8px;margin-top:8px"><input data-pw="${x.id}" type="text" placeholder="Nuova password (almeno 6 caratteri)" autocapitalize="none" spellcheck="false" autocomplete="off" style="flex:1;min-width:0"><button class="btn sm pri" data-pwset="${x.id}">Cambia</button></div>
        ${stato ? `<div style="margin-top:6px">${stato}</div>` : ""}</div>`; }).join("") : "Nessun altro account.";
  }, () => { const el = ov.querySelector("#pwlist"); if (el) el.textContent = "Non riesco a caricare gli account."; });
  ov.addEventListener("click", async e => {
    const id = e.target.dataset.pwset; if (!id) return;
    const inp = ov.querySelector(`[data-pw="${id}"]`), pw = (inp?.value || "").trim();
    if (pw.length < 6) return toastMsg("La password deve avere almeno 6 caratteri");
    e.target.disabled = true;
    try { await db.collection("utenti").doc(id).update({nuovaPassword: pw, nuovaPasswordIl: new Date().toISOString(), passwordErrore: firebase.firestore.FieldValue.delete()}); inp.value = ""; toastMsg("✅ Password in arrivo: attiva entro 15 minuti circa"); }
    catch(err) { toastMsg("Non riuscito, riprova"); }
    e.target.disabled = false;
  });
}
function confirmBox(m){ return window.confirm(m); }
const COLLEZIONI = ["clienti","impianti","interventi","preventivi","fatture","magazzino","listino","dico","commesse","contratti","ordini","contabilita","crediti","spese","presenze","fgasOps","detrazioni","mezzi","attrezzature","oreLibere","magazzinoPrezzi","commesseRiservate","config"];
async function backup(){
  toastMsg("Preparo il backup…");
  const out = {app: "iteam-gestionale", creato: new Date().toISOString(), collections: {}};
  for (const c of COLLEZIONI) { try { const s = await db.collection(c).get(); out.collections[c] = s.docs.map(d => ({id: d.id, ...d.data()})); } catch(e) { if (!["contabilita", "crediti", "spese", "presenze", "fgasOps", "detrazioni", "mezzi", "attrezzature", "oreLibere", "magazzinoPrezzi", "commesseRiservate"].includes(c)) throw e; } }
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  await downloads.save({filename: `Backup gestionale iTeam ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`, data: new Blob([JSON.stringify(out)], {type: "application/json"})});
}
function importa(){
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,.gz,application/json,application/gzip";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    // anche la copia compressa che arriva per email ogni domenica (.json.gz)
    const testo = async () => /\.gz$/i.test(f.name) ? await new Response(f.stream().pipeThrough(new DecompressionStream("gzip"))).text() : await f.text();
    let data; try { data = JSON.parse(await testo()); } catch(e) { return toastMsg("File non valido"); }
    const cols = data.collections || {};
    const n = Object.values(cols).reduce((s, l) => s + (Array.isArray(l) ? l.length : 0), 0);
    if (!n) return toastMsg("Il file non contiene dati");
    if (!confirmBox(`Importare ${n} elementi? Quelli con lo stesso codice verranno sovrascritti.`)) return;
    // foto incluse nel file (dal vecchio gestionale): caricale e aggiorna i collegamenti
    const media = data.media || {}, nuovi = {};
    for (const [oldId, dataUrl] of Object.entries(media)) {
      try { toastMsg("Carico foto e documenti…"); const blob = await (await fetch(dataUrl)).blob(); const up = await assets.upload(blob, {type: blob.type || "image/jpeg"}); nuovi[oldId] = up; } catch(e) {}
    }
    if (Object.keys(nuovi).length) for (const list of Object.values(cols)) if (Array.isArray(list)) list.forEach(it => {
      if (Array.isArray(it.media)) it.media = it.media.map(m => nuovi[m.id] ? {...m, id: nuovi[m.id].id, url: nuovi[m.id].url} : m);
      if (it.foto && nuovi[it.foto]) { it.fotoUrl = nuovi[it.foto].url; it.foto = nuovi[it.foto].id; }
      // documenti allegati (per esempio libretti e fatture dei furgoni)
      if (Array.isArray(it.documenti)) it.documenti = it.documenti.map(d => nuovi[d.id] ? {...d, id: nuovi[d.id].id, url: nuovi[d.id].url} : d);
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
