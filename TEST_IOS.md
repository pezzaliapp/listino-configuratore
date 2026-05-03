# Test iOS — protocollo manuale post-fix

Da fare con **iPhone in mano**, dopo che il branch `audit-fixes` è stato deployato (push su GitHub + attesa di 1-3 min per GitHub Pages).

## Setup iniziale (una volta)

Prima di tutto, **forza l'aggiornamento del service worker** sul tuo iPhone:

1. Apri Safari su iPhone.
2. Vai su `https://alessandropezzali.it/listino-configuratore/`.
3. Settings → Safari → Avanzate → Dati siti web → cerca `alessandropezzali.it` → **Rimuovi**.
4. Se hai la PWA installata sulla Home, **disinstallala** (tieni premuta l'icona → Rimuovi app → Elimina).
5. Riapri il sito da Safari, attendi che carichi.
6. Aggiungi alla Home: pulsante condividi → Aggiungi alla schermata Home → Aggiungi.

Da ora in avanti, apri SEMPRE l'app dalla Home (non da Safari) per testare il comportamento PWA standalone reale.

---

## Test 1 — Promo PDF "vecchia" (URL/path) → deve aprirsi sempre

**Obiettivo:** verificare che il flusso più semplice non sia regredito.

1. Apri l'app dalla Home iPhone.
2. Vai alla sezione **Promo**.
3. Identifica una promo con file PDF nella cartella `promo/` (es. "Prevendita B 300", path `promo/prevendita-b300.pdf`).
4. Premi **Apri promo**.

**Atteso:**
- Si apre Safari (anche se la PWA è in standalone — è normale: iOS apre i link `_blank` esterni).
- Il PDF viene mostrato.
- Tornando alla PWA dalla statusbar/home, l'app è dove l'avevi lasciata.

**Se fallisce:** è un problema *non* causato dai fix di questo branch. Verifica che il file esista a `promo/prevendita-b300.pdf`.

---

## Test 2 — Promo PDF embedded → modal in-app (v2 dopo feedback iPhone)

**Obiettivo:** verifica del fix popup-fix-ios-pwa. La v1 (window.open + about:blank pre-await) era stata bloccata da Safari iOS 18 in PWA standalone. La v2 usa un **modal interno** dentro la PWA, niente popup.

**Setup:** servono almeno una promo embedded di tipo PDF (`url` che inizia con `data:application/pdf`). Se non l'hai ancora, aggiungila via admin: carica un PDF qualunque < 4 MB e pubblica.

1. Apri l'app dalla Home iPhone.
2. Sezione **Promo** → individua una promo con icona/etichetta PDF embedded.
3. Premi **Apri promo**.

**Atteso:**
- **Niente nuova scheda Safari, niente popup blocker alert.**
- Si apre un overlay nero a tutto schermo **dentro la PWA** con:
  - In alto: titolo della promo + pulsanti "Pag. ‹›" (se PDF multi-pagina), "Scarica", "Chiudi".
  - Al centro: la prima pagina del PDF renderizzata (canvas pdf.js).
- Premi "›" per andare alla pagina successiva, poi "‹" per tornare. Inserisci un numero nell'input "Pag." e premi Invio: salta a quella pagina.
- Premi **Chiudi** o tocca lo sfondo nero a lato del PDF: il modal si chiude e torni alla pagina promo.

**Se vedi ancora popup blocker o scheda bianca:** il SW v10 non è attivo. Da Mac collegato → DevTools iPhone → Storage → Service Workers → controlla che il nome cache sia `listino-configuratore-pro-promo-embedded-v10`. Se è ancora v9 o precedente: Settings → Safari → Avanzate → Dati siti web → rimuovi il sito, poi reinstalla la PWA.

---

## Test 3 — Promo immagine embedded → modal in-app

**Obiettivo:** stessa logica del Test 2, ma per immagini.

1. Apri la promo "prova puma" (tipo image).
2. Premi **Apri promo**.

**Atteso:**
- **Niente popup, niente nuova scheda.**
- Modal in-app: sfondo nero, immagine centrata, ridimensionata a max 100% larghezza/altezza schermo.
- In basso, hint chiaro: *"Tieni premuto sull'immagine per salvarla nelle Foto."*
- I pulsanti di navigazione pagine PDF NON sono visibili (è un'immagine, non un PDF).
- Pinch-to-zoom sul modal funziona (il modal stesso scrolla, l'immagine resta centrata).

**Test rapidi correlati:**
- Tieni premuto sull'immagine → menu iOS con "Salva immagine", "Copia", "Condividi". ✅ se appare.
- Premi **Chiudi** → modal si chiude.
- Tocca lo sfondo nero (lato sinistro/destro fuori dall'immagine) → modal si chiude. ✅
- Tocca l'immagine stessa → modal NON si chiude (deve restare aperto per consentire long-press).

---

## Test 3b — Pulsante "Scarica" nel modal

**Obiettivo:** verifica del download via Blob URL + `<a download>`.

1. Apri una promo embedded (PDF o immagine) → modal aperto.
2. Premi **Scarica** in alto a destra del modal.

**Atteso (iOS):**
- iOS apre il **share sheet** o un menu "Apri in...", oppure salva direttamente nei Download / File a seconda dell'app predefinita.
- Per le immagini: alcune versioni iOS aprono direttamente in una nuova scheda Safari con prompt "Salva nelle Foto". Anche questo è ok.
- **Non ci deve essere errore CSP nella console** (Mac collegato → Sviluppo → console JS).

**Se non funziona:** controlla nella console errori CSP (probabile `default-src` che blocca la navigazione a `blob:`). In tal caso si può aggiungere `blob:` a `default-src` o testare con `<a target="_blank">` esplicito. Segnalalo.

---

## Test 4 — WhatsApp dalla sezione Promo

**Obiettivo:** verifica del fix iOS3 (`<a target="_blank">` invece di `location.href`).

1. Sulla stessa promo, premi **WhatsApp**.

**Atteso:**
- Si apre Safari (o WhatsApp se installato e impostato come gestore di `wa.me`).
- Il messaggio precompilato include titolo, descrizione, scadenza e link all'app.
- **La PWA continua a esistere in background.** Tornando dall'app switcher iOS, la PWA è ancora aperta nel suo stato.

**Se la PWA "sparisce":** il fix non ha avuto effetto. Verifica che il SW sia effettivamente la v9 (DevTools collegato → Service Workers → controllare il nome `listino-configuratore-pro-promo-embedded-v10`).

---

## Test 5 — Invio preventivo via WhatsApp

**Obiettivo:** stesso fix di Test 4, ma sull'altro entry point.

1. Carica un Excel/CSV listino qualsiasi (anche piccolo).
2. Aggiungi 2-3 articoli al preventivo.
3. Premi **Invia WhatsApp**.

**Atteso:** identico al Test 4. La PWA non viene "abbandonata".

---

## Test 6 — Service worker: cache dimensione

**Obiettivo:** verifica del fix S6 (cache canonical key).

1. Da Mac collegato all'iPhone, Safari → Sviluppo → [iPhone] → la pagina del listino.
2. Storage → Cache Storage → `listino-configuratore-pro-promo-embedded-v10`.
3. Conta le entry. Dovrebbero essere ~5 file iniziali + 1 entry per `promo.json`.
4. Premi 5 volte il pulsante **Aggiorna** nella sezione Promo.
5. Ricontrolla. **Le entry NON devono aumentare** (prima del fix, ogni `?v=...` aggiungeva una entry).

**Se le entry crescono:** il SW v9 non è attivo. Forza unregister + reinstall.

---

## Test 7 — Pannello admin: niente login, notice visibile

**Obiettivo:** verifica del fix S4 (password admin rimossa).

1. Vai a `https://alessandropezzali.it/listino-configuratore/admin-promo.html`.

**Atteso:**
- Si apre direttamente il pannello admin, senza chiedere password.
- In cima alla pagina (sotto il banner nero) c'è un **avviso arancione** che dice: "⚠️ Pannello admin pubblicamente accessibile. La protezione effettiva è il PAT GitHub..."
- Sotto, vedi le promo, la configurazione GitHub, ecc.

---

## Test 8 — Admin: blocca SVG

**Obiettivo:** verifica del fix S2 (whitelist MIME).

1. Nel pannello admin, premi **Aggiungi riga promo**.
2. Premi **Carica un file PDF o un'immagine** sulla nuova riga.
3. Prova a caricare un file `.svg` (anche un'immagine SVG innocua).

**Atteso:**
- Alert: "Tipo file 'image/svg+xml' non supportato. Usa PDF, JPG, PNG, WebP o GIF."
- Il file NON viene incorporato.

---

## Test 9 — Admin: backup pre-publish

**Obiettivo:** verifica del fix MA1 livello 1 (auto-backup).

**Setup richiesto:** PAT GitHub configurato e funzionante.

1. Aggiungi una riga di test (titolo "test backup", senza file).
2. Premi **Pubblica su GitHub**.
3. Quando il publish è completato, da Mac collegato Safari → Sviluppo → [iPhone] → la pagina admin.
4. Storage → IndexedDB → `listino_pro_db` → store `files`.

**Atteso:**
- Tra le chiavi vedi una entry `listino_promo_admin_backup_<timestamp ISO>` con il JSON pre-publish.
- Massimo 5 entry di backup (le più vecchie vengono eliminate).

5. **Pulizia:** rimuovi la promo "test backup" e ripubblica.

---

## Test 10 — Admin: warning età token

**Obiettivo:** verifica del fix S3 (avviso > 60 giorni).

Difficile da testare on-demand (richiede attesa o manipolazione manuale). Per simulare:

1. Mac collegato → DevTools iPhone → Storage → IndexedDB → `listino_pro_db` → `files` → `listino_promo_admin_gh_config_v1`.
2. Modifica il valore: cambia `tokenSavedAt` a una data > 60 giorni fa, es. `"2026-01-01T00:00:00.000Z"`.
3. Ricarica la pagina admin.

**Atteso:**
- Nel pannello "Configurazione GitHub", area `ghResult`, appare un avviso: "⚠️ Il token è salvato su questo dispositivo da X giorni..."

4. **Pulizia:** rimetti `tokenSavedAt` al valore originale (o salva di nuovo il token tramite UI).

---

## Test 11 — Funzionalità di base non regredite

Spot-check rapido che niente di vecchio sia rotto.

1. Carica un Excel/CSV listino.
2. Verifica che la tabella si popoli, i filtri funzionino, le chip categoria.
3. Aggiungi un articolo al preventivo, modifica quantità, applica sconto/ricarico.
4. Premi **Export CSV** e apri il file con Numbers/Excel.
5. **Atteso:** se una descrizione iniziava con `=` o `@` (test esplicito: caricarla nel listino con tale carattere), nel CSV vedi la cella prefissata da `'` (apostrofo) — significa che CSV injection guard funziona.
6. Il preventivo si copia con "Copia testo" sul clipboard.

---

## Cosa segnalarmi

Per ogni test, segnami:
- ✅ funziona / ❌ non funziona / ⚠️ funziona ma stranamente
- Versione iOS (Settings → Generali → Info)
- Versione Safari (segue iOS)
- Se PWA installata o aperta da Safari
- Eventuale screenshot della scheda bianca / errore

I test che mi interessano di più, in ordine: **Test 2, Test 3, Test 3b, Test 4, Test 7, Test 8**.
