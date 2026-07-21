// Service Worker — Полиглот PWA
const CACHE = "polyglot-v2";
const OFFLINE_URLS = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(OFFLINE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(async (keys) => {
      const oldKeys = keys.filter((k) => k !== CACHE);
      const isUpdate = oldKeys.length > 0;

      // Delete old caches
      await Promise.all(oldKeys.map((k) => caches.delete(k)));

      // Take control of all open tabs
      await self.clients.claim();

      // If this is an update (not first install), tell all clients
      if (isUpdate) {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) =>
          client.postMessage({ type: "UPDATE_AVAILABLE" })
        );
      }
    })
  );
});

self.addEventListener("fetch", (e) => {
  // Only handle GET requests; skip API calls (always go to network)
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      // Return cached first for speed; network updates cache in background
      return cached || network;
    })
  );
});
