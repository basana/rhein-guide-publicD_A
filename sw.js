const CACHE = 'rhine-design-test-v101';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// HTML (navigations + index.html) — сеть в приоритете, кэш только как запасной
// вариант офлайн. Остальные файлы — как раньше, кэш в приоритете.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isHtml = req.mode === 'navigate' || req.url.endsWith('index.html') || req.url.endsWith('/');

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((fresh) => {
          caches.open(CACHE).then((cache) => cache.put(req, fresh.clone()));
          return fresh;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
