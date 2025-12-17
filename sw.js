/* Financeiro PWA Service Worker */
const CACHE_NAME = "financeiro-pwa-v1";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.js",
  "./storage.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Instala e pré-carrega
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Estratégia:
// - Navegação: network-first (com fallback do cache)
// - Arquivos: cache-first (com update em background)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só lida com GET
  if (req.method !== "GET") return;

  // Navegação (abrir a "página")
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // atualiza cache do index
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Demais assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // atualiza em background
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res && res.ok) {
                const copy = res.clone();
                return caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
              }
            })
            .catch(() => {})
        );
        return cached;
      }

      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
