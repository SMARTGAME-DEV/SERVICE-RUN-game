/* Service worker esterno: il gioco non viene modificato. */
const CACHE = 'service-run-pwa-v5-20261010-audio-range';
const CORE = ['./','./index.html','./game.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./preload-assets.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('service-run-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

// HTMLMediaElement (musiche e motore) puo' chiedere byte ranges.
// Una risposta 200 completa in cache deve essere convertita in 206 per queste richieste.
async function cachedRangeResponse(request, cached) {
  const range = request.headers.get('range');
  if (!range || cached.status !== 200) return cached;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match || (!match[1] && !match[2])) return cached;
  const data = await cached.blob();
  const size = data.size;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return cached;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
    return new Response(null, {status:416, headers:{'Content-Range':`bytes */${size}`,'Accept-Ranges':'bytes'}});
  }
  end = Math.min(end, size - 1);
  const headers = new Headers();
  headers.set('Content-Type', cached.headers.get('Content-Type') || 'application/octet-stream');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(data.slice(start, end + 1), {status:206, statusText:'Partial Content', headers});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}); }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cachedRangeResponse(request, cached);
    const response = await fetch(request);
    // Non salvare risposte parziali (206) al posto dei file audio completi.
    if (response.status === 200 && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  })());
});
