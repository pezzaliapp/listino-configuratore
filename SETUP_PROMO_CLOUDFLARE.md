# Setup Promo Cloud - Listino PRO

Questa versione aggiunge alla PWA una sezione **Promo** con:

- caricamento promo PDF/JPG/PNG/JPEG tramite password admin;
- data di scadenza;
- elenco promo attive;
- alert automatico nella PWA quando arriva una nuova promo;
- file promo salvati su Cloudflare R2, non su GitHub.

## 1. Cosa resta su GitHub

Su GitHub resta solo la PWA:

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `icon.svg`

Le promo non vengono caricate nella repository.

## 2. Cosa serve su Cloudflare

Serve un Worker con:

- un bucket R2 chiamato, ad esempio: `listino-pro-promo`
- un namespace KV per salvare i metadati delle promo
- una password admin salvata come secret `ADMIN_PASSWORD`

## 3. Creazione risorse Cloudflare

Da terminale, dentro la cartella `cloudflare-worker`:

```bash
npm install -g wrangler
wrangler login
wrangler r2 bucket create listino-pro-promo
wrangler kv namespace create PROMO_KV
```

Copia l'id del namespace KV dentro `wrangler.toml`, partendo da `wrangler.toml.example`.

Poi imposta la password admin:

```bash
wrangler secret put ADMIN_PASSWORD
```

Infine pubblica:

```bash
wrangler deploy
```

Cloudflare ti restituirà un URL simile a:

```text
https://listino-pro-promo.nomeutente.workers.dev
```

## 4. Collegare la PWA al Worker

Apri la PWA.

Vai nella sezione **Promo** → **Admin**.

Inserisci:

- URL API Cloudflare Worker
- password admin

Premi **Salva**.

Da quel momento puoi caricare promo direttamente dalla app.

## 5. Come funziona la scadenza

La PWA mostra solo promo non scadute.

Il Worker blocca anche il link file se la promo è scaduta.

Nota pratica: se un utente ha già scaricato o salvato una copia del PDF sul proprio telefono, quella copia locale non può essere cancellata da remoto. La scadenza impedisce la visualizzazione/lettura tramite app e link ufficiale.

## 6. Formati supportati

- PDF
- PNG
- JPG/JPEG

## 7. Esempio di promo

Titolo:

```text
Prevendita esclusiva B 300
```

Descrizione:

```text
Quantità limitate in prevendita. Cod. 01101027 - B 300.
```

Data scadenza:

```text
2026-06-30
```
