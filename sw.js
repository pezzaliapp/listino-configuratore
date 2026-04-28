const CACHE='listino-configuratore-pro-mobile-v3-pagine-mobile';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{try{if(e.request.method==='GET'&&resp&&resp.status===200){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}}catch(_e){}return resp;}).catch(()=>caches.match('./index.html'))))});
