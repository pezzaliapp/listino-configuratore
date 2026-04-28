# Configuratore Listino PRO Mobile

Versione ottimizzata per laptop, iPhone e Android.

## Funzioni

- Caricamento locale Excel / CSV.
- Caricamento locale PDF listino.
- Salvataggio dei dati solo nel browser del dispositivo.
- Colonna Pag. visibile anche su smartphone.
- Viewer PDF interno alla app, senza popup Safari.
- Apertura diretta alla pagina PDF indicata dalla riga articolo.
- Preventivo rapido con copia testo, export CSV e invio WhatsApp.

## Nota tecnica

Il PDF non viene caricato su GitHub e non viene inviato a server esterni. Viene salvato in IndexedDB nel browser dell'utente.

Per usare il viewer PDF interno serve aprire la app almeno una volta con connessione internet attiva, perché utilizza PDF.js da CDN. Dopo il primo caricamento, il Service Worker prova a mantenere gli asset in cache.
