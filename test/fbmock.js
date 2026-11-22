// finto SDK Firebase compat per i test
(() => {
  if (window.firebase) return;
  const store = window.__store = {}; const subs = []; let n = 0;
  const notify = () => setTimeout(() => subs.forEach(f => f()));
  const docSnap = (col, id) => { const d = (store[col] || {})[id]; return {id, exists: !!d, data: () => d && JSON.parse(JSON.stringify(d))}; };
  const mkDoc = (col, id) => ({ id,
    async get(){ return docSnap(col, id); },
    async set(b, o){ store[col] = store[col] || {}; store[col][id] = o && o.merge ? {...store[col][id], ...b} : JSON.parse(JSON.stringify(b)); notify(); },
    async update(b){ if (!(store[col] || {})[id]) throw {code: "not-found"}; store[col][id] = {...store[col][id], ...b}; notify(); },
    async delete(){ delete store[col][id]; notify(); },
    onSnapshot(fn){ const f = () => fn(docSnap(col, id)); subs.push(f); setTimeout(f); return () => {}; } });
  const fs = {
    enablePersistence: async () => {},
    collection(col){ const q = (ord, lim) => ({ orderBy(f, dir){ return q([f, dir], lim); }, limit(k){ return q(ord, k); },
        async get(){ const o = store[col] || {}; let ks = Object.keys(o); if (ord) ks.sort((a, b) => String(o[a][ord[0]] || "").localeCompare(String(o[b][ord[0]] || "")) * (ord[1] === "desc" ? -1 : 1)); if (lim) ks = ks.slice(0, lim); return {docs: ks.map(k => docSnap(col, k))}; } });
      return { doc(id){ return mkDoc(col, id || ("id" + (++n))); },
      async add(b){ const id = "id" + (++n); await mkDoc(col, id).set(b); return {id}; },
      orderBy(f, dir){ return q([f, dir]); }, limit(k){ return q(null, k); },
      async get(){ const o = store[col] || {}; return {docs: Object.keys(o).map(k => docSnap(col, k))}; },
      onSnapshot(fn){ const f = () => { const o = store[col] || {}; fn({metadata: {fromCache: false}, docs: Object.keys(o).map(k => docSnap(col, k)), docChanges: () => []}); }; subs.push(f); setTimeout(f); return () => {}; } }; },
    doc(p){ const [c, i] = p.split("/"); return mkDoc(c, i); },
    batch(){ const ops = []; return {set(r, b){ ops.push(() => r.set(b)); }, async commit(){ for (const o of ops) await o(); }}; }
  };
  let cur = null; const ls = [];
  const auth = { get currentUser(){ return cur; },
    onAuthStateChanged(f){ ls.push(f); setTimeout(() => f(cur)); },
    async getRedirectResult(){ return null; },
    async signInWithPopup(){ cur = window.__nextUser; ls.forEach(f => f(cur)); },
    async signOut(){ cur = null; ls.forEach(f => f(null)); } };
  const fb = { initializeApp(){}, auth: Object.assign(() => auth, {GoogleAuthProvider: function(){}}), firestore: () => fs,
    storage: () => ({ ref: p => ({ async put(){}, async getDownloadURL(){ return "https://example.test/" + p; }, async delete(){} }) }) };
  window.firebase = fb;
})();
