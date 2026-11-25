// Prova di scripts/allarmi.js con un finto Firestore: allarme delle 8 e delle 17:30. Dati finti.
const {esegui} = require("../scripts/allarmi.js");
function finto(dati){
  const snap = (col, filtro) => ({docs: Object.entries(dati[col] || {}).filter(([, v]) => !filtro || filtro(v)).map(([id, v]) => ({id, data: () => v}))});
  return {collection: col => ({
    get: async () => snap(col),
    where: (f, op, val) => ({get: async () => snap(col, v => op === "==" ? v[f] === val : v[f] >= val)}),
    doc: id => ({get: async () => ({exists: !!(dati[col] || {})[id], data: () => (dati[col] || {})[id]}),
      create: async b => { dati[col] = dati[col] || {}; if (dati[col][id]) throw new Error("esiste"); dati[col][id] = b; }, delete: async () => {}})})};
}
const msg = () => { const inviati = []; return {inviati, sendEach: async l => { inviati.push(...l); return {responses: l.map(() => ({success: true}))}; }}; };
const ora = (s) => new Date(s); // ore UTC: 07:05Z = 08:05 a Roma (ora solare)
(async () => {
  const dati = {
    config: {impostazioni: {tecnici: [{nome: "Mario Rossi"}, {nome: "Luca Bianchi"}, {nome: "Andrea Verdi"}, {nome: "Paolo Neri"}]}},
    dispositivi: {t1: {tecnico: "Mario Rossi"}, t2: {tecnico: "Luca Bianchi"}, t3: {tecnico: "andrea verdi"}},
    giornate: {"2026-11-26_luca-bianchi": {tecnico: "Luca Bianchi", data: "2026-11-26", alle: "07:40"}},
    oreLibere: {f1: {tecnico: "Andrea Verdi", tipo: "Ferie", data: "2026-11-24", dataFine: "2026-11-27", minuti: 480}},
    interventi: {
      x1: {data: "2026-11-26", tecnico: "Mario Rossi", stato: "Programmato"},
      x2: {data: "2026-11-26", tecnico: "Luca Bianchi", stato: "Completato", rapportino: {inviatoIl: "x"}},
      x3: {data: "2026-11-20", tecnico: "Luca Bianchi", tecnico2: "Mario Rossi", stato: "In corso"},
      x4: {data: "2026-11-26", tecnico: "Andrea Verdi", stato: "Programmato"}}
  };
  const db = finto(dati), log = () => {};
  let m = msg(); await esegui({db, messaging: m, now: ora("2026-11-26T07:05:00Z"), log});
  console.log("8:05 →", m.inviati.map(x => x.token + " " + x.data.title).join(" | ") || "nessuno");
  m = msg(); await esegui({db, messaging: m, now: ora("2026-11-26T07:45:00Z"), log});
  console.log("8:45 di nuovo →", m.inviati.length, "(deve essere 0)");
  m = msg(); await esegui({db, messaging: m, now: ora("2026-11-26T06:30:00Z"), log});
  console.log("7:30 senza attesa →", m.inviati.length, "(deve essere 0)");
  m = msg(); let dormito = 0; await esegui({db: finto(JSON.parse(JSON.stringify({...dati, allarmi: {}}))), messaging: m, now: ora("2026-11-26T06:45:00Z"), aspetta: true, log, dorme: async ms => { dormito = ms; }});
  console.log("7:45 con attesa → aspetta", Math.round(dormito / 60000), "min, inviati", m.inviati.length);
  m = msg(); await esegui({db, messaging: m, now: ora("2026-11-26T16:31:00Z"), log});
  console.log("17:31 →", m.inviati.map(x => x.token + " " + x.data.title + " / " + x.data.body).join(" | ") || "nessuno");
  m = msg(); await esegui({db, messaging: m, now: ora("2026-11-28T07:05:00Z"), log});
  console.log("sabato →", m.inviati.length, "(deve essere 0)");
  m = msg(); await esegui({db, messaging: m, now: ora("2026-11-26T11:00:00Z"), log});
  console.log("12:00 →", m.inviati.length, "(deve essere 0)");
})();
