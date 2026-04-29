# Admin Promo senza Cloudflare

Questa versione NON scrive direttamente su GitHub, perché una PWA statica non può modificare file della repo da sola.

## Cosa funziona ora

- Import di un nuovo `promo.json`
- Modifica titolo, descrizione, file URL
- Modifica data inizio (`startsAt`)
- Modifica scadenza (`expiresAt`)
- Disattiva/Riattiva promo
- Elimina promo dal JSON
- Salvataggio locale automatico nel browser admin
- Download del nuovo `promo.json`

## Procedura corretta

1. Apri `admin-promo.html`
2. Entra con password `admin`
3. Modifica promo/date oppure importa un JSON nuovo
4. Premi `Scarica promo.json`
5. Vai su GitHub
6. Sostituisci il file:

```text
promo/promo.json
```

7. Attendi la pubblicazione GitHub Pages.
8. Gli utenti vedranno l'aggiornamento riaprendo la PWA o premendo `Aggiorna` nella sezione Promo.

## Formato date

Usare sempre:

```text
YYYY-MM-DD
```

Esempio:

```json
{
  "id": "b300-042026",
  "title": "Prevendita B 300",
  "description": "Promo prevendita esclusiva B 300 - quantità limitate.",
  "url": "promo/prevendita-b300.pdf",
  "type": "pdf",
  "startsAt": "2026-04-29",
  "expiresAt": "2026-06-30",
  "active": true,
  "createdAt": "2026-04-29"
}
```

## Password

La password predefinita è nel file `admin-promo.html`:

```js
const ADMIN_PASSWORD='admin';
```

Puoi cambiarla, ma senza backend non è una protezione reale: serve solo a evitare modifiche accidentali.

## Fix definitivo: Disattiva visibile subito nella app

La pagina principale ora legge prima la bozza locale salvata da Admin Promo (`listino_promo_admin_draft_v2`).

Sul tuo dispositivo:
1. Apri `admin-promo.html`.
2. Premi **Disattiva** o **Elimina dal JSON**.
3. Torna alla app e premi **Aggiorna** nella sezione Promo.
4. La promo sparisce subito.

Per farla sparire anche a tutti gli utenti:
1. In Admin Promo premi **Scarica promo.json**.
2. Sostituisci il file `promo/promo.json` su GitHub.
3. Gli utenti vedranno la modifica riaprendo la PWA o premendo **Aggiorna**.

Se vuoi ignorare la bozza locale e leggere solo GitHub, premi **Cancella bozza locale** in Admin Promo.
