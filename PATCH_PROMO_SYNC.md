# Patch sincronizzazione promo

## Problema trovato
Nel file `index.html`, la funzione `loadPromos()` leggeva prima le bozze admin locali da IndexedDB/localStorage:

- `listino_promo_admin_draft_v3`
- `listino_promo_admin_draft_v2`

Solo se non trovava bozze locali leggeva `promo/promo.json` da GitHub Pages.

Questo causava il comportamento visto: alcuni dispositivi continuavano a mostrare promo vecchie finché non svuotavano cache/dati sito o reinstallavano la PWA.

## Correzioni applicate

1. L'app utente legge sempre il `promo.json` pubblicato.
2. Aggiunto fallback diretto a `raw.githubusercontent.com` se GitHub Pages restituisce 404 o una versione non ancora aggiornata.
3. Aggiunto cache-busting con timestamp e header `no-cache` / `no-store`.
4. Aggiunto refresh automatico ogni 60 secondi.
5. Aggiunto refresh quando l'app torna in primo piano.
6. I link alle promo ora vengono aperti con URL assoluto basato su:
   `https://alessandropezzali.it/listino-configuratore/`

## File modificato

- `index.html`

## Nota importante
Il pannello `admin-promo.html` continua a usare la bozza locale, perché lì serve per lavorare prima della pubblicazione. L'app utente invece non deve mai usare bozze admin locali.
