/* SMARTGASmed dual desktop/mobile - offline PWA */
const CACHE='service-run-dual-v3-20261011-fix1';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const key of await caches.keys()){
    // Only our earlier mobile builds; do not delete unknown/desktop caches.
    if((key.startsWith('service-run-mobile-v1-')||key.startsWith('service-run-dual-'))&&key!==CACHE)await caches.delete(key);
  }
  await self.clients.claim();
})())});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const isDocument=req.mode==='navigate'||/\.(?:html|json|webmanifest)(?:$|\?)/i.test(new URL(req.url).pathname);
    const cache=await caches.open(CACHE);
    if(isDocument){
      try{const fresh=await fetch(req,{cache:'no-store'});if(fresh.ok)await cache.put(req,fresh.clone());return fresh;}
      catch(e){return await caches.match(req)||Response.error()}
    }
    const saved=await caches.match(req);if(saved)return saved;
    try{const resp=await fetch(req);if(resp.ok)cache.put(req,resp.clone()).catch(()=>{});return resp}
    catch(e){return Response.error()}
  })());
});
