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
  si aggiorna dal rapportino), Contabilità divisa in 📊 Analisi (`vContabRiepilogo`: KPI, grafico SVG mensile, tipi di costo `CAT_COSTI`/`catCosto` o `contabilita.categoria`, primi clienti e fornitori), 🟢 Vendite (`fatture`; ⬆ `caricaVendite()`: XML FatturaPA letto da `leggiFatturaXml()` → salvata da sola, cliente trovato con `trovaCliente()` (P.IVA/CF/nome) o creato, doppioni saltati, PDF con lo stesso nome allegato; PDF/foto da soli aprono `formFattura({file})`; prova `test/prova-carica-vendite.js`), 🔴 Acquisti (`contabilita`), 📝 Preventivi (`vContabPrev`: accettati con fatture collegate da `fatture.preventivoId`, `statoPrevFat`, 🔗 `collegaFattura`, "+ Fattura di acconto/saldo"), 📋 Tabella (`vContabTabella`, colonne `TAB_COL` vendite/acquisti/spese → `TAB_COLL`, celle modificabili `data-tcell` col|id|campo → `salvaCella` = patch, ordinamento `ui.tabOrd`, ⬇ Excel vero con `scaricaExcelContab()` via SheetJS `loadXLSX()`; prova `test/prova-tabella.js`, serve `/tmp/node_modules/xlsx`), 🟠 Altre spese (`vContabSpese`, `spese/{id}` = {data, categoria `CAT_SPESE`, descrizione, beneficiario, importo, pagata, ricorrente, documenti[]}, regole come contabilita: `contab()`; 🔁 `copiaRicorrenti(mese)` copia le ricorrenti del mese prima, da pagare; entrano nell'Analisi come "Risultato dopo le altre spese", nella Tabella e nel terzo foglio dell'Excel), ⏱ Ore dipendenti (`vContabOre`: `registroOre()` per dipendente da `righeOre`/`totaliOre` del mese `ui.oreM`, costo con `CFG.costoInterno`, `tabellaOre`; ⬇ `scaricaExcelOre()` fogli Riepilogo e Giorno per giorno in ore decimali; 🕘 presenze `presenze/{data}_{slug}` = {tecnico, data, inizio, fine, pausaMin, minuti, note} (regole `contab()`): `vPresenzeGiorno()` con celle `data-pres` tec|campo → `salvaPresenza()`, ↧ `propostaPres()` da apertura attività e rapportini, `vPresenzeMese()`, colonna "Ore presenza" nel registro e foglio Presenze nell'Excel; il dipendente segna il SUO orario dal telefono con `boxOrario()` sotto la settimana (`data-mypres`, ▶ Inizio adesso / ⏹ Ho finito adesso → `salvaPresenzaDi(tec, d, campo, val, daTec)`: `daTec` + `uid`; l'inizio apre l'attività e viceversa); l'ufficio inserisce a mano solo se manca (`daUff`, riga ⚠️ manca); regole presenze: contab()/office() tutto, tecnico solo le sue (`mieOre`, uid e tecnico non cambiano), `caricaPresenze()`; prova `test/prova-orario-tec.js`; prova `test/prova-registro-ore.js`), 💰 Da incassare (`vContabCrediti`: crediti a mano in `crediti/{id}` = {chi, descrizione, importo, acconto, scadenza, incassato} + fatture con `daIncassare`/`residuo`); in Vendite e Acquisti `periodoBar()` (anno + mesi, `ui.conAnno`/`ui.conMese`), `totBox()` con e senza IVA, elenco `perMese()` (`vContab()` → `ui.conSez`; file in Storage `contabilita/`; solo titolare e utenti con
  `utenti.contabilita` = spunta 📒 che vede solo il titolare in 👤 Utenti).
- Solo ufficio vero (Tommaso e Irene = titolare/admin e ruolo `ufficio`, NON `ufficio_tecnico` né tecnici): `uffVero()`.
  Registro F-gas (`fgasOps/{id}`: interventi sul gas da comunicare alla Banca Dati entro 30 gg; il tecnico li crea dal
  rapportino con `campiFgasRap`/`salvaFgasRap`, id = id intervento, ma non li legge), Libretti e catasto (`vLibretti`,
  campi impianto `potenzaKw, codiceCatasto, statoCatasto, dataLibretto, ultimoREE, reeAnni, reeInviato`; REE da 12 kW,
  `stampaLibretto()`), Detrazioni (`detrazioni/{id}`, ENEA entro 90 gg da `fineLavori`). Avvisi in `extraOggiUff()`.
- 🚚 Mezzi e scadenze (tab Gestione `mezzi`, `vMezzi()`, solo `uffVero()`, regole `ufficio()`): `mezzi/{id}` (targa, revisione calcolata da
  `revisioneScad()` = 4 anni dall'immatricolazione poi 2, 1 se `oltre35`, fine mese; assicScad, bolloScad, tagliando per data e km,
  noleggio/leasing con rata e km compresi, `documenti[]` caricati con `caricaDocMezzo()`/`fotoDocMezzo()`), `attrezzature/{id}`
  (verifica/taratura ogni N mesi) e patentini F-gas dei tecnici (`patScad` in 👷). Avviso in `extraOggiUff()` con `scadenzeVicine()`. Prova: `test/prova-mezzi.js`.
- ⏱ Ore tecnici: rapportino `minutiLavoro` (fine − inizio − pausa) e, se due tecnici con orari diversi (spunta `stessoOrario` tolta),
  `minutiTec = {nome: minuti}`. `oreRap(x)`/`righeOre(mese, tec)`/`totaliOre()`: Interventi → Ore tecnici (`vOre`: totale mese per tecnico,
  `tabellaOre` giorni × tecnici con rosso oltre `ORE_GIORNO` = 8 h, dettaglio con `ui.oreTec`) e per il tecnico la scheda ⏱ Le mie ore (`vMieOre`). Prova: `test/prova-ore.js`.
  Ore libere `oreLibere/{id}` = {tecnico, uid, tipo (`TIPI_ORE`: Altro lavoro = ora lavorata; Ferie/Permesso/Malattia = assenze), data, dataFine
  (più giorni, `giorniTra()` salta sabato e domenica), minuti al giorno, descrizione, da}: `formOreLibere()`, `caricaOreLibere()` (ufficio tutte; tecnico solo
  `where uid` + `where tecnico` = `mioTecnico()`, le regole `mieOre()` lo impongono; cancella solo l'ufficio).
- ⏰ Allarmi ai tecnici (lun–ven): `scripts/allarmi.js` (workflow `allarmi.yml` poco prima, `--aspetta` l'ora esatta; riserva nel workflow avvisi):
  8:00 "hai aperto l'attività?" a chi non ha `giornate/{data}_{slug tecnico}` (= {tecnico, data, alle, uid, pos}: pulsante 🟢 Apri l'attività in `boxApertura()`
  o da ▶ Inizia in `startJob`) e non è assente tutto il giorno (oreLibere); 17:30 "hai compilato il rapportino?" a chi ha lavori di oggi o in corso
  senza rapportino. Una volta sola: `allarmi/{turno}-{data}_{tecnico}` con create(). Notifica "forte" (`data.forte` → `sw.js`: requireInteraction, vibrazione).
  ⏰ `mettiSveglia()` scarica un .ics con i due allarmi ricorrenti nel calendario del telefono. Ufficio: `boxAperture()` in `extraOggiUff()`.
  Prove: `test/prova-allarmi.js` (script, finto Firestore), `test/prova-apertura.js` (pagine).
- 📅 Pagina del tecnico: in alto `settimanaTec()` (lun–dom, frecce `ui.tecW`, giorno scelto `ui.tecG`, assenze da oreLibere); sotto, nella scheda "oggi", gli interventi del giorno scelto per esteso (`intCard` con `esteso` + `dettaglioTec()`: indirizzo con mappe, telefono, impianto, collega, descrizione intera). Sotto la settimana solo i lavori del giorno; le altre sezioni (prossimi, mese, clienti, inviati, furgone, ore, da assegnare `liberi`, + lavoro non programmato) sono nel ☰ Menu (`menuTecnico()`, `data-m`), aperte con `ui.tecF` e il pulsante ← I lavori del giorno. Prova: `test/prova-settimana.js`.
- Calendario: toccando un giorno (vista Mese) si apre `giornoPopup(g)` con gli appuntamenti; i tocchi dentro passano alla pagina.
- Trasferimento dal calendario iPhone (solo titolare, `vTrasfCal()` dal Calendario): il titolare incolla il link del
  "Calendario pubblico" iCloud in `calendariFeed/impostazioni.icloudUrl`; `scripts/calendari.js` (workflow avvisi, ogni 10 min)
  copia gli appuntamenti futuri in `eventiCal/{id}`; "Trasferisci" apre `formIntervento(x, dopo)` precompilato e segna `convertito`,
  "Salta" = `nascosto`; "Ho finito" toglie il link e svuota la lista.
- Grafica: tema "Giovane" (viola #6c4cf1, corallo #ff6b4a, menta) in fondo al <style> di index.html, font Nunito; `.hero` in `vOggi()`.
- Scheda impianto `detImpianto()` con etichetta QR (link `?imp=ID`, `controllaLinkImpianto()`).
- Timbratura: `posizione()` salva `interventi.inizioPos` (▶ Inizia) e `rapportino.finePos` (invio), visibili solo all'ufficio.
- Ruoli: tecnico e preventivatore non caricano fatture, ordini, contratti (`colsPerMe()`), e le regole lo impediscono.
- Sicurezza: elimina solo ufficio/admin (`puoEliminare()` + regole). `remove()` copia il documento in `cestino/{id}` = {col, docId, dati, titolo, chi, il}
  prima di cancellarlo; `save`/`patch`/`remove` aggiungono `registro/{id}` = {col, docId, azione, titolo, campi, chi, il} (no listino e code di servizio).
  Pagina Gestione → 🗑️ Cestino e registro (`vCestino`, ripristina = set del documento + cancella dal cestino; "per sempre" solo admin).
  Regole: preventivi solo ufficio e preventivatori; listino legge ufficio+preventivatori, scrive ufficio; registro solo aggiunte.
  I file di commesse e contabilità non si cancellano più con il documento (servono al ripristino).
- Dati riservati (`RISERVATI`, `dividi()`/`unisci()`/`scriviRis()` in index.html): prezzi d'acquisto del magazzino (prezzoAcquisto,
  prezzoListino, sconto, costo) stanno in `magazzinoPrezzi/{id}` (solo ufficio + preventivatori); descrizione e documenti NON condivisi
  delle commesse in `commesseRiservate/{id}` (solo ufficio). save/patch dividono da soli; in memoria S.magazzino/S.commesse sono uniti.
  Rubrica: `clienti.recente` (+ `ultimoMs`) = attività nell'ultimo anno; chi non è titolare/admin/ufficio carica solo `where("recente","==",true)`
  e le regole lo impongono. `toccaCliente()` lo rimette a true a ogni intervento/preventivo/fattura…; `scripts/clienti-recenti.js` (workflow
  backup, ogni notte) lo ricalcola. `migraRiservati()` (all'apertura del titolare, stato in `config/migrazioni`) sposta i dati vecchi.
  Nei test `window.__S` = S (solo con il finto database).
- Backup notturno: `.github/workflows/backup.yml` → `scripts/backup.js` salva `backups/backup-AAAA-MM-GG.json` in Storage (30 giorni);
  la domenica (o avvio a mano) manda anche la copia compressa `.json.gz` per email a carone.t46@gmail.com e carone.t@me.com (fuori da Firebase); 👤 → Importa accetta il .gz.
- Importazione sicura di dati riservati (per ora solo `mezzi`, `attrezzature`): `.github/workflows/importa.yml` → `scripts/importa-sicuro.js`.
  Push senza `importa/pacchetto.enc` = crea chiave (privata in Storage `importa/`, pubblica nel log: `gh run view ID --log`); poi si cifra il JSON
  {collections, media: {idVecchio: dataUrl}} (RSA-OAEP sha256 + AES-256-GCM: {chiave, iv, tag, dati} base64), push in `importa/pacchetto.enc`
  → importa e distrugge la chiave. Poi togliere il file con commit "[skip ci]". Anche 👤 → Importa carica i `documenti[]` dai `media`.
- Regole: `.github/workflows/regole.yml` → `scripts/regole.js` le pubblica da solo quando cambiano (se fallisce, vanno incollate a mano).

## Dati (Firestore)
Collezioni: clienti, impianti, interventi, preventivi, fatture, magazzino, listino, dico, commesse, contratti, ordini, contabilita, config/impostazioni,
utenti/{uid} = {email, nome, ruolo: admin|ufficio|tecnico|preventivatore|nuovo, attivo}.
Il proprietario è carone.t46@gmail.com (sempre amministratore, costante OWNER in firebase-app.js e nelle regole);
secondo titolare di riserva segreteria.iteam@gmail.com (`OWNERS` in firebase-app.js, stesso elenco in firestore.rules e storage.rules).
Media: `interventi.media[] = {id, url, tipo, da, il}`; `magazzino.foto` + `fotoUrl`.

## Regole di lavoro
- Mantieni l'app in un solo `index.html` e senza passaggi di build.
- Prima del push: `node --check` sullo script estratto e prova in Chromium (Playwright) con un finto
  `window.claude` (vedi `test/fbmock.js e test/prova.js` se presente).
  Giro di controllo completo: `node test/prova-giro-completo.js` (tutte le pagine per ogni ruolo, elenca gli errori)
  e `node test/prova-flussi.js` (rapportino → verifica → fattura → pagata; preventivo → accettato → fattura).
  I test usano un piccolo server locale o `route(/^https:\/\//)`: con `file://` i listini JSON non si caricano.
- Non mettere mai dati dei clienti nel repository (è pubblico).
