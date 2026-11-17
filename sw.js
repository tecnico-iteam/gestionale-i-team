// Service worker: l'app si apre anche senza connessione e si aggiorna da sola.
// Cambiare VERSIONE quando si vuole svuotare la cache sui dispositivi.
const VERSIONE = "iteam-v6";
const CONDIVISI = "iteam-condivisi"; // foto/video arrivati da "Condividi" (es. WhatsApp), in attesa di essere salvati
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIONE && k !== CONDIVISI).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const req = e.request;
  // "Condividi → iTeam" dal telefono (es. foto di WhatsApp): teniamo da parte i file e apriamo il gestionale
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/condividi")) {
    e.respondWith((async () => {
      let n = 0;
      try {
        const fd = await req.formData(), files = fd.getAll("media").filter(f => f && f.size);
        const c = await caches.open(CONDIVISI);
        for (const k of await c.keys()) await c.delete(k);
        for (const f of files) await c.put(new Request("condivisi/" + Date.now() + "-" + (n++)), new Response(f, {headers: {"content-type": f.type || "application/octet-stream", "x-nome": encodeURIComponent(f.name || "")}}));
      } catch(err) {}
      return Response.redirect(new URL("./?condividi=" + n, self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  const own = u.origin === location.origin, sdk = u.host === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/");
  if (!own && !sdk) return; // dati Firebase e foto: gestiti da Firebase
  if (sdk || u.pathname.includes("/img/") || u.pathname.includes("/icons/")) {
    // file che non cambiano: prima la cache
    e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => { if (r.ok) { const cl = r.clone(); caches.open(VERSIONE).then(ca => ca.put(req, cl)); } return r; })));
    return;
  }
  // pagina, script e listini: prima la rete (così gli aggiornamenti arrivano subito), poi la cache se offline
  // "no-cache": chiede sempre al server se c'è una versione nuova (GitHub Pages altrimenti tiene la vecchia fino a 10 minuti)
  e.respondWith(fetch(req, {cache: "no-cache"}).then(r => { if (r.ok) { const cl = r.clone(); caches.open(VERSIONE).then(ca => ca.put(req, cl)); } return r; }).catch(() => caches.match(req, {ignoreSearch: true})));
});

// Notifiche degli appuntamenti (inviate dal controllo automatico, scripts/avvisi.js)
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch(err) { d = {body: e.data && e.data.text()}; }
  const m = Object.assign({}, d.notification || {}, d.data || {}, d.title ? {title: d.title, body: d.body} : {});
  e.waitUntil(self.registration.showNotification(m.title || "iTeam", {
    body: m.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: m.tag || undefined, data: {url: m.url || "./"}
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({type: "window", includeUncontrolled: true}).then(l => {
    for (const c of l) if (c.url.startsWith(self.registration.scope) && "focus" in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); }
    return clients.openWindow(url);
  }));
});
