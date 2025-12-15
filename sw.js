self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("financeiro-cache").then(cache =>
      cache.addAll([
        "./",
        "./index.html",
        "./app.js",
        "./storage.js"
      ])
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});