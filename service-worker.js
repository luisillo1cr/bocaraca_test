/* service-worker.js */
const SW_VERSION = 'v1.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',

  /* páginas que ya tienes (agrega/quita según aplique) */
  './client-dashboard.html',
  './admin-dashboard.html',
  './usuarios.html',
  './control-mensualidades.html',
  './marcar-asistencia.html',
  './reportes.html',
  './admin-events.html',
  './admin-products.html',
  './events.html',
  './store.html',
  './checkout.html',
  './profile.html',

  /* estilos y assets */
  './css/style.css',
  './assets/android-chrome-512x512.png',
  './assets/favicon-32x32.png',

  /* JS base (no es fatal si alguno no existe) */
  './js/firebase-config.js',
  './js/showAlert.js',
  './js/script.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(`app-shell-${SW_VERSION}`).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.includes(SW_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Estrategias:
   - HTML: network-first con fallback a cache y offline.html
   - CSS/JS de mismo origen: stale-while-revalidate
   - Imágenes (incluye Firebase Storage): cache-first con límite
   - CDNs (gstatic, jsdelivr, unpkg): stale-while-revalidate
*/
const IMG_CACHE = 'img-cache-' + SW_VERSION;
const RUNTIME = 'runtime-' + SW_VERSION;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET es cacheable
  if (req.method !== 'GET') return;

  // HTML → network-first
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match('./offline.html');
        })
    );
    return;
  }

  // Imágenes (incluye Firebase Storage)
  if (req.destination === 'image' ||
      url.hostname.includes('firebasestorage.googleapis.com') ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const res = await fetch(req, { mode: 'no-cors' }); // Storage puede ser opaque
          cache.put(req, res.clone());
          // housekeeping simple: limitar a 80 imgs
          cache.keys().then((keys) => { if (keys.length > 80) cache.delete(keys[0]); });
          return res;
        } catch {
          // fallback a algo local si quieres, o nada
          return caches.match('./assets/android-chrome-512x512.png');
        }
      })
    );
    return;
  }

  // CSS/JS/CDNs → stale-while-revalidate
  if (
    req.destination === 'style' || req.destination === 'script' ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('www.gstatic.com') ||
    url.hostname.includes('www.googleapis.com')
  ) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => { cache.put(req, res.clone()); return res; })
          .catch(() => null);
        return cached || network || fetch(req);
      })
    );
    return;
  }

  // Otros → pasa directo (o añade más reglas si quieres)
});
