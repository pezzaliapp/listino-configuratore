# PROMO con file embedded — guida al nuovo flusso

## Cosa cambia

Prima:
1. Carichi PDF/immagine dentro la cartella `promo/` su GitHub
2. Apri `admin-promo.html` e scrivi a mano il path `promo/nomefile.pdf`
3. Scarichi `promo.json` e lo ricarichi su GitHub
4. Se il file fisico manca o ha nome sbagliato, la promo è rotta

Adesso:
1. Apri `admin-promo.html`, premi **Aggiungi riga promo**
2. Scegli direttamente PDF o immagine dal tuo computer (massimo 8 MB per file)
3. Il file viene incorporato nel JSON come base64
4. Scarichi `promo.json` e lo carichi su GitHub (sostituisce `promo/promo.json`)
5. Tutti gli utenti, al refresh dell'app, vedono la nuova promo — senza che tu debba caricare i file PDF/immagine separatamente

Il vecchio formato (URL/path esterno) continua a funzionare: puoi usare entrambi i sistemi nello stesso file `promo.json`.

## Come funziona tecnicamente

### Schema del nuovo `promo.json`

Le promo con file incorporato hanno lo stesso schema di prima, con qualche campo opzionale in più:

```json
[
  {
    "id": "promo-1762345678-ab12c",
    "title": "Prevendita B 300",
    "description": "Promo prevendita esclusiva.",
    "url": "data:application/pdf;base64,JVBERi0xLjQKJ...molto-lungo...",
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
    "id": "vecchia-promo",
    "title": "Promo classica",
    "description": "Esempio con file ancora hostato su GitHub",
    "url": "promo/vecchio-file.pdf",
    "type": "pdf",
    "expiresAt": "2026-12-31",
    "active": true
  }
]
```

Quando `url` inizia con `data:`, è un file incorporato. Altrimenti è un path/URL come prima.

### Storage locale

La bozza dell'admin ora viene salvata in **IndexedDB** (chiave `listino_promo_admin_draft_v3` nel database `listino_pro_db`), perché localStorage ha un limite di ~5 MB che basta a malapena per un singolo PDF in base64.

Per retrocompatibilità l'app legge anche la vecchia chiave `listino_promo_admin_draft_v2` da localStorage e la migra automaticamente la prima volta.

### Limiti pratici

- **Per ogni file**: max 8 MB (l'admin blocca file più grandi)
- **Totale `promo.json`**:
  - Sotto i **10 MB**: nessun problema
  - Tra **10 e 25 MB**: l'app rallenta su mobile, GitHub continua a servirlo ma più lentamente
  - Oltre i **25 MB**: sconsigliato. Il fetch può fallire su connessioni lente. Service worker e cache offline gestiscono male file così grandi
  - **Oltre i 100 MB**: limite massimo di un file su GitHub. Stop.

L'admin mostra una barra colorata con l'occupazione corrente.

### Ottimizzare i PDF

Se i PDF originali sono grandi, prima di incorporarli conviene comprimerli:
- Su Mac: Anteprima → Esporta → Filtro Quartz "Reduce File Size" (oppure `ghostscript`)
- Su Windows / Linux: `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=out.pdf in.pdf`
- Online: SmallPDF, ILovePDF (attenzione alla privacy del contenuto)

Per le immagini: usa JPEG o WebP a qualità 80, max 1600 px sul lato lungo.

## Modifiche fatte ai file

### `admin-promo.html` (riscritto)

- Input `<input type="file">` per ogni riga con drag & drop
- Bottone "Rimuovi file" sulle promo già con file incorporato
- Indicatore di dimensione totale del JSON con barra colorata
- Persistenza spostata da localStorage a IndexedDB (riusa il DB esistente `listino_pro_db`, store `files`)
- Migrazione automatica dalla vecchia chiave localStorage v2

### `index.html` (modifiche minime)

Modificate solo 2 funzioni esistenti:

- `promoWhatsAppText(p)` — quando l'URL è un data URI, non lo include nel messaggio WhatsApp (sarebbe lungo MB e impossibile da incollare). Mette invece il link all'app, lasciando intatto il flusso per le promo URL/path.
- `loadPromos()` — ora controlla anche IndexedDB (chiave `listino_promo_admin_draft_v3`) prima di fare fetch su `promo/promo.json`. Continua a leggere la vecchia chiave localStorage v2 per retrocompatibilità.

Il rendering della promo card non è cambiato: `<a href="..." target="_blank">` con un data URI viene aperto nativamente dal browser (sia per PDF che per immagini).

## Cosa fare con la cartella `promo/` su GitHub

Le vecchie promo che usano path tipo `promo/file.pdf` continuano a funzionare se il file fisico è ancora lì. Quando le sostituisci con la versione embedded, puoi cancellare i PDF/immagini dalla cartella per pulire la repo (lascia solo `promo.json`).

## Workflow consigliato

1. Apri **Admin Promo**
2. Scarica la versione attuale da GitHub (bottone "Ricarica da GitHub")
3. Per ogni vecchia promo: clicca "Carica un file PDF o un'immagine" e seleziona il file dal tuo computer; il path esterno viene sostituito dal data URI
4. Aggiungi nuove promo come vuoi
5. Premi "Scarica promo.json"
6. Su GitHub, sostituisci il file `promo/promo.json` con quello scaricato
7. Fine — gli utenti vedono tutto al refresh

A questo punto, se vuoi, puoi anche rimuovere da GitHub i PDF/immagini ormai inutilizzati nella cartella `promo/`.
