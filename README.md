# Configuratore Listino PRO

PWA statica per gestire un listino prodotti tecnici con sezione "Promo" amministrabile da pannello dedicato. Tutto vive su GitHub Pages, niente backend.

- **App utente:** [`index.html`](./index.html) — carica un Excel/CSV come listino, mostra promo attive, viewer PDF interno, preventivo rapido con WhatsApp.
- **Pannello admin:** [`admin-promo.html`](./admin-promo.html) — CRUD promo, upload file (PDF / immagini), pubblicazione automatica su GitHub via API.
- **Service worker:** [`sw.js`](./sw.js) — cache offline.

## Caratteristiche utente

- **Laptop/Desktop:** caricamento PDF locale e link cliccabile alla pagina del PDF.
- **Smartphone:** PDF nascosto/disattivato per evitare problemi noti iPhone/Android.
- Quantità modificabile prima dell'inserimento articoli.
- Preventivo rapido: più articoli, copia testo, invio WhatsApp, export CSV.
- I file Excel/CSV e il PDF restano sul dispositivo: **non vengono inviati a server**.

## Pannello admin: come funziona

Il pannello è **pubblicamente accessibile** (`/admin-promo.html`). La protezione effettiva è il **Personal Access Token GitHub**, salvato solo sul dispositivo dell'admin (in IndexedDB). Senza il token, nessuno può pubblicare. Se il dispositivo viene compromesso, **revoca subito il token su GitHub**.

### Setup token (1 minuto)

1. Vai su [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) (devi essere loggato).
2. **Token name:** es. `listino-configuratore-admin`.
3. **Expiration:** 90 giorni (rinnovabile).
4. **Repository access:** _Only select repositories_ → scegli solo `listino-configuratore`.
5. **Permissions → Repository permissions:** trova **Contents** → _Read and write_.
6. Premi **Generate token**, copia il token (`github_pat_...`) e incollalo nel pannello admin → "Configurazione GitHub" → Salva → Test connessione.

### Workflow tipico

1. Apri `admin-promo.html`.
2. Premi **Aggiungi riga promo**.
3. Scegli un PDF o un'immagine dal computer (max **8 MB** per file).
4. Compila titolo, descrizione, data inizio (`startsAt`) e scadenza (`expiresAt`).
5. Premi **Pubblica su GitHub**. Viene fatto un commit di `promo/promo.json` con il file incorporato come base64.
6. Gli utenti vedranno la promo entro 1-3 minuti (tempo di deploy GitHub Pages).

Prima di ogni publish viene salvato un **backup automatico** della bozza in IndexedDB (chiave `listino_promo_admin_backup_*`, ultimi 5 conservati). In caso di conflitto (`409` da GitHub) il backup ti permette di non perdere il lavoro.

## Schema di `promo.json`

Le promo possono avere il file **incorporato** (data URI) o **referenziato** (path/URL). Entrambi i formati funzionano nello stesso JSON.

```json
[
  {
    "id": "promo-1762345678-ab12c",
    "title": "Prevendita B 300",
    "description": "Promo prevendita esclusiva.",
    "url": "data:application/pdf;base64,JVBERi0xLjQK...",
    "type": "pdf",
    "fileName": "prevendita-b300.pdf",
    "fileMime": "application/pdf",
    "fileSize": 2415000,
    "startsAt": "2026-04-29",
    "expiresAt": "2026-06-30",
    "active": true,
    "createdAt": "2026-04-29"
  },
  {
    "id": "promo-classica",
    "title": "Promo classica",
    "description": "Esempio con file ancora hostato su GitHub.",
    "url": "promo/vecchio-file.pdf",
    "type": "pdf",
    "expiresAt": "2026-12-31",
    "active": true
  }
]
```

Quando `url` inizia con `data:`, è incorporato. Altrimenti è un path/URL come prima.

### Date

Formato sempre `YYYY-MM-DD`. `startsAt` opzionale (se assente, la promo è attiva da subito). `expiresAt` opzionale (se assente, mai scade — sconsigliato).

### Tipi MIME ammessi nell'upload

`application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Niente SVG (può contenere script). Niente generico `image/*`.

## Limiti pratici

| Dimensione `promo.json` | Comportamento |
|---|---|
| Sotto i **10 MB** | Tutto fluido. |
| Tra **10 e 25 MB** | Su mobile inizia a rallentare il caricamento promo. |
| Oltre **25 MB** | Sconsigliato. Fetch può fallire su connessioni lente. |
| Oltre **100 MB** | Limite massimo file su GitHub. Stop. |

L'admin mostra una barra colorata con l'occupazione corrente.

A regime, oltre ~10-20 promo embedded conviene passare a uploadare i file binari direttamente nella cartella `promo/` (vedi sezione "Sviluppi futuri").

### Comprimere i PDF prima di caricarli

- **Mac:** Anteprima → Esporta → Filtro Quartz "Reduce File Size".
- **Windows/Linux:** `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=out.pdf in.pdf`.
- **Online:** SmallPDF, ILovePDF (occhio alla privacy del contenuto).

Per le immagini: JPEG o WebP qualità 80, max 1600 px sul lato lungo.

## Storage locale

| Chiave | Storage | Cosa contiene |
|---|---|---|
| `listino_configuratore_rows_PRO` | localStorage | Listino caricato dall'utente |
| `listino_configuratore_quote_PRO` | localStorage | Preventivo in corso |
| `listino_configuratore_legal_ok` | localStorage | Conferma presa visione |
| `listino_promo_seen_ids` | localStorage | ID promo già visti (per badge "NUOVA") |
| `listino_pdf` | IndexedDB (`listino_pro_db` / `files`) | PDF del listino |
| `listino_promo_admin_draft_v3` | IndexedDB | Bozza admin |
| `listino_promo_admin_gh_config_v1` | IndexedDB | Config GitHub (incluso PAT) |
| `listino_promo_admin_gh_sha_v1` | IndexedDB | sha del `promo.json` remoto |
| `listino_promo_admin_backup_<ISO>` | IndexedDB | Backup bozze pre-publish (ultimi 5) |

### Su iPhone

**Aggiungi l'app alla schermata Home** per evitare che iOS evicti i dati dopo 7 giorni di inattività ("Intelligent Tracking Prevention"). Nota: "Cancella cronologia e dati siti web" elimina anche i dati della PWA installata (incluso il PAT). Se serve, esporta `promo.json` come backup prima di pulire.

## Sicurezza

- Tutti i file caricati **restano nel browser**, non vengono inviati a server di Anthropic, Google, ecc.
- Il PAT GitHub è salvato in IndexedDB **in chiaro** (limite di una PWA senza backend). Per ridurre il rischio:
  - Usa un PAT **fine-grained**, scope `Contents: read+write`, su una sola repo.
  - Scadenza max 90 giorni.
  - Rigenera se il device è perso/compromesso.
  - Il pannello admin avvisa quando il token è salvato da > 60 giorni.
- Gli script CDN (xlsx, pdf.js) hanno **Subresource Integrity** (`integrity="sha384-..."`): se jsdelivr venisse compromesso, il browser rifiuta lo script.
- È applicata una **Content-Security-Policy** che limita le origini di script, fetch, immagini.

Per dettagli, audit completo e test: vedi `AUDIT.md` e `TEST_IOS.md`.

## Sviluppi futuri (non implementati)

- **Upload binari diretto su `promo/`** via Contents API: invece di incorporare i file come base64 in `promo.json`, l'admin uploada il binario direttamente nella cartella `promo/`. Stesso PAT, JSON piccolo, fetch HTTP normale per i file. Risolve il problema di scaling oltre le 10-20 promo. Tracciato in `AUDIT.md` §3 (item A1).
- **Auto-merge bozza vs remoto** in caso di conflitto multi-admin (`AUDIT.md` MA1 livello 2).
- **Toast UX** invece di `alert()`/`confirm()` (`AUDIT.md` A3).

## Struttura repo

```
.
├── index.html               # app utente
├── admin-promo.html         # pannello admin
├── sw.js                    # service worker
├── manifest.webmanifest     # manifest PWA
├── icon.svg                 # icona
├── promo/
│   ├── promo.json           # canonical: lista promo
│   └── *.pdf, *.png, ...    # file vecchio formato (referenziati via path)
├── README.md                # questo file
├── AUDIT.md                 # audit di sicurezza/iOS/architettura
└── TEST_IOS.md              # protocollo test iPhone (opzionale)
```
