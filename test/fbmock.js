// finto SDK Firebase compat per i test
(() => {
  if (window.firebase) return;
  const store = window.__store = {}; const subs = []; let n = 0;
  const notify = () => setTimeout(() => subs.forEach(f => f()));
  const docSnap = (col, id) => { const d = (store[col] || {})[id]; return {id, exists: !!d, data: () => d && JSON.parse(JSON.stringify(d))}; };
  const mkDoc = (col, id) => ({ id,
    async get(){ return docSnap(col, id); },
    async set(b, o){ store[col] = store[col] || {}; store[col][id] = o && o.merge ? {...store[col][id], ...b} : JSON.parse(JSON.stringify(b)); notify(); },
    async update(b){ store[col][id] = {...store[col][id], ...b}; notify(); },
    async delete(){ delete store[col][id]; notify(); },
    onSnapshot(fn){ const f = () => fn(docSnap(col, id)); subs.push(f); setTimeout(f); return () => {}; } });
  const fs = {
    enablePersistence: async () => {},
    collection(col){ return { doc(id){ return mkDoc(col, id || ("id" + (++n))); },
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
