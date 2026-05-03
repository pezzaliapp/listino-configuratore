const CACHE='listino-configuratore-pro-promo-embedded-v18';
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

self.addEventListener('fetch',e=>{
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

  // Altre risorse: cache-first con fallback a network. Se entrambi falliscono,
  // l'HTML della home è un fallback ragionevole SOLO per richieste di navigazione.
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
      try{
        if(e.request.method==='GET' && resp && resp.status===200 && resp.type==='basic'){
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
