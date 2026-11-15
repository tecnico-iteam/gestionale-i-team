# iTeam Gestionale – note per Claude

App web installabile (PWA) per iTeam S.R.L.S. (climatizzazione, Moncalieri/Vinovo). Il titolare chiede
le modifiche a Claude in chat: Claude modifica questo repository, fa commit e push su `main`;
GitHub Pages pubblica da solo in 1–2 minuti. Il titolare non tocca il codice: spiegagli le cose
in italiano semplice, senza gergo tecnico.

## Struttura
- `index.html` – tutta l'app (HTML + CSS + JS in un file). Usa `claude.use("db" | "assets" | "downloads" | "user")`.
  Tutti i testi dell'interfaccia sono in italiano.
- `firebase-app.js` – fornisce `window.claude.use(...)` sopra Firebase: Firestore (compat SDK, API
  `collection/doc/set/update/delete/onSnapshot`), Storage (cartella `media/`), download/condivisione file,
  schermata di accesso (Google o email+password), gestione utenti/ruoli, backup e importazione JSON.
- `firebase-config.js` – configurazione pubblica del progetto Firebase.
- `firestore.rules`, `storage.rules` – regole di sicurezza. NON si pubblicano da soli: se cambiano,
  il titolare deve incollarle nella console Firebase (dagli istruzioni passo passo).
- `sw.js` – service worker (offline). Rete prima per pagina/script, cache prima per `img/`, `icons/` e SDK.
- `manifest.json`, `icons/` – installazione come app.
- `listino-*.json`, `img/` – listini e foto prodotti caricati nel magazzino/preventivatore.

- Avvisi appuntamenti: il tecnico attiva le notifiche (firebase-app.js → `ITEAM.notifiche`, chiave `vapidKey` in
  firebase-config.js); il codice del telefono va in `dispositivi/{token}` = {tecnico,…}. `.github/workflows/avvisi.yml`
  esegue `scripts/avvisi.js` ogni 10 min (segreto GitHub `FIREBASE_SERVICE_ACCOUNT`): "nuovo/spostato" e promemoria
  ~1 ora prima; lo stato inviato sta in `avvisi/{idIntervento}`, `config/avvisi` segna il primo avvio. Il `push` lo mostra `sw.js`.
  Il tecnico può anche salvare gli appuntamenti nel calendario del telefono (.ics con avviso 1 ora prima).
- Account: l'amministratore li crea da 👤 (nome utente → `nome@utenti.iteamservice.it`). Ruoli: admin, ufficio,
  ufficio_tecnico, tecnico, preventivatore; ogni ruolo vede solo le sue aree (`modiConsentiti()` in index.html).
  Con l'account si entra come se stessi: `utenti.postazione` / `utenti.tecnico` (collegati da 👤 → Utenti, se vuoti
  ricavati dal nome); con una sola area si entra direttamente (`entraModo()`), niente PIN ufficio.

## Dati (Firestore)
Collezioni: clienti, impianti, interventi, preventivi, fatture, magazzino, listino, dico, config/impostazioni,
utenti/{uid} = {email, nome, ruolo: admin|ufficio|tecnico|preventivatore|nuovo, attivo}.
Il proprietario è carone.t46@gmail.com (sempre amministratore, costante OWNER in firebase-app.js e nelle regole).
Media: `interventi.media[] = {id, url, tipo, da, il}`; `magazzino.foto` + `fotoUrl`.

## Regole di lavoro
- Mantieni l'app in un solo `index.html` e senza passaggi di build.
- Prima del push: `node --check` sullo script estratto e prova in Chromium (Playwright) con un finto
  `window.claude` (vedi `test/fbmock.js e test/prova.js` se presente).
- Non mettere mai dati dei clienti nel repository (è pubblico).
