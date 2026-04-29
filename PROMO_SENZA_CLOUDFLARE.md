# Promo senza Cloudflare

Questa versione non usa Cloudflare e non richiede carta.

## Come aggiungere una promo

1. Vai nella repo GitHub.
2. Apri la cartella `promo/`.
3. Carica il file promo in PDF/JPG/PNG/JPEG.
4. Modifica `promo/promo.json`.

Esempio:

```json
{
  "id": "promo-b300-2026-04",
  "title": "Prevendita esclusiva B 300",
  "description": "Quantità limitate in prevendita.",
  "url": "promo/prevendita-b-300.pdf",
  "expiry": "2026-06-30"
}
```

## Scadenza

Dopo la data `expiry`, la promo non viene più mostrata dalla app.

## Alert nuova promo

Per far comparire l’avviso “È arrivata una nuova promo”, usa sempre un nuovo valore `id`.

## Limiti

Questa versione è gratis e semplice, ma non è riservata: i file promo nella repo pubblica possono essere visualizzati da chi conosce il link.
