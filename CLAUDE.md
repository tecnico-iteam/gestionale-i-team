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
- Promemoria ai clienti il giorno prima: `scripts/promemoria-clienti.js` (stesso workflow) manda dalle 17 un'email da
  ufficio@iteamservice.it (SMTP Hostinger, segreto GitHub `SMTP_PASSWORD`); il WhatsApp lo manda l'ufficio con un tocco dalla
  pagina Oggi (gratis, link wa.me). Stato in `promemoriaClienti/{idIntervento}` = {mail, wa} (firma data|ora); `clienti.noPromemoria` li disattiva.
- Account: l'amministratore li crea da 👤 (nome utente → `nome@utenti.iteamservice.it`). Ruoli: admin, ufficio,
  ufficio_tecnico, tecnico, preventivatore; ogni ruolo vede solo le sue aree (`modiConsentiti()` in index.html).
  Con l'account si entra come se stessi: `utenti.postazione` / `utenti.tecnico` (collegati da 👤 → Utenti, se vuoti
  ricavati dal nome); con una sola area si entra direttamente (`entraModo()`), niente PIN ufficio.
- Password: le cambia SOLO il titolare (pulsante 🔑 in alto, `openPasswords()` in firebase-app.js, visibile solo a OWNER);
  gli altri non possono cambiare la propria. La nuova password va in `utenti/{uid}.nuovaPassword` (scrivibile solo da admin) e
  `scripts/password.js` (stesso workflow degli avvisi) la applica con firebase-admin e la cancella; esito in `passwordCambiata`/`passwordErrore`.

- Foto da WhatsApp: `manifest.json` → `share_target` (POST `./condividi`, campo `media`): `sw.js` tiene i file nella cache
  `iteam-condivisi` e apre `?condividi=N`; `controllaCondivisi()` in index.html fa scegliere l'intervento e usa `caricaFile()`.
  Funziona solo su Android con l'app installata (iPhone non lo supporta: lì si salva in galleria e si usa 📷 Aggiungi).

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
