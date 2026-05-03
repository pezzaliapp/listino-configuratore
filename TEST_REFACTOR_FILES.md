# Test refactor — upload binari via Contents API

Da fare con **iPhone in mano** + un browser desktop (Mac/Windows/Linux) per accedere al pannello admin con DevTools, dopo che il branch `refactor-upload-binari` è stato mergiato in `main` e il deploy GitHub Pages è completo (1-3 min dopo il merge).

## Setup iniziale (una volta)

1. **Forza l'aggiornamento del service worker** sul tuo iPhone e desktop:
   - iPhone: Impostazioni → Safari → Avanzate → Dati siti web → cerca `alessandropezzali.it` → **Rimuovi**.
   - Desktop: in DevTools → Application → Service Workers → **Unregister** + **Clear storage**.
2. Reinstalla la PWA su iPhone (pulsante condividi → Aggiungi alla schermata Home).
3. Verifica nella DevTools del desktop che il SW attivo sia `listino-configuratore-pro-promo-embedded-v12`.
4. Assicurati di avere il **PAT GitHub configurato** nel pannello admin (Configurazione GitHub → Test connessione → ✅).

---

## Test 1 — Upload nuova promo immagine via admin → file appare in `promo/`

**Obiettivo:** verifica che `attachFileToPromo` faccia il PUT binario invece di scrivere data URI nel JSON.

1. Apri `admin-promo.html` da desktop (con DevTools aperta su Network tab).
2. Premi **Aggiungi riga promo**.
3. Nel campo "Titolo" scrivi `Test refactor 1` (per controllare lo slug).
4. Premi "Carica file PDF o un'immagine" e scegli un'immagine PNG/JPG di prova (1-2 MB).

**Atteso:**
- Nel `saveState` appare: *"Caricamento file su GitHub… Test refactor 1"*.
- In Network: una `PUT https://api.github.com/repos/pezzaliapp/listino-configuratore/contents/promo/test-refactor-1-<timestamp>.png?...` → status 201 Created.
- Il `saveState` cambia in: *"✅ Salvato come `promo/test-refactor-1-<timestamp>.png`"*.
- La riga della promo nell'admin mostra il pill verde **FILE GITHUB**, con path visibile.
- Il campo URL della riga è disabilitato (gestito automaticamente).

**Verifica su GitHub web:**
- Vai a `https://github.com/pezzaliapp/listino-configuratore/tree/main/promo`.
- Vedi il file `test-refactor-1-<timestamp>.png` appena creato.
- Apri il file su GitHub: anteprima dell'immagine corretta.

**Verifica del JSON locale:**
- In DevTools → Application → IndexedDB → `listino_pro_db` → `files` → `listino_promo_admin_draft_v3`.
- Apri il valore: deve essere un JSON con la promo `Test refactor 1` e `"url": "promo/test-refactor-1-<timestamp>.png"`.
- **NON deve contenere `"url": "data:image/...;base64,..."`** per questa promo.

---

## Test 2 — Condividi nuova promo via WhatsApp → link diretto al file

**Obiettivo:** verifica che il messaggio WhatsApp contenga l'URL del file, non dell'app.

1. Pubblica la nuova promo: premi **Pubblica su GitHub** nell'admin.
2. Atteso nel summary: *"Pubblicato JSON + 1 file binario"* (il binario era già stato pushato durante l'upload, qui è solo il JSON).
3. Aspetta 1-3 min per il deploy GitHub Pages.
4. Apri l'app utente da iPhone (PWA Home).
5. Sezione **Promo** → trova "Test refactor 1".
6. Premi **WhatsApp**.

**Atteso:**
- Si apre la condivisione WhatsApp (o Safari se WhatsApp non installato).
- Il messaggio precompilato include il link diretto:
  ```
  https://alessandropezzali.it/listino-configuratore/promo/test-refactor-1-<timestamp>.png
  ```
- Il link **NON** è la home dell'app (`https://alessandropezzali.it/listino-configuratore/`).
- Il link **NON** ha `www.` davanti (apex domain).

---

## Test 3 — Cliccare il link condiviso da iPhone → si apre direttamente il file

**Obiettivo:** verifica che il link sia veramente cliccabile e mostri il file in Safari.

1. Dal messaggio WhatsApp del Test 2, premi sul link.
2. (Anche fuori dalla PWA: copia il link, esci dall'app, apri Safari, incollalo nella barra URL.)

**Atteso:**
- Safari apre direttamente l'immagine PNG (full screen).
- Niente 404. Niente redirect.
- Long-press → "Salva immagine" funziona.

**Se appare 404:**
- Verifica il deploy GitHub Pages è completato (può richiedere 1-3 min).
- Verifica che il file esista a quel path su GitHub web.
- Verifica il branch deployato (Settings → Pages della repo).

---

## Test 4 — "Apri promo" sulla nuova promo dentro la PWA → window.open path normale

**Obiettivo:** verifica che le promo nuove con path "promo/..." non passino dal modal in-app, ma usino `window.open` (più leggero, link diretto).

1. Apri la PWA da Home iPhone.
2. Sezione Promo → "Test refactor 1".
3. Premi **Apri promo**.

**Atteso:**
- Si apre Safari esternamente (PWA standalone → uscita normale).
- L'immagine viene mostrata direttamente.
- **NON** appare il modal in-app fullscreen (che è solo per `data:` URI legacy).
- Tornando alla PWA dall'app switcher, è dove l'avevi lasciata.

**Indicatore tecnico:** apri DevTools sul desktop (collegamento iPhone via cavo, Sviluppo → [iPhone] → la pagina). Quando premi Apri promo, dovresti vedere in console **niente** chiamate al modal (`openPromoModal` non invocata) — solo un `window.open`.

---

## Test 5 — Promo legacy con `data:` URI nel JSON ancora apre il modal in-app

**Obiettivo:** retrocompatibilità. Le promo del vecchio formato devono continuare a funzionare.

**Setup:** servono ancora promo con `url:"data:..."` nel `promo.json` corrente. Se le hai già migrate (Test 6) torna a una versione precedente del JSON, oppure aggiungi una promo manuale via "Importa testo JSON" con un `data:` URI di test.

1. Apri la PWA, sezione Promo, individua una promo con icona EMBEDDED (o sai che è `data:`).
2. Premi **Apri promo**.

**Atteso:**
- Si apre il **modal in-app** dentro la PWA (sfondo nero fullscreen, immagine/PDF al centro).
- Il modal ha pulsanti Chiudi, Scarica.
- Niente popup, niente uscita dalla PWA.

Questo conferma che il fix v2 (popup-fix-ios-pwa) per il modal in-app è ancora attivo per i `data:` URI legacy.

---

## Test 6 — Migrazione bonus: data: URI legacy → file GitHub

**Obiettivo:** verifica del pulsante "Migra embedded → file GitHub".

**Setup:** servono almeno 1-2 promo con `url:"data:..."` nel JSON corrente.

1. Apri `admin-promo.html` con DevTools Network aperta.
2. Premi **Migra embedded → file GitHub**.
3. Conferma il dialog "Migrare N promo embedded?".

**Atteso (durante):**
- Il pulsante si disabilita.
- Per ogni promo: in `saveState` appare *"Migrazione 1/N… <titolo>"*.
- In Network: una `PUT https://api.github.com/repos/pezzaliapp/listino-configuratore/contents/promo/<slug>-<timestamp>.<ext>` per ogni promo → 201.

**Atteso (alla fine):**
- Alert: *"✅ Migrazione completata: N promo migrate da data: URI a file GitHub. Ora premi Pubblica su GitHub..."*.
- `saveState`: *"✅ Migrazione completata"*.
- Le righe delle promo nell'admin ora mostrano pill verde **FILE GITHUB** invece di gialla **EMBEDDED LEGACY**.

**Verifica su GitHub:**
- `https://github.com/pezzaliapp/listino-configuratore/tree/main/promo` → vedi N nuovi file binari (nomi tipo `<slug>-<timestamp>.<ext>`).
- Commit history → N commit "Add promo/..." consecutivi.

**Verifica del JSON locale:**
- In IndexedDB, le entry migrate hanno `url:"promo/..."` invece di `url:"data:..."`.

**Pubblicazione:**
- Premi **Pubblica su GitHub** per committare il `promo.json` aggiornato.
- Summary: *"Pubblicato JSON + N file binari (commit separati)"*.

**Verifica utenti:**
- Aspetta 1-3 min, apri la PWA su iPhone, sezione Promo: le promo migrate ora aprono i file via `window.open` (non più il modal). Test 4 si applica anche a queste.

---

## Errori comuni / debug

| Sintomo | Probabile causa | Cosa fare |
|---|---|---|
| Alert "Configura prima GitHub" all'upload | PAT non salvato in IndexedDB | Apri "⚙️ Configurazione GitHub" → incolla PAT → Salva |
| `GitHub API 401: Bad credentials` | PAT scaduto o revocato | Genera nuovo PAT su github.com, sostituisci |
| `GitHub API 403: ...` | PAT senza permesso `Contents: write` | Rigenera PAT con il permesso corretto |
| `GitHub API 422: ...path...` | Filename non valido | Improbabile col timestamp + slug; segnala se succede |
| 404 dal link WhatsApp | Deploy GitHub Pages non ancora finito | Aspetta 1-3 min e riprova |
| 404 dal link WhatsApp dopo 5+ min | DNS / custom domain mal configurato | Verifica `CNAME` e DNS apex `alessandropezzali.it` |
| Modal in-app si apre ancora per promo nuova | La promo ha ancora `url:"data:..."` in IndexedDB (cache) | Premi "Ricarica da GitHub" nell'admin |

---

## Cosa segnalarmi

Per ogni test, segnami:
- ✅ funziona / ❌ non funziona / ⚠️ funziona ma stranamente
- Eventuale screenshot o output console
- iOS / Safari version se rilevante

I test critici, in ordine: **Test 1, Test 2, Test 3, Test 6**. Se quelli passano, il refactor è solido.
