
const CACHE_NAME = "freetalk-v5";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./vendor/qrcode.min.js",
  "./vendor/jsQR.min.js"
];

// Install: cache the complete application and its local libraries.
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Installation succeeds only when all required files are cached.
      await cache.addAll(APP_FILES);

      await self.skipWaiting();
    })()
  );
});

// Activate: remove outdated FreeTalk caches.
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("freetalk-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// Fetch: serve application resources from Cache Storage.
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept unrelated external websites.
  if (url.origin !== self.location.origin) return;

  // Navigation: network first, cached app fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (error) {
          return (
            await caches.match(
              new URL("./index.html", self.registration.scope).href
            )
          ) || Response.error();
        }
      })()
    );

    return;
  }

  // Other local resources: cache first.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response("File unavailable offline.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain"
          }
        });
      }
    })()
  );
});
