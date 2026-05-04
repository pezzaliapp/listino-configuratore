const CACHE='listino-configuratore-pro-promo-embedded-v21';
const ASSETS=['./','./index.html','./admin-promo.html','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',e=>{
  if(e.data && e.data.type==='SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);

  // promo.json: network-first, ma cachiamo SEMPRE con la chiave canonica (senza query string).
  // Senza questo, ogni '?v=...' creava una entry nuova e la cache cresceva all'infinito.
  if(url.origin===self.location.origin && url.pathname.endsWith('/promo/promo.json')){
    const canonical=new Request(url.origin+url.pathname);
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        if(r && r.ok){
          const copy=r.clone();
          const cache=await caches.open(CACHE);
          await cache.put(canonical, copy);
        }
        return r;
      }catch(_){
        const cached=await caches.match(canonical);
        if(cached) return cached;
        return new Response('[]', {status:200, headers:{'Content-Type':'application/json'}});
      }
    })());
    return;
  }

  // Navigation request (index.html, root, deep link) → network-first con fallback cache.
  // Così l'utente vede sempre l'ultima versione del codice quando è online,
  // e resta funzionante offline grazie al fallback.
  const isNavigation=e.request.mode==='navigate'
    || (url.origin===self.location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')));
  if(isNavigation){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        if(r && r.ok && r.type==='basic'){
          const copy=r.clone();
          const cache=await caches.open(CACHE);
          await cache.put(new Request(url.origin+url.pathname), copy);
        }
        return r;
      }catch(_){
        const cached=await caches.match(e.request) || await caches.match('./index.html');
        if(cached) return cached;
        return new Response('', {status:504, statusText:'offline'});
      }
    })());
    return;
  }

  // Asset statici stessa origine (manifest, icon, ecc.) → stale-while-revalidate.
  // Risposta veloce dalla cache, ma in background scarichiamo la nuova versione.
  if(url.origin===self.location.origin){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(e.request);
      const network=fetch(e.request).then(resp=>{
        try{
          if(resp && resp.status===200 && resp.type==='basic'){
            cache.put(e.request, resp.clone());
          }
        }catch(_){}
        return resp;
      }).catch(()=>null);
      return cached || network || new Response('', {status:504, statusText:'offline'});
    })());
    return;
  }

  // Cross-origin: cache-first con fallback network. Se è una navigation, fallback all'index.
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
      try{
        if(resp && resp.status===200 && resp.type==='basic'){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy));
        }
      }catch(_){}
      return resp;
    }).catch(()=>{
      if(e.request.mode==='navigate') return caches.match('./index.html');
      return new Response('', {status:504, statusText:'offline'});
    }))
  );
});
