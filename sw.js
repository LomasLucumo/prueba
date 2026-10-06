// Sube el número de versión cuando cambies archivos para forzar la actualización.
const CACHE = 'circuito-v6';
const FILES = [
  './', './index.html', './styles.css', './app.js', './turf.min.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './circuits/index.json', './circuits/demo.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Caché primero (abre sin red) y actualiza en segundo plano cuando hay conexión.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const red = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || red;
    })
  );
});
