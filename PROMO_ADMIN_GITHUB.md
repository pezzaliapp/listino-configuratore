# Gestione Promo senza Cloudflare

## Come cambiare data validità o cancellare una promo dalle app

1. Apri `admin-promo.html` dalla app.
2. Inserisci password: `admin`.
3. Modifica la data, oppure premi **Disattiva** o **Elimina dal JSON**.
4. Premi **Scarica promo.json**.
5. Vai su GitHub nella cartella `promo/`.
6. Sostituisci il file `promo.json` con quello scaricato.
7. Attendi GitHub Pages, normalmente 30-90 secondi.
8. Gli utenti riaprono la app o premono **Aggiorna** nella sezione Promo.

## Nota importante

Senza Cloudflare/backend la app non può scrivere direttamente su GitHub. Questa è la versione a costo zero e senza carta: genera il file aggiornato, poi lo carichi tu su GitHub.

## Per rimuovere del tutto un file

Se vuoi cancellare anche il PDF/JPG fisico, eliminalo dalla cartella `promo/` su GitHub.
