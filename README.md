# Listino Configuratore PWA

App PWA per caricare listini Excel/CSV direttamente dal browser.

## Importante
Il listino non è incluso nella repo e non viene caricato su GitHub.
Ogni utente lo importa dalla app; i dati restano nel browser tramite localStorage.

## Colonne supportate
La app riconosce automaticamente colonne come:
- Codice
- Descrizione
- Prezzo_EUR / Prezzo
- Pagine / Pagina
- Famiglia
- Categoria

## Pubblicazione su GitHub Pages
1. Carica questi file nella repo.
2. Vai su Settings > Pages.
3. Seleziona branch `main` e cartella `/root`.
4. Apri il link GitHub Pages.
5. Carica il file Excel/CSV dalla app.

## Funzioni
- Import Excel/CSV locale
- Salvataggio locale nel browser
- Ricerca per codice/descrizione
- Filtri famiglia/categoria/pagina PDF
- Ordinamento come PDF
- Configuratore preventivo rapido
- Export CSV preventivo
- Copia testo preventivo
- Installabile come PWA
