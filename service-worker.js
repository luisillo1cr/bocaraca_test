// ./service-worker.js — dedupe + safe schemes + github pages friendly
const SW_VERSION = "v9.1";
const APP_CACHE  = `app-${SW_VERSION}`;

const PRECACHE_RAW = [
  "./",
  "./index.html",
  "./client-dashboard.html",
  "./admin-dashboard.html",
  "./profile.html",
  "./events.html",
  "./offline.html",
  "./css/style.css",
  "./assets/android-chrome-192x192.png",
  "./assets/android-chrome-512x512.png",
  "./assets/favicon-32x32.png",
  "./assets/logo.png",                 // si existe en tu proyecto
  "./manifest.webmanifest",
  "./js/pwa-install.js"
];

// Normaliza contra el scope del SW y elimina duplicados
function normalize(url) {
  try { return new URL(url, self.registration.scope).href; }
  catch { return url; }
}
const PRECACHE = Array.from(new Set(PRECACHE_RAW.map(normalize)));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Si hubiera un duplicado residual, hacemos fallback item-a-item
        return caches.open(APP_CACHE).then(async (c) => {
          for (const u of PRECACHE) {
            try { await c.add(u); } catch {}
          }
          await self.skipWaiting();
        });
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k.startsWith("app-") && k !== APP_CACHE) ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const isNavigate = req.mode === "navigate";
  const accept = req.headers.get("accept") || "";
  const isHTML = isNavigate || accept.includes("text/html");

  if (isHTML) {
    // Network-first con fallback a cache y luego offline.html
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match("./offline.html"));
        })
    );
    return;
  }

  // Resto: cache-first con revalidación en segundo plano
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndUpdate = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchAndUpdate;
    })
  );
});
