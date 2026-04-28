# Configuratore Listino PRO

PWA per caricare un listino Excel/CSV e creare preventivi rapidi.

## Versione aggiornata

- Caricamento Excel/CSV locale nel browser.
- Caricamento PDF listino locale nel browser tramite IndexedDB.
- I numeri nella colonna **Pag.** diventano cliccabili.
- Cliccando su una pagina viene aperto il PDF in una nuova finestra con `#page=NUMERO`.
- Nessun file viene pubblicato su GitHub o inviato a server esterni.

## Nota

Su Chrome/Edge desktop il posizionamento sulla pagina PDF funziona normalmente. Su Safari/iPhone il visualizzatore PDF interno può ignorare il parametro `#page`.
