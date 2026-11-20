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
  `listino-tecnosystemi-2026-09.json` = offerta BM n. 2909 con prezzi NETTI d'acquisto (BUNDLES `costo: true`: al caricamento
  si chiede il ricarico; nel listino `prezzo` = costo + ricarico, `costo` = netto). Prefisso documenti "ts".
  Stessa logica (`costo: true`, prefisso `pre`) per `listino-erredi-2026.json` ("er", da preventivi/fatture Erredi 2026, prezzo = netto
  dopo sconti, con `listinoFornitore`/`scontoFornitore`/`fonte`) `listino-idrocentro-2026.json` ("ic") , `listino-doppler-2026.json` ("dp", listino General meno 52,75%) e `listino-sacchi-2026.json` ("sa", offerte Sacchi Orbassano). L'importazione in magazzino
  crea da sola una spunta + ricarico per ogni listino `costo: true` di BUNDLES.
  `n` in BUNDLES = numero articoli del file: se nel listino ce ne sono meno compare "Aggiorna". Foto prese dai cataloghi
  dei fornitori in `img/fornitori/` (campo `img`); senza foto si usa un disegno di `ICONS`/`iconFor()` (regole `r0` per i fornitori).

- Avvisi appuntamenti: il tecnico attiva le notifiche (firebase-app.js → `ITEAM.notifiche`, chiave `vapidKey` in
  firebase-config.js); il codice del telefono va in `dispositivi/{token}` = {tecnico,…}. `.github/workflows/avvisi.yml`
  esegue `scripts/avvisi.js` ogni 10 min (segreto GitHub `FIREBASE_SERVICE_ACCOUNT`): "nuovo/spostato" e promemoria (entro 2 ore prima: GitHub di fatto lo fa girare circa ogni ora)
  ~1 ora prima; lo stato inviato sta in `avvisi/{idIntervento}`, `config/avvisi` segna il primo avvio. Il `push` lo mostra `sw.js`.
  Il tecnico può anche salvare gli appuntamenti nel calendario del telefono (.ics con avviso 1 ora prima).
- Promemoria ai clienti il giorno prima: `scripts/promemoria-clienti.js` (stesso workflow) manda dalle 17 un'email da
  ufficio@iteamservice.it (SMTP Hostinger, segreto GitHub `SMTP_PASSWORD`); il WhatsApp lo manda l'ufficio con un tocco dalla
  pagina Oggi (gratis, link wa.me). Stato in `promemoriaClienti/{idIntervento}` = {mail, wa} (firma data|ora); `clienti.noPromemoria` li disattiva.
- Account: l'amministratore li crea da 👤 (nome utente → `nome@utenti.iteamservice.it`). Ruoli: admin, ufficio,
  ufficio_tecnico, tecnico, tecnico_preventivatore (Alessandro), preventivatore; ogni ruolo vede solo le sue aree (`modiConsentiti()` in index.html).
  Con l'account si entra come se stessi: `utenti.postazione` / `utenti.tecnico` (collegati da 👤 → Utenti, se vuoti
  ricavati dal nome); con una sola area si entra direttamente (`entraModo()`), niente PIN ufficio.
- Password: le cambia SOLO il titolare (pulsante 🔑 in alto, `openPasswords()` in firebase-app.js, visibile solo a OWNER);
  gli altri non possono cambiare la propria. La nuova password va in `utenti/{uid}.nuovaPassword` (scrivibile solo da admin) e
  `scripts/password.js` (stesso workflow degli avvisi) la applica con firebase-admin e la cancella; esito in `passwordCambiata`/`passwordErrore`.

- Foto da WhatsApp: `manifest.json` → `share_target` (POST `./condividi`, campo `media`): `sw.js` tiene i file nella cache
  `iteam-condivisi` e apre `?condividi=N`; `controllaCondivisi()` in index.html fa scegliere l'intervento e usa `caricaFile()`.
  Funziona solo su Android con l'app installata (iPhone non lo supporta: lì si salva in galleria e si usa 📷 Aggiungi).

- Pagina "Gestione" (tab `altro`, `vAltro()` e `ALTRO()` in index.html, solo ufficio): Margini (`margineInt`, `marginePrev`;
  costo ore = `CFG.costoInterno`, costo materiali = `costo` salvato nelle righe o `prezzoAcquisto`), Confronto prezzi (`fontiPrezzo`,
  `stessoArticolo`: codice o misura + parole, `hintPrezzo` nel preventivatore), Incassi e solleciti, Ordini ai fornitori (`ordini`,
  contatti in `CFG.fornitori`, "Ricevuto" carica il magazzino), Furgoni (`magazzino.furgoni = {tecnico: qta}`: il rapportino scarica
  prima dal furgone; il tecnico ha la scheda 🚐 Furgone con i `materialiPrevisti` del prossimo giorno), Contratti (`contratti`),
  Registro F-gas (`fgasMesi`: ≥5 t → 12 mesi, ≥50 → 6, ≥500 → 3, doppio con `rilevatorePerdite`; `ultimoControlloPerdite`
  si aggiorna dal rapportino), Contabilità divisa in 📊 Analisi (`vContabRiepilogo`: KPI, grafico SVG mensile, tipi di costo `CAT_COSTI`/`catCosto` o `contabilita.categoria`, primi clienti e fornitori), 🟢 Vendite (`fatture`), 🔴 Acquisti (`contabilita`), 📝 Preventivi (`vContabPrev`: accettati con fatture collegate da `fatture.preventivoId`, `statoPrevFat`, 🔗 `collegaFattura`, "+ Fattura di acconto/saldo"), 💰 Da incassare (`vContabCrediti`: crediti a mano in `crediti/{id}` = {chi, descrizione, importo, acconto, scadenza, incassato} + fatture con `daIncassare`/`residuo`); in Vendite e Acquisti `periodoBar()` (anno + mesi, `ui.conAnno`/`ui.conMese`), `totBox()` con e senza IVA, elenco `perMese()` (`vContab()` → `ui.conSez`; file in Storage `contabilita/`; solo titolare e utenti con
  `utenti.contabilita` = spunta 📒 che vede solo il titolare in 👤 Utenti).
- Solo ufficio vero (Tommaso e Irene = titolare/admin e ruolo `ufficio`, NON `ufficio_tecnico` né tecnici): `uffVero()`.
  Registro F-gas (`fgasOps/{id}`: interventi sul gas da comunicare alla Banca Dati entro 30 gg; il tecnico li crea dal
  rapportino con `campiFgasRap`/`salvaFgasRap`, id = id intervento, ma non li legge), Libretti e catasto (`vLibretti`,
  campi impianto `potenzaKw, codiceCatasto, statoCatasto, dataLibretto, ultimoREE, reeAnni, reeInviato`; REE da 12 kW,
  `stampaLibretto()`), Detrazioni (`detrazioni/{id}`, ENEA entro 90 gg da `fineLavori`). Avvisi in `extraOggiUff()`.
- Calendario: toccando un giorno (vista Mese) si apre `giornoPopup(g)` con gli appuntamenti; i tocchi dentro passano alla pagina.
- Trasferimento dal calendario iPhone (solo titolare, `vTrasfCal()` dal Calendario): il titolare incolla il link del
  "Calendario pubblico" iCloud in `calendariFeed/impostazioni.icloudUrl`; `scripts/calendari.js` (workflow avvisi, ogni 10 min)
  copia gli appuntamenti futuri in `eventiCal/{id}`; "Trasferisci" apre `formIntervento(x, dopo)` precompilato e segna `convertito`,
  "Salta" = `nascosto`; "Ho finito" toglie il link e svuota la lista.
- Grafica: tema "Giovane" (viola #6c4cf1, corallo #ff6b4a, menta) in fondo al <style> di index.html, font Nunito; `.hero` in `vOggi()`.
- Scheda impianto `detImpianto()` con etichetta QR (link `?imp=ID`, `controllaLinkImpianto()`).
- Timbratura: `posizione()` salva `interventi.inizioPos` (▶ Inizia) e `rapportino.finePos` (invio), visibili solo all'ufficio.
- Ruoli: tecnico e preventivatore non caricano fatture, ordini, contratti (`colsPerMe()`), e le regole lo impediscono.
- Backup notturno: `.github/workflows/backup.yml` → `scripts/backup.js` salva `backups/backup-AAAA-MM-GG.json` in Storage (30 giorni).
- Regole: `.github/workflows/regole.yml` → `scripts/regole.js` le pubblica da solo quando cambiano (se fallisce, vanno incollate a mano).

## Dati (Firestore)
Collezioni: clienti, impianti, interventi, preventivi, fatture, magazzino, listino, dico, commesse, contratti, ordini, contabilita, config/impostazioni,
utenti/{uid} = {email, nome, ruolo: admin|ufficio|tecnico|preventivatore|nuovo, attivo}.
Il proprietario è carone.t46@gmail.com (sempre amministratore, costante OWNER in firebase-app.js e nelle regole).
Media: `interventi.media[] = {id, url, tipo, da, il}`; `magazzino.foto` + `fotoUrl`.

## Regole di lavoro
- Mantieni l'app in un solo `index.html` e senza passaggi di build.
- Prima del push: `node --check` sullo script estratto e prova in Chromium (Playwright) con un finto
  `window.claude` (vedi `test/fbmock.js e test/prova.js` se presente).
  Giro di controllo completo: `node test/prova-giro-completo.js` (tutte le pagine per ogni ruolo, elenca gli errori)
  e `node test/prova-flussi.js` (rapportino → verifica → fattura → pagata; preventivo → accettato → fattura).
  I test usano un piccolo server locale o `route(/^https:\/\//)`: con `file://` i listini JSON non si caricano.
- Non mettere mai dati dei clienti nel repository (è pubblico).
