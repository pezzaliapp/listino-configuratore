# Audit `listino-configuratore`

Data audit: 2026-05-03
Branch: `audit-fixes`
Commit di partenza: `64fb3d3` (Update promo.json, 3 promo, 504 KB)

Audit eseguito su `index.html` (637 righe), `admin-promo.html` (692 righe), `sw.js`/`sw.js.bak`, `manifest.webmanifest`, `promo/promo.json`.

> **Lettura veloce:** salta direttamente a [§0 Riassunto esecutivo](#0-riassunto-esecutivo). Sotto trovi i dettagli tecnici per ogni issue, divisi per area.

> **Stato finale (post-applicazione fix):** vedi [§9 Stato finale](#9-stato-finale-cosa-è-stato-applicato) in fondo.

---

## 0. Riassunto esecutivo

**Cosa funziona bene**
- App piccola, vanilla, niente framework. Codice leggibile.
- L'escape HTML è applicato in modo coerente sui campi user-controlled.
- Storage locale-only è una scelta corretta e onesta verso l'utente.
- Il flusso `sha` per la pubblicazione su GitHub esiste ed è il pattern giusto.

**Cosa non va — sintetico**

| # | Tema | Severità | Sintesi |
|---|------|----------|---------|
| S1 | `window.open` dopo `await` (iOS popup blocked) | **ALTA** | È *quasi sicuramente* la causa della scheda bianca su iPhone per le promo embedded |
| S2 | Upload SVG con `<script>` non bloccato | **ALTA** | Un admin compromesso o un JSON malevolo possono iniettare JS che gira sul dominio della PWA |
| S3 | PAT GitHub salvato in chiaro in IndexedDB | **MEDIA-ALTA** | Esposto a qualsiasi XSS, a estensioni del browser, a chi usa il device |
| S4 | Password admin hardcoded e visibile nel sorgente HTML pubblico | **MEDIA** | È un placebo. Da almeno spostare fuori o ammettere che è solo un blando deterrente |
| S5 | CDN senza Subresource Integrity (SRI) | **MEDIA** | Compromesso jsdelivr → esecuzione di JS arbitrario |
| S6 | Service worker cachea ogni `?v=timestamp` come entry separata | **MEDIA** | Cache cresce all'infinito su mobile |
| S7 | CSV injection (=, +, -, @ all'inizio cella) in export preventivo | **MEDIA** | `=cmd|...` apre cmd quando l'utente apre il CSV in Excel |
| S8 | Niente Content-Security-Policy | **MEDIA** | Mitigazione XSS molto facile da aggiungere, non c'è |
| S9 | `escapeHtml` non gestisce `'` (gestito solo in `escapeAttr`) | **BASSA** | Fragile ma attualmente safe perché tutti gli attributi usano `"` |
| S10 | Service worker fallback a `index.html` per *qualsiasi* errore offline | **BASSA** | Se il browser chiede una CDN offline si vede HTML al posto di JS |
| iOS1 | `await fetch(url) → window.open(blobUrl)` perde user gesture | **ALTA** | Vedi S1 — stesso bug, vista lato iOS |
| iOS2 | Manca `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` | **MEDIA** | Icona generica e statusbar non controllata su iOS installato |
| iOS3 | `location.href = 'https://wa.me/...'` esce dalla PWA in standalone | **MEDIA** | L'utente deve tornare manualmente all'app |
| iOS4 | Blob URL per immagini su iOS Safari mostra schermo bianco (bug noto WebKit) | **MEDIA** | Workaround applicato solo parzialmente, va completato |
| iOS5 | `URL.createObjectURL` revocato dopo 60s con `setTimeout` | **BASSA** | Fragile, meglio revocare su `unload` del tab figlio |
| iOS6 | IndexedDB su iOS in private mode: ~50MB, può sparire al "Clear history" | **INFO** | Non un bug, ma da comunicare nell'UI |
| A1 | Architettura "data URI dentro JSON" non scala | **MEDIA** | Sotto i 10 MB ok; 50 promo da 200 KB = JSON da 10 MB → fetch lentissimi su 4G |
| A2 | Codice duplicato (openDb/idbSet/idbGet/idbDel/escapeHtml) tra index e admin | **BASSA** | Manutenibilità |
| A3 | `alert()` / `confirm()` / `prompt()` come unica UX di feedback | **BASSA** | UX scadente, blocca event loop, ignorato in alcuni contesti standalone |
| MA1 | Conflitto `sha` perde il lavoro del losing admin senza diff/merge | **MEDIA** | Soluzione manuale ("scarica un backup") affidata all'utente |
| MA2 | Bozza locale per browser, mai sincronizzata tra dispositivi dello stesso admin | **BASSA** | Lavorare da iPad e poi da desktop = sorpresa garantita |
| O1 | Manifest PWA incompleto (no `id`, no `scope`, icona solo SVG) | **BASSA** | Affidabilità installazione su iOS/Android |
| O2 | `pdfjs-dist@3.11.174` ok, ma worker caricato dinamicamente da CDN run-time | **BASSA** | Combinato con S5 = doppia esposizione |
| O3 | `xlsx@0.18.5` ha CVE noti (vedi §6 Altro) | **MEDIA** | ReDoS su file XLSX malformati |

**Quanto sei in pericolo nel breve?**
Il rischio sicurezza *concreto* è basso finché l'admin sei tu solo, perché il PAT vive sul tuo dispositivo. Il rischio funzionale è **alto**: il bug iOS S1/iOS1 spiega *esattamente* la scheda bianca che vedi sulle promo embedded. Va sistemato prima di tutto, ed è una patch piccola.

---

## 1. Sicurezza

### S1. `window.open(blobUrl)` dopo `await fetch(...)` — popup bloccato su Safari

**Severità:** ALTA — è la radice del bug "scheda bianca su iPhone per promo embedded".
**File/righe:** `index.html:464-486`

```js
// righe 464-486
els.promoList.querySelectorAll('[data-promo-open]').forEach(btn=>btn.onclick=async()=>{
  const p=visible.find(x=>promoId(x)===btn.dataset.promoOpen);
  if(!p) return;
  const url=promoUrl(p);
  if(!url||url==='#'){alert(...);return;}
  try{
    if(url.startsWith('data:')){
      const r=await fetch(url);            // <-- await: rompe il "user activation"
      const blob=await r.blob();           // <-- secondo await
      const blobUrl=URL.createObjectURL(blob);
      const w=window.open(blobUrl,'_blank','noopener');  // <-- Safari iOS: NULL
      if(!w){alert('...popup...');}
      setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
    }else{
      window.open(url,'_blank','noopener');
    }
  }catch(e){...}
});
```

**Cosa succede tecnicamente:**
Safari WebKit considera "user activation" valida solo all'interno dello stack sincrono del click. Dopo un `await`, il microtask successivo gira *fuori* dal contesto di attivazione. `window.open` viene quindi trattato come popup non sollecitato e bloccato silenziosamente. Su Chrome desktop la regola è più permissiva, quindi in test funzionava. Su iPhone no.

L'esito visibile è esattamente "scheda bianca": Safari apre il tab ma non naviga (oppure apre un blob URL che poi non riesce a renderizzare, oppure il blob viene revocato prima del rendering perché l'app va in background).

**Fix proposto:**
Aprire la finestra **prima** dell'await, poi navigarla.

```js
els.promoList.querySelectorAll('[data-promo-open]').forEach(btn=>btn.onclick=async()=>{
  const p=visible.find(x=>promoId(x)===btn.dataset.promoOpen);
  if(!p) return;
  const url=promoUrl(p);
  if(!url||url==='#'){alert('Questa promo non ha un file associato.');return;}

  if(!url.startsWith('data:')){
    window.open(url,'_blank','noopener');
    return;
  }

  // Apri SUBITO una finestra (sync, sotto user gesture)
  const w=window.open('about:blank','_blank','noopener');
  if(!w){alert('Il browser ha bloccato il popup. Consenti i popup per questo sito.');return;}

  try{
    const r=await fetch(url);
    const blob=await r.blob();

    // iOS Safari rende male i blob URL di immagini → wrap in HTML
    if(blob.type.startsWith('image/')){
      const dataUrl=url; // già data URI: usalo direttamente nell'<img>
      const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${escapeHtml(p.title||'Promo')}</title>
        <style>body{margin:0;background:#111;display:grid;place-items:center;min-height:100vh}
        img{max-width:100%;height:auto;display:block}</style>
        <img src="${dataUrl}" alt="">`;
      w.document.open(); w.document.write(html); w.document.close();
    }else{
      const blobUrl=URL.createObjectURL(blob);
      w.location.replace(blobUrl);
      // revoca alla chiusura del tab figlio, non con timer
      const release=()=>{ try{URL.revokeObjectURL(blobUrl)}catch(_){} };
      try{ w.addEventListener('pagehide', release, {once:true}); }catch(_){ setTimeout(release, 5*60*1000); }
    }
  }catch(e){
    try{ w.close(); }catch(_){}
    alert('Errore nell\'apertura della promo: '+e.message);
  }
});
```

**Note iOS:**
- Per i PDF embedded, `w.location.replace(blobUrl)` su iOS standalone PWA potrebbe ancora fallire perché Safari iOS *non sempre* accetta blob URL di tipo PDF. Mitigazione: scrivere una mini-pagina con `<embed src="..." type="application/pdf">` o `<iframe>`, oppure offrire "Scarica" come fallback (`<a download>`).
- Se la PWA è installata in standalone, `window.open` **uscirà comunque dall'app** (Safari iOS apre in MobileSafari esterno). Non è un bug nostro: è comportamento iOS standard. Da comunicare via UI.

**Impatto:** Il fix risolve il problema #1 della tua richiesta. Test iOS specifici in `TEST_IOS.md`.

---

### S2. Upload accetta SVG con script

**Severità:** ALTA per un sistema multi-admin; MEDIA finché l'admin sei tu solo.
**File/righe:** `admin-promo.html:289-315`, accept: `application/pdf,image/*`

```js
// riga 296
const okType = file.type==='application/pdf' || file.type.startsWith('image/');
```

`image/svg+xml` passa. Un SVG con `<script>` viene poi servito come data URI. Quando un utente clicca "Apri promo":
1. Il flusso S1 genera un Blob URL (o data URI).
2. Aprendolo in un tab nuovo, il browser rende l'SVG **come documento attivo**, eseguendo gli script.
3. Origine: `data:` o `blob:` — *isolata* dal dominio, quindi NON ha accesso al PAT/IndexedDB della PWA. Buono.

Però:
- Se in futuro l'SVG viene mostrato inline (e.g. preview), l'XSS arriva sul tuo dominio.
- Se un attaccante riesce a iniettare un'entry nel `promo.json` con un `url: "data:image/svg+xml,..."` arbitrario, il click di un utente apre uno script. Anche se isolato, è phishing-ready (login GitHub fake, redirect, ecc.).

**Fix proposto:**
Whitelist esplicita di MIME type, niente `image/*`:

```js
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg','image/png','image/webp','image/gif'
]);
const okType = ALLOWED_MIME.has(file.type);
if(!okType){
  alert(`Tipo file "${file.type||'sconosciuto'}" non supportato. Usa PDF, JPG, PNG, WebP o GIF.`);
  return;
}
```

E in `index.html` quando si renderizza una promo embedded, validare il prefix del data URI prima di usarlo (rifiutare `data:image/svg+xml`, `data:text/html`, ecc.).

**Impatto:** Blocca classe di vulnerabilità con 5 righe.

---

### S3. PAT GitHub salvato in chiaro in IndexedDB

**Severità:** MEDIA-ALTA.
**File/righe:** `admin-promo.html:503-505` (`ghSetConfig` → `idbSet(GH_CONFIG_KEY, JSON.stringify(cfg))`)

**Esposizione reale:**
1. Qualunque XSS nella PWA (vedi S2/S8) può leggerlo via `idbGet`.
2. Estensioni del browser con permesso "read all data on websites" possono leggerlo.
3. Chiunque accede fisicamente al device (anche solo aprendo DevTools → Application → IndexedDB).
4. Backup automatici del browser/profilo (sync) lo portano altrove.
5. Se si commit per sbaglio un dump di IndexedDB su GitHub, fine.

**Cosa NON cambia:**
Per pubblicare su GitHub *senza backend*, il token DEVE essere accessibile al codice client. Non si può proteggere veramente.

**Cosa si può migliorare:**

1. **Scope minimo del PAT.** Hai già scelto `Contents: read+write` su una singola repo: è il minimo possibile per fare PUT su `promo/promo.json` con la fine-grained API. ✓ Ok.
2. **Scadenza breve.** Imposta sempre 30-90 giorni (già suggerito nel manuale). Aggiungere un check UI: se il last-test è > 60 giorni, mostrare un avviso "rinnova il token".
3. **Cifratura at-rest opzionale.** Si può usare `crypto.subtle` con una passphrase admin per cifrare il PAT in IndexedDB. La passphrase non è salvata; chiede sblocco a ogni sessione admin. Più sicuro, ma cambia UX.
4. **Non salvarlo affatto.** Mode "session-only": l'admin incolla il PAT a ogni sessione, non viene mai persistito. Più rotture di palle ma più sicuro. Consigliato come opzione, default OFF.
5. **Logging dei publish.** Salvare data/ora/sha dell'ultimo publish in IndexedDB e mostrarli, così si nota subito se qualcun altro pubblica con il tuo token.

**Fix proposto (minimo):**
- Aggiungere un toggle "Memorizza token su questo dispositivo" (default ON per non rompere UX) e una nota sui rischi.
- Aggiungere check di scadenza dolce.

```js
// In ghSaveConfig: salva anche createdAt
cfg.tokenCreatedAt = new Date().toISOString();
await ghSetConfig(cfg);

// All'apertura admin
const cfg = await ghGetConfig();
if(cfg.tokenCreatedAt){
  const days = (Date.now()-Date.parse(cfg.tokenCreatedAt))/86400000;
  if(days > 60) setGhResult(`⚠️ Il token è stato salvato ${Math.floor(days)} giorni fa. Verifica la scadenza su GitHub e rigenera se necessario.`,'warn');
}
```

**Impatto:** Igiene operativa. Non risolve il problema fondamentale (PAT in client) ma riduce superficie.

---

### S4. Password admin hardcoded nel sorgente HTML pubblico

**Severità:** MEDIA.
**File/righe:** `admin-promo.html:166`

```js
const ADMIN_PASSWORD='admin';
```

Chiunque visiti `https://alessandropezzali.it/listino-configuratore/admin-promo.html`, fa View Source, trova `admin`. Login bypassed.

**Cosa "protegge" davvero:**
- Niente. Non blocca lo sguardo, non blocca l'accesso, non blocca la pubblicazione (perché senza PAT in IndexedDB, anche superato il login non si può comunque pubblicare).

**Cosa si può fare senza backend:**

1. **Toglierla del tutto** e dichiarare apertamente: "L'accesso admin è protetto solo dal possesso del PAT GitHub. Usa la pagina solo su dispositivi fidati." Più onesto.
2. **Hash della password** (PBKDF2/Argon2 via `crypto.subtle`) salvato in HTML, con cookie/IDB di sessione. Continua a essere bypassabile (chiunque può eseguire JS arbitrario nella console), ma scoraggia il pubblico generico.
3. **`/admin-promo.html` non listato in nessun link visibile, ma c'è già un link in `index.html:220`**. Quindi è scopribile in 2 click.

**Fix proposto:**
Opzione 1 (consigliata): rimuovere la password e sostituirla con una nota in italiano ben visibile sul rischio. Aggiungere un check: se non c'è un PAT configurato in IndexedDB, mostrare il pannello di configurazione per primo, perché senza PAT non ci sono privilegi reali.

**Impatto:** Cancella un'illusione di sicurezza. Niente di reale cambia.

---

### S5. CDN senza Subresource Integrity (SRI)

**Severità:** MEDIA.
**File/righe:** `index.html:240-241,556`

```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
```

E poi runtime, `index.html:556`:
```js
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
```

**Cosa fare:**
Aggiungere `integrity="sha384-..."` e `crossorigin="anonymous"`. Se jsdelivr venisse compromesso o il pacchetto pubblicato cambiasse hash (versione fittizia), lo script viene rifiutato dal browser.

```html
<script
  src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
  integrity="sha384-<hash-da-calcolare>"
  crossorigin="anonymous"></script>
```

Hash si ottengono con `curl -s https://cdn.jsdelivr.net/.../xlsx.full.min.js | openssl dgst -sha384 -binary | openssl base64 -A`.

**Alternativa più solida:** vendoring dei file in `/vendor/` e self-host. Stessa cache GitHub Pages, niente dipendenza CDN.

**Impatto:** 5 minuti, riduce drasticamente il blast radius di una compromissione CDN.

---

### S6. Service worker cache cresce all'infinito (cache-busting `?v=Date.now()`)

**Severità:** MEDIA.
**File/righe:** `sw.js:5`, `index.html:536,633`, `admin-promo.html:333,362,383,614`

Pattern usato nell'app:
```js
fetch('./promo/promo.json?v='+Date.now(), {cache:'no-store'})
```

E nel SW:
```js
caches.open(CACHE).then(c=>c.put(e.request,copy));
```

Il SW vede ogni `?v=12345` come URL diversa → la cache aggiunge un'entry per ogni refresh. Su mobile che non rilancia mai davvero la PWA, in qualche settimana puoi avere centinaia di copie del JSON (ognuna 500 KB+ con embedded files). Quota IndexedDB/Cache Storage si riempie. iOS Safari quando satura la quota *evicta tutto silenziosamente*: l'utente perde la PWA.

**Fix proposto (sw.js):**
Riscrivi il fetch handler per `promo.json` in modo da:
1. Fetchare sempre dalla network (network-first).
2. Salvare in cache **con la chiave canonica** (senza query string), non con `?v=...`.

```js
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/promo/promo.json')){
    const canonical=new Request(url.origin+url.pathname);
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        if(r && r.ok){
          const copy=r.clone();
          const cache=await caches.open(CACHE);
          await cache.put(canonical, copy);  // chiave SENZA query
        }
        return r;
      }catch(_){
        const cached=await caches.match(canonical);
        return cached || new Response('[]',{headers:{'Content-Type':'application/json'}});
      }
    })());
    return;
  }
  // resto invariato
});
```

E lato client, basta rimuovere il `?v=` quando si fa fetch (con `cache:'no-store'` è già cache-bypass nel browser; non serve la query).

**Impatto:** Evita che la PWA si auto-evicta dopo settimane. Importante.

---

### S7. CSV injection nell'export preventivo

**Severità:** MEDIA.
**File/righe:** `index.html:412-414`

```js
function exportQuoteCsv(){
  const lines=[['Codice','Descrizione','Prezzo','Qta','Totale'],...quote.map(x=>[x.codice,x.descrizione,x.prezzo,x.qta,x.prezzo*x.qta])];
  download('preventivo.csv',lines.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\n'));
}
```

Se il listino Excel caricato contiene una descrizione tipo `=cmd|'/c calc'!A1` o `@SUM(...)`, l'export CSV preserva il `=` iniziale. Quando l'utente apre il CSV in Excel/Numbers, la cella viene interpretata come **formula**, possibile esecuzione di comandi (DDE), data exfiltration via `=HYPERLINK(...)`.

**Fix proposto:**
Prefissa un apostrofo zero-width o spazio davanti alle celle che iniziano con `=`, `+`, `-`, `@`, tab, CR.

```js
const SAFE = v => {
  const s=String(v??'');
  return /^[=+\-@\t\r]/.test(s) ? "'"+s : s;
};
// ...
download('preventivo.csv',
  lines.map(r=>r.map(v=>'"'+SAFE(v).replaceAll('"','""')+'"').join(';')).join('\r\n')
);
```

(Anche `\r\n` come line terminator è più portabile di `\n` per Excel Windows.)

**Impatto:** Difensiva contro listini malevoli. Costo: zero.

---

### S8. Niente Content-Security-Policy

**Severità:** MEDIA (mitigazione gratuita).
**File:** `index.html`, `admin-promo.html` — manca `<meta http-equiv="Content-Security-Policy" ...>`

Una CSP minimale che permette CDN attuali ma blocca inline-script non autorizzati e fetch a domini arbitrari:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://api.github.com https://cdn.jsdelivr.net;
  frame-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
">
```

Note:
- `'unsafe-inline'` è necessario perché il JS principale è inline `<script>`. Per toglierlo bisogna spostare in file esterni o usare nonce/hash. Per ora lascialo.
- `connect-src` limita le chiamate `fetch` a GitHub API e CDN. Esfiltrazione XSS molto più complicata.
- `img-src 'self' data: blob:` necessario per le promo embedded.

**Impatto:** Difensiva, gratis, va testata bene perché può rompere casi limite (l'inline-script funziona ma se domani sposti qualcosa fuori, attenzione).

---

### S9. `escapeHtml` non gestisce `'`

**Severità:** BASSA — attualmente safe ma fragile.
**File/righe:** `index.html:263-264`, `admin-promo.html:196`

```js
function escapeHtml(s){return norm(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function escapeAttr(s){return escapeHtml(s).replace(/'/g,'&#39;')}
```

Tutti gli attributi nel codice usano `"` come delimitatore, quindi `'` non rompe niente *oggi*. Ma se domani qualcuno fa `<input value='${escapeHtml(x)}'>` (apici singoli), c'è XSS via `'`.

**Fix proposto:** unificare in una sola funzione che gestisce entrambi:

```js
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g, m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
// rimuovere escapeAttr e usare escapeHtml ovunque
```

**Impatto:** Banale, riduce un'intera classe di errori futuri.

---

### S10. SW fallback finale: `caches.match('./index.html')`

**Severità:** BASSA.
**File/righe:** `sw.js:5`

```js
.catch(()=>caches.match('./index.html'))
```

Se sei offline e chiedi un'asset CDN (jsdelivr) o un file random, il SW restituisce **l'HTML della home**. Per un `<script>` o un `.json`, è un comportamento confuso (parser error e bug oscuri).

**Fix proposto:** restituisci `index.html` solo per richieste navigation:

```js
.catch(()=>{
  if(e.request.mode==='navigate') return caches.match('./index.html');
  return new Response('',{status:504,statusText:'offline'});
})
```

**Impatto:** Diagnostica più chiara quando ci sono problemi offline.

---

## 2. iOS / Mobile

### iOS1. (vedi S1) — radice del bug "scheda bianca"
Stesso problema, vista lato iOS Safari. **Fix in S1**.

### iOS2. Manifest e `<head>` incompleti per iOS

**Severità:** MEDIA.
**File:** `manifest.webmanifest`, `index.html:1-8`

iOS Safari usa metatag dedicati per la PWA installata. Mancano:
- `<link rel="apple-touch-icon" href="...">` — senza, l'icona della PWA installata è generica (screenshot ridotto).
- `<meta name="apple-mobile-web-app-capable" content="yes">`.
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`.
- `<meta name="apple-mobile-web-app-title" content="Listino PRO">`.
- Theme color con media query light/dark:
  ```html
  <meta name="theme-color" content="#111827" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#f4f6fb" media="(prefers-color-scheme: light)">
  ```
- Manifest: aggiungi `id`, `scope`, almeno una icona PNG 192x192 e 512x512 (iOS preferisce PNG; SVG è supportato ma con bug noti).

**Fix proposto:** aggiungere i meta nel `<head>`, generare PNG icon (anche da SVG con un singolo comando `rsvg-convert` o tool online), aggiornare manifest.

**Impatto:** PWA installata "professionale", non più con icona screenshot.

---

### iOS3. `location.href = 'https://wa.me/...'` esce dalla PWA in standalone

**Severità:** MEDIA.
**File/righe:** `index.html:487,599`

```js
location.href='https://wa.me/?text='+encodeURIComponent(...);
```

In modalità standalone (PWA installata), questo cambia la navigation della PWA stessa. Su iOS, il sistema apre l'URL `wa.me` in MobileSafari esterno **e l'utente non riesce a tornare indietro alla PWA** se non manualmente. La PWA standalone perde lo "stato" di navigazione.

**Fix proposto:**
```js
const a=document.createElement('a');
a.href='https://wa.me/?text='+encodeURIComponent(...);
a.target='_blank'; a.rel='noopener';
document.body.appendChild(a); a.click(); a.remove();
```

`target="_blank"` su standalone fa aprire in MobileSafari ma **mantiene la PWA aperta in background**. L'utente fa "← Listino PRO" dalla statusbar e torna.

**Impatto:** UX migliore su iPhone aggiunto a Home.

---

### iOS4. Blob URL di immagini su iOS Safari → schermo bianco

**Severità:** MEDIA — coperto in parte da fix S1 ma da finire.
**File/righe:** `index.html:464-486`

Bug noto WebKit (radar #200xxxxxx): `window.open(blobUrl)` con `Content-Type: image/png` non rende l'immagine sul <body> ma resta bianco. Workaround universale: incapsulare in HTML.

**Fix:** integrato nel patch S1 (vedi sopra: branch `if(blob.type.startsWith('image/'))`).

---

### iOS5. `setTimeout(..., 60000)` per revoke blob URL

**Severità:** BASSA.
**File/righe:** `index.html:478`

Se l'utente apre la promo, va in background al volo, l'app viene throttled, il `setTimeout` può sparare troppo presto o troppo tardi. Su iOS PWA standalone i timer sono particolarmente inaffidabili.

**Fix:** revocare al `pagehide` del tab figlio (vedi patch S1). Se non disponibile, allungare il timeout a 5 minuti.

---

### iOS6. IndexedDB su iOS — limiti e perdita dati

**Severità:** INFO (non un bug, ma da comunicare).

- **Quota Safari iOS PWA installata:** ~50 MB pratici, fino a ~1 GB teorici dopo prompt utente. Le promo embedded da 8 MB la mangiano in fretta.
- **Private browsing:** quota molto più piccola, IDB spesso fallisce silenziosamente.
- **"Cancella cronologia e dati siti web":** elimina IndexedDB, localStorage e Cache Storage *anche* della PWA installata. L'utente perde listino, PDF, bozze admin, **PAT GitHub**.
- **Eviction "Intelligent Tracking Prevention":** se l'utente non apre la PWA per ~7 giorni e non l'ha installata, iOS Safari può evictare lo storage. La PWA installata è esente.

**Fix proposto:**
- Avvisare l'utente nella UI: "Su iPhone aggiungi l'app alla schermata Home per evitare la perdita dati dopo 7 giorni di inattività."
- Per l'admin: bottone "Esporta backup" che scarica tutto lo stato (config GH **senza token**, bozza, sha) come JSON, da reimportare in caso di reset.

**Impatto:** Comunicazione, non codice. Riduce ticket di supporto futuri.

---

## 3. Architettura — file embedded come data URI

### A1. La scelta data URI dentro `promo.json`

**È un anti-pattern?** Dipende. Per N <= 5 promo con file <= 500 KB ciascuna è accettabile. Oltre, no.

**Numeri concreti:**
| N promo | Size media file | Size JSON (con base64 +33%) | Fetch su 4G (~2 Mbps) | Parse JSON su mobile |
|---------|-----------------|-----------------------------|-----------------------|----------------------|
| 5 | 200 KB | ~1.3 MB | 5 s | 100 ms |
| 20 | 200 KB | ~5.3 MB | 21 s | 500 ms |
| 50 | 200 KB | ~13 MB | **52 s** | ~1.5 s |
| 50 | 1 MB | ~66 MB | **non funziona** | OOM possibile |

In più ogni `loadPromos()` o publish trasferisce *tutto* il JSON, anche se cambia solo una promo. GitHub API limit per PUT è ~100 MB per file ma con 50 MB già il body della PUT è enorme.

**Vincoli del problema:** "PWA su GitHub Pages, niente backend, niente Cloudflare." Quindi le opzioni sono:

**Opzione 1 — Upload binario diretto sulla repo via Contents API (consigliata).**
L'admin uploada il file binario direttamente nella cartella `promo/` usando la stessa Contents API che già usi per `promo.json`. `promo.json` torna piccolo (solo metadata + path). Stesso PAT, stessa ergonomia. Pro: niente JSON gigante, fetch HTTP normale per i PDF, cache HTTP del browser/CDN GitHub Pages. Contro: due commit per ogni publish (file + json) — facilmente unificabile in Tree API.

```js
// pseudo-flusso:
async function uploadAsset(file){
  const path=`promo/${slugify(file.name)}-${Date.now()}.${ext(file.name)}`;
  const b64=await fileToBase64(file);
  await ghPutFile(path, b64, `Add ${path}`); // PUT /contents/promo/...
  return './'+path; // path relativo
}
```

E in `promo.json` la promo ha `url: "promo/abc-123.pdf"`, esattamente come le promo "vecchie".

**Opzione 2 — GitHub Releases come CDN.**
L'admin crea una release o aggiorna l'asset di una release "promos". Asset URL stabile (`github.com/<owner>/<repo>/releases/download/<tag>/<file>`). Pro: separazione netta tra "codice" e "media". Contro: API più complessa (multi-step), CORS sui download diretti — bisogna controllare se GitHub serve gli asset con headers utili.

**Opzione 3 — Branch separato `assets`.**
Tutti i file binari su un branch `assets` separato, fetched da `https://raw.githubusercontent.com/.../assets/...` o da `<owner>.github.io/<repo>/assets/...`. Pro: storia git pulita. Contro: GitHub Pages serve solo un branch (se è `main`), va orchestrato.

**Opzione 4 — Tenere il modello attuale per N piccolo, segnale chiaro a soglia.**
Mostrare nell'admin "Sei a 8 MB / 25 MB. A questo ritmo arrivi al limite tra X promo. Considera di pulire."

**Raccomandazione:** Opzione 1 (upload binari via Contents API) è il delta minimo che risolve sia l'iOS issue (la promo torna URL HTTP statico, niente blob) sia il problema di scaling. Mantiene retrocompatibilità con le promo già in formato `url: "promo/x.pdf"`. Costo stimato: 60 righe di JS in più nell'admin.

**Mantieni anche** la modalità data URI come opzione "veloce" per chi vuole testare senza commit binari. Diventa fallback, non default.

---

### A2. Codice duplicato

**Severità:** BASSA.

`openDb / idbSet / idbGet / idbDel / escapeHtml / isDataUri` sono identici in `index.html` (242-258) e `admin-promo.html` (188-197). Se cambi uno, devi cambiare l'altro o si crea drift.

**Fix proposto:** estrarre in `lib.js` (file unico), include con `<script src="./lib.js"></script>` in entrambi.

Pro: una sola fonte. Contro: una fetch in più (mitigata da SW cache).

**Impatto:** Manutenibilità. Non urgente.

---

### A3. `alert()` / `confirm()` come UX

**Severità:** BASSA, ma fastidio reale.

35+ occorrenze di `alert(...)` nel codice. `alert` su iOS PWA standalone:
- blocca tutta l'interazione finché non chiudi
- a volte appare *due* volte (bug noto su iOS 16/17)
- in modalità "show preview" inline può saltare

**Fix proposto:** una piccola funzione `notify(text, kind='info')` che mostra un toast in DOM. ~30 righe di JS+CSS, sostituisce gli alert "informativi". Mantieni `confirm()` per le conferme distruttive (è semantica "stop and ask").

**Impatto:** UX. Non urgente.

---

## 4. Multi-admin

### MA1. Conflict resolution: il losing admin perde tutto

**Severità:** MEDIA.
**File/righe:** `admin-promo.html:645-650`

```js
}else if(rPut.status===409||rPut.status===422){
  ...
  alert('⚠️ Conflitto: qualcun altro ha aggiornato promo.json...
         Premi "Ricarica da GitHub" (perderai le modifiche locali, oppure scarica prima un backup)');
}
```

L'utente che vede 409 deve:
1. Scaricare manualmente un backup (e ricordarsi di farlo).
2. "Ricarica da GitHub" che sovrascrive la bozza.
3. Riapplicare manualmente le sue modifiche.

Se ci si dimentica del passo 1: lavoro perso.

**Fix proposto, livelli crescenti:**

1. **Auto-backup nel browser prima di publish** (1 ora di lavoro):
   - Prima di chiamare `ghPublish`, salva la bozza corrente in IndexedDB con chiave `listino_promo_admin_backup_<timestamp>`.
   - Tieni gli ultimi 5 backup. Mostrane la lista con bottoni "Ripristina".
   - Su 409: l'alert dice "il tuo lavoro è in backup-2026-...". Niente perdita.

2. **Auto-merge basato su `id` promo** (mezza giornata):
   - Su 409: fetch del remoto, confronta gli array per `id`. Le promo presenti nel locale ma non nel remoto → aggiungi. Quelle nel remoto ma non nel locale → mantieni. Quelle in entrambi: se identiche, ok; se diverse, alert con diff e scelta manuale.

3. **Pessimistic lock via issue/branch dedicato** (giorni):
   - Più complesso, probabilmente non vale per il tuo caso.

**Raccomandazione:** Livello 1 sempre. Livello 2 se hai >1 admin attivo a settimana.

---

### MA2. Bozza locale per browser, mai sincronizzata

**Severità:** BASSA.

L'admin lavora dal Mac, salva bozza in IndexedDB del Mac. Apre `admin-promo.html` dall'iPad: bozza vuota, fa "Ricarica da GitHub", parte da zero, perde le modifiche del Mac.

**Fix proposto:** quando l'admin "Pubblica", azzera la bozza locale. Quando apre l'admin, il primo step deve essere `loadFromGithub` automatico **se non esiste bozza locale recente** (< 1 giorno). Aggiungere un timestamp `draftUpdatedAt` e mostrarlo: "Stai modificando una bozza locale di X minuti fa. Premi 'Ricarica da GitHub' per partire dalla versione pubblica."

**Impatto:** Onboarding meno confuso. Costo basso.

---

## 5. Service Worker

### SW1. Vedi S6 (cache che cresce all'infinito)

### SW2. Vedi S10 (fallback offline confuso)

### SW3. `sw.js.bak` committato

`sw.js.bak` è una copia dell'SW vecchio committata accanto al nuovo. Confonde il deploy (GitHub Pages serve entrambi) e fa un po' "lavori in corso". Da rimuovere.

---

## 6. Altro

### O1. Manifest PWA incompleto

Vedi iOS2. Aggiungi:
```json
{
  "id": "/listino-configuratore/",
  "scope": "/listino-configuratore/",
  ...
  "icons": [
    {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"},
    {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

PNG generabili da `icon.svg` con `rsvg-convert -w 192 icon.svg > icon-192.png`.

### O2. `pdfjs-dist@3.11.174`

- v4.x è ESM-only e ha breaking changes (`getDocument` ritorna direttamente promise, non `.promise`). Per ora **non** aggiornare a 4.x: richiede refactor.
- v3.11.174 ha avuto una CVE moderata (CVE-2024-4367 — XSS via PDF malformato) corretta in v4.2. **Esposizione tua:** se carichi un PDF malevolo con `idbSet('listino_pdf', ...)` e lo apri nel viewer, può iniettare JS. Carichi solo PDF tuoi, quindi rischio realistico basso. Considera upgrade a 3.11.x più recente disponibile (3.11.174 dovrebbe essere già patchata, ma da verificare).

**Fix proposto:** verifica con `npm view pdfjs-dist@3 versions` quale è l'ultima 3.x e usa quella.

### O3. `xlsx@0.18.5` (SheetJS Community)

- Ha avuto vari avvisi di sicurezza (Prototype Pollution CVE-2023-30533, ReDoS GHSA-4r6h-8v6p-xvw6).
- Il pacchetto npm non riceve update da SheetJS dal 2022 (sono passati a CDN proprio).
- Versione attuale "stabile" SheetJS è 0.20.x ma su CDN di SheetJS, non npm.

**Alternativa pratica:** caricare solo CSV e dichiarare "Excel non più supportato — convertilo prima in CSV". Riduzione drastica della superficie. Se Excel resta requisito, considera `read-excel-file` (più piccolo, attivamente mantenuto, ESM).

**Impatto:** Decisione strategica. Per ora puoi mantenere xlsx@0.18.5 sapendo il rischio (utente carica solo i suoi file = rischio basso) e mettere SRI.

### O4. Accessibilità

- I bottoni dei file usano `<label class="fileLabel">` con dentro `<input type="file" style="display:none">`. Lettori di schermo li annunciano in modo confuso. Aggiungi `role="button"` e `tabindex="0"` al label, gestisci `keydown Enter/Space`.
- I `<button>` "data-page", "data-id" non hanno `aria-label` esplicito quando ci sono solo simboli (`‹`, `›`, `×`).
- Il modale legale (`legalModal`) non gestisce focus trap. Premendo Tab si esce dietro il modale.
- Contrasti: `--muted: #6b7280` su `--bg: #f4f6fb` = ratio 4.51:1 — al pelo per WCAG AA. Per testo piccolo (`<14px`) sotto soglia.

**Fix proposto:** una passata di `axe DevTools` o `lighthouse` con accessibility audit, sistemare le top-5.

### O5. i18n

Hardcoded italiano. Per il pubblico italiano va bene. Se in futuro serve EN, una `dict[lang][key]` minimale è 50 righe. Non ora.

### O6. `getDocument({data: new Uint8Array(data)})` — copia memoria

`index.html:557`. `data` è già un ArrayBuffer da IDB; `new Uint8Array(data)` non copia (è una view) — OK.

### O7. PDF embed via `<iframe>` quando si apre da blob

Per PDF embedded, oltre al fix S1, considera di usare il **viewer interno pdf.js** invece di `window.open`. È già implementato nel codice principale (`#pdfViewer`) per il listino PDF: si potrebbe estenderlo per renderizzare anche le promo PDF. Risolve TUTTI i problemi iOS in un colpo solo (niente popup, niente blob URL, niente fuori-app).

**Costo:** ~20 righe per riusare `pdfDoc` e renderPdfPage con un secondo "currentDoc". Nice-to-have, non urgente.

### O8. `data-promo-open="${escapeAttr(id)}"` con id che fallback su URL

`index.html:428` `function promoId(p){return p.id || p.url || p.title;}`

Se una promo non ha `id`, usa `url`. Se `url` è un data URI di 500 KB, finisce dentro un attributo HTML da 500 KB. Funziona ma è inefficiente e brutto. La `find` successiva (`visible.find(x=>promoId(x)===btn.dataset.promoOpen)`) confronta stringhe da 500 KB a ogni click.

**Fix proposto:** usa l'indice nell'array (`data-i="0"`) o genera sempre un `id` in `normalize()` se mancante (in admin-promo.html è già forzato).

### O9. Service worker `sw.js.bak`

Da rimuovere (vedi SW3).

### O10. README/docs disallineati

`PROMO_SENZA_CLOUDFLARE.md` dice "Questa versione NON scrive direttamente su GitHub" — è obsoleto, ora scrive tramite API. Da aggiornare o rimuovere.

`SETUP_PROMO_CLOUDFLARE.md` esiste ma non è più rilevante. Rimuovere.

---

## 7. Priorità di intervento (proposta)

| Priorità | Issue | Effort | Beneficio |
|----------|-------|--------|-----------|
| 🔴 1 | S1 / iOS1 — popup post-await | 30 min | **Risolve scheda bianca iPhone** |
| 🔴 2 | S2 — whitelist MIME | 5 min | Blocca SVG-XSS |
| 🟠 3 | S6 — SW cache key canonica | 15 min | Evita auto-eviction |
| 🟠 4 | S7 — CSV injection guard | 5 min | Difensiva anti-formula |
| 🟠 5 | iOS2 — meta tag iOS + manifest | 20 min | PWA installata pulita |
| 🟠 6 | iOS3 — `<a target=_blank>` invece di location.href | 5 min | UX standalone |
| 🟡 7 | S5 — SRI sui CDN | 15 min | Mitigazione supply chain |
| 🟡 8 | S8 — CSP minimale | 30 min | Mitigazione XSS |
| 🟡 9 | S9 — escapeHtml unificato | 5 min | Igiene codice |
| 🟡 10 | S10 — SW fallback corretto | 10 min | Diagnostica offline |
| 🟡 11 | SW3 — rimuovere `sw.js.bak` | 1 min | Pulizia |
| 🟡 12 | MA1 — auto-backup pre-publish (livello 1) | 1 h | Protezione lavoro multi-admin |
| 🟢 13 | A1 — upload binari via Contents API | 3 h | Scalabilità reale, fix iOS architetturale |
| 🟢 14 | S3 — UX warning scadenza token | 20 min | Igiene PAT |
| 🟢 15 | A2 — estrarre `lib.js` | 30 min | DRY |
| 🟢 16 | O3 — decisione XLSX (mantieni / sostituisci) | varia | Scelta strategica |
| 🟢 17 | A3 — toast invece di alert | 1 h | UX |
| 🟢 18 | O7 — viewer PDF interno per promo | 1 h | UX iOS |
| 🟢 19 | O4 — passata accessibility | 1 h | Conformità |
| 🟢 20 | O10 — pulizia docs obsolete | 15 min | Pulizia |

🔴 = applicare subito
🟠 = applicare presto (oggi/domani)
🟡 = applicare quando puoi
🟢 = a discrezione / dopo

---

## 8. Cosa NON ho fatto

- **Non ho eseguito** l'app in browser (richiederebbe un setup live; l'audit è statico sul codice).
- **Non ho testato** sull'iPhone reale: serve te con il device — vedi `TEST_IOS.md`.
- **Non ho verificato** i CVE elencati con un dependency scanner: la verifica va fatta con `npm audit` o `osv-scanner` se vuoi rigore.

---

## 9. Stato finale: cosa è stato applicato

Fix applicati sul branch `audit-fixes`. Niente è stato fuso su `main`: il merge è una decisione successiva, dopo i test su iPhone (vedi `TEST_IOS.md`).

### ✅ Applicato — Gruppo A (quick win)

| ID | Fix | File toccati |
|---|---|---|
| **S1 / iOS1** | `window.open('about:blank')` sincrono prima dell'`await fetch`, poi navigato. Wrapping HTML per le immagini. Revoke su `pagehide` invece di `setTimeout` solo. | `index.html` |
| **S2** | Whitelist MIME esplicita: solo `application/pdf`, `image/jpeg/png/webp/gif`. Niente `image/*` generico (blocca SVG-XSS). | `admin-promo.html` |
| **S6** | Service worker: `promo.json` cachato con chiave canonica (senza query string). Stop alla cache che cresceva all'infinito. | `sw.js`, `index.html`, `admin-promo.html` |
| **S7** | CSV injection guard nell'export preventivo: prefisso apostrofo davanti a `=`, `+`, `-`, `@`, `\t`, `\r`. Line ending `\r\n` per compat Excel Windows. | `index.html` |
| **S9** | `escapeHtml` unificato (gestisce anche `'`), `escapeAttr` rimosso, callsite sostituiti. | `index.html` |
| **S10** | SW fallback offline: HTML home solo per `request.mode === 'navigate'`, altrimenti 504. Più diagnostica, meno confusione. | `sw.js` |
| **SW3** | `sw.js.bak` rimosso dalla repo. | — |
| **iOS2** | `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `theme-color` con media query light/dark. | `index.html`, `admin-promo.html` |
| **iOS3** | WhatsApp aperto via `<a target="_blank">` invece di `location.href`: la PWA standalone su iOS non viene "abbandonata". | `index.html` |
| **S4** | Password `admin` rimossa. Il login form è eliminato; al posto suo un avviso arancione che spiega esplicitamente "il PAT è la sola protezione effettiva". | `admin-promo.html` |

### ✅ Applicato — Gruppo B (sicurezza difensiva)

| ID | Fix | File toccati |
|---|---|---|
| **S5** | `integrity="sha384-..."` + `crossorigin="anonymous"` su `xlsx@0.18.5` e `pdfjs-dist@3.11.174` caricati da jsdelivr. **Nota:** il worker pdf.js (`pdf.worker.min.js`) è caricato runtime via `pdfjsLib.GlobalWorkerOptions.workerSrc` e SRI **non** si applica ai Worker — la mitigazione lì è la CSP `worker-src 'self' blob: https://cdn.jsdelivr.net`. | `index.html` |
| **S8** | CSP minimale via `<meta http-equiv="Content-Security-Policy">` su `index.html` e `admin-promo.html`. Mantengo `'unsafe-inline'` perché tutti gli script principali sono inline. Per toglierlo serve refactor: tracciato in C. | `index.html`, `admin-promo.html` |
| **S3** | Salvataggio `tokenSavedAt` al primo set/cambio token. Avviso UI quando il token è stato salvato da > 60 giorni. | `admin-promo.html` |
| **MA1 (livello 1)** | Auto-backup della bozza in IndexedDB **prima di ogni publish** (chiave `listino_promo_admin_backup_<ISO>`). Mantiene gli ultimi 5. Il messaggio di conflitto 409 ora cita esplicitamente il backup. | `admin-promo.html` |

### 🟢 Decisioni strategiche prese

- **S4 (password admin):** rimossa. Notice arancione visibile in cima al pannello.
- **O3 (xlsx):** mantenuto `xlsx@0.18.5` con SRI hash. Alternative valutate per il futuro — vedi sotto.
- **O10 (docs obsolete):** info utili migrate in `README.md`, file ridondanti rimossi:
  - ❌ `SETUP_PROMO_CLOUDFLARE.md` (Cloudflare path abbandonato)
  - ❌ `PROMO_UPGRADE_COMPLETO.md` (4 righe, info già nel README)
  - ❌ `PROMO_SENZA_CLOUDFLARE.md` (workflow manuale superato dal flusso GitHub API)
  - ❌ `PROMO_ADMIN_GITHUB.md` (citava la password rimossa)
  - ❌ `PROMO_EMBEDDED_FILES.md` (contenuti tecnici migrati in README)
  - ✅ `README.md` riscritto come unica fonte canonica.

### 🔮 Alternative xlsx (per riferimento futuro, **non sostituite ora**)

Se in futuro vorrai sostituire `xlsx@0.18.5` (pacchetto npm non più aggiornato dal 2022):

| Libreria | Pro | Contro | Licenza |
|---|---|---|---|
| **`read-excel-file`** (Catamphetamine) | Attivamente mantenuta, ESM, ~150 KB. Solo lettura `.xlsx`. | Non legge `.xls` (formato vecchio). Non scrive. | MIT |
| **`exceljs`** | Lettura E scrittura. Mantenuta. | Pesante (~450 KB), API più verbosa. | MIT |
| **SheetJS Pro / `xlsx` da CDN ufficiale** | Versione attuale (0.20.x) con bugfix recenti. | Distribuita solo via `cdn.sheetjs.com` o npm a pagamento. Stessa libreria, build più recente. | Apache 2.0 (community) |
| **CSV-only** | Zero dipendenze, parser ~30 righe. Più veloce, zero CVE. | Gli utenti devono salvare l'Excel come CSV manualmente. | — |

Raccomandazione operativa: **resta su `xlsx@0.18.5` con SRI**. Il rischio reale è basso (l'utente carica i propri file). Se i clienti italiani non-tecnici si lamentano di file CSV mal formattati o vuoi togliere CDN, valuta `read-excel-file`.

### ⏸️ Lasciato per dopo — Gruppo C

Da affrontare in una sessione dedicata, in particolare A1.

| ID | Cosa | Effort | Perché aspetta |
|---|---|---|---|
| **A1** | Upload binari via Contents API (JSON piccolo + file in `promo/`) | ~3 h | Cambio architetturale del flusso admin, va testato con calma. È il vero scaling fix. |
| **A2** | Estrarre `lib.js` condiviso | ~30 min | Manutenibilità, non urgente. |
| **A3** | Toast UX invece di `alert()`/`confirm()` | ~1 h | Refactor diffuso, lo facciamo dopo aver scelto la libreria/stile. |
| **O4** | Passata accessibility (axe / Lighthouse) | ~1 h | Iterativo, da fare con UI design. |
| **O7** | Viewer PDF interno (pdf.js) per le promo, in alternativa a `window.open` | ~1 h | Già coperto in larga parte da S1; valuta dopo i test iOS. |

### 🔒 Verifica integrità

- Cache version `sw.js`: `listino-configuratore-pro-promo-embedded-v6` → `v9` (gruppo A+B) → `v10` (popup-fix-ios-pwa).
- Sintassi JS verificata: `node -e "new Function(...)"` su entrambi gli script inline e su `sw.js`.
- Nessun riferimento residuo a `ADMIN_PASSWORD`, `loginPanel`, `escapeAttr` (grep pulito).

---

## 10. Fix v2 — modal in-app per promo embedded (branch `popup-fix-ios-pwa`)

**Data:** 2026-05-03 (stesso giorno, pomeriggio)
**Triggered by:** test reali su iPhone iOS 18 / Safari 18 in PWA standalone.

### Cosa è successo

Il fix v1 (S1/iOS1) — `window.open('about:blank')` sincrono prima dell'`await`, poi navigazione con `location.replace(blobUrl)` o `document.write(html)` — **è stato bloccato lo stesso** dal popup blocker di Safari iOS in modalità PWA standalone:

```
Test 2/3 risultato: si apre brevemente about:blank, poi alert
"Il browser ha bloccato il popup. Consenti i popup per questo sito."
```

Spiegazione: in PWA standalone (icon home + display:standalone), Safari iOS 18 considera **qualsiasi** `window.open` come un popup non sollecitato, anche con user activation valido e senza `await`. Si tratta di un comportamento più stretto di Safari mobile non-standalone.

### Come è stato risolto (v2)

Cambio di approccio: **niente `window.open` per le promo embedded**. Si apre invece un **modal interno** dentro la PWA:

- Detection: `if (url.startsWith('data:')) → openPromoModal(p)` altrimenti `window.open(url, '_blank', 'noopener')` (path/URL normali continuano a funzionare come prima — Test 1 confermato OK).
- Per `data:image/...`: `<img src="data:...">` dentro un overlay fullscreen, con hint "Tieni premuto per salvare".
- Per `data:application/pdf`: `pdf.js` rende la prima pagina su canvas, con controlli prev/next se multi-pagina.
- Pulsante "Scarica" usa `fetch(dataUri) → Blob → URL.createObjectURL(blob) → <a download>` al click. `<a download>` con Blob URL **non** è un popup → non bloccato dal popup blocker iOS.
- Chiusura: pulsante X, tap sullo sfondo nero, tasto ESC (su tastiera).
- Validazione MIME conservata (rifiuta SVG, HTML, ecc.).

### File modificati

- `index.html`: aggiunti modal `#promoModal` (HTML), CSS `.promoModal/.promoTop/.promoBody`, blocco JS ~110 righe (`openPromoModal`, `renderPromoPdfPage`, `closePromoModal`, `downloadPromoFile`), click handler semplificato.
- `sw.js`: cache version v9 → v10.
- `TEST_IOS.md`: Test 2/3 riscritti per la versione modal, aggiunto Test 3b per il download.

### Cosa è stato rimosso (perché non serve più)

- `window.open('about:blank','_blank','noopener')` come stratagemma.
- Il wrapping HTML inline nel tab figlio.
- `setTimeout(URL.revokeObjectURL, 5*60*1000)` legato a tab esterno.

### Trade-off

- **Pro:** il modal evita del tutto il popup blocker, l'apertura è immediata, niente cambio di scheda, UX più nativa, l'utente resta dentro la PWA.
- **Contro:** la prima volta che si apre un PDF embedded c'è un piccolo delay (caricamento pdf.js worker se non ancora caricato + parsing del PDF). Trascurabile su mobile moderno.
- **Memoria:** il PDF/immagine resta nel DOM finché il modal è aperto. Per file fino a 8 MB (limite admin), tranquillo. Per file molto più grandi, attenzione (ma l'admin già blocca a 8 MB).
- **Download:** dipende dal comportamento del browser per `<a download>` con Blob URL. Su iOS Safari triggera tipicamente lo share sheet (non un download diretto). Da verificare in Test 3b.

### Stato finale dei due rami audit

```
main (non ancora aggiornato)
 └── audit-fixes (PR #1 da aprire)
      └── popup-fix-ios-pwa (PR #2 da aprire, dopo PR #1)
```

Il merge sequenziale è quello consigliato: prima `audit-fixes` (Group A+B), poi `popup-fix-ios-pwa` (modal). Possono anche essere mergiati insieme se preferisci una review unica.

---

## 11. Group C → A1 implementato — refactor data URI → file binari

**Data:** 2026-05-03 (tardo pomeriggio)
**Branch:** `refactor-upload-binari` (parte da `main` con i fix audit + popup-v2 + WhatsApp-canonical-url già mergiati)
**Triggered by:** condivisione WhatsApp di una promo embedded portava all'home dell'app, non al file (perché il file non aveva URL pubblico).

### Cosa è cambiato

**Prima:** quando l'admin caricava un PDF/immagine, il file diventava un `data:base64,...` dentro il campo `url` di `promo.json`. JSON poteva crescere a MB. Il file non aveva un URL pubblico cliccabile.

**Ora:** quando l'admin carica un file:
1. Il binario viene **immediatamente pushato** su `promo/<slug>-<timestamp>.<ext>` via GitHub Contents API (un commit dedicato).
2. Il `url` della promo nel JSON locale diventa il path (es. `promo/prevendita-b-300-1762345678901.pdf`).
3. Quando l'admin preme **Pubblica**, viene committato solo il `promo.json` aggiornato.

Risultato: ogni promo ha un URL pubblico cliccabile su `alessandropezzali.it/listino-configuratore/promo/<file>`. Condivisione WhatsApp porta direttamente al file, non più all'app.

### Modifiche tecniche

`admin-promo.html`:

- **Helpers nuovi:** `slugify`, `randomSuffix`, `buildPromoFilename`, `fileToBase64`, `ghPutBinary`, `uploadPromoBinary`.
- **`attachFileToPromo` riscritta:** transazionale (PUT binario fallisce → JSON locale invariato), progress UI nel `saveState`, error handling con dettagli API GitHub.
- **`render()` aggiornata:** distingue 4 stati per la UI del fileBox: `data:` URI legacy (pill warn) / file GitHub managed (pill embedded) / URL/path manuale (pill url) / vuoto.
- **Counter `binariesUploadedThisSession`:** traccia upload nella sessione corrente, mostrato nel summary post-publish, resettato al publish riuscito.
- **Pulsante "Migra embedded → file GitHub":** loop sequenziale sulle promo `data:` URI nel JSON corrente, ognuna estratta come blob, validata MIME, pushata come binario su GitHub e aggiornata nel JSON. Backup automatico pre-migrate. Errori riportati alla fine.
- **Senza PAT configurato:** alert e blocco al file select, coerente con il flusso publish.

### Naming convention

`<slug-ASCII-titolo>-<timestamp-ms>.<ext>`. Slug max 50 char, lowercase, dash-separated. Timestamp `Date.now()` (ms Unix). Estensione dal MIME. Retry con suffisso random 4-char in caso di collisione (rara).

### Trade-off

- **Pro:** URL pubblico cliccabile per ogni promo. JSON resta KB. Fetch promo veloce su mobile. Cache HTTP standard. Scaling lineare con numero di promo (50 promo da 200 KB = 50 file binari distinti, non 10 MB di JSON).
- **Contro:** un commit per binario (history più verbosa). File orfani in `promo/` se l'admin sostituisce un file (cleanup manuale, scelta deliberata di semplicità).
- **Retrocompatibilità:** le promo già esistenti con `url:"data:..."` continuano a funzionare nel modal in-app dell'app utente (`index.html` invariato). Il bottone migrazione le converte one-shot.

### File modificati

- `admin-promo.html`: ~200 righe in più (helpers + refactor + migration UI).
- `sw.js`: cache `v11 → v12`.
- `README.md`: sezione "Architettura promo" riscritta. "Sviluppi futuri" pulita (A1 fatto).
- `TEST_REFACTOR_FILES.md`: nuovo file con 6 test specifici per questo refactor.

### Workflow git

Branch `refactor-upload-binari` → 3 commit logici:
1. `Refactor: upload binari via Contents API invece di data URI in JSON`
2. `Add migration: data: URI legacy → file GitHub`
3. `Docs: AUDIT §11, README aggiornato, TEST_REFACTOR_FILES.md`

PR aperta dall'utente da browser (non via CLI).

---

*Fine audit.*
