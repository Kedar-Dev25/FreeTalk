
const CACHE_NAME = "freetalk-v4";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json"
];

const LIBRARY_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Cache the application shell.
      await cache.addAll(APP_FILES);

      // Download and cache both QR libraries.
      // The new worker activates only after both are available.
      await Promise.all(
        LIBRARY_URLS.map(async url => {
          const response = await fetch(url, {
            mode: "cors",
            cache: "reload"
          });

          if (!response.ok || response.type === "opaque") {
            throw new Error("Could not cache library: " + url);
          }

          await cache.put(url, response);
        })
      );

      await self.skipWaiting();
    })()
  );
});

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

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Handle the external QR libraries from local Cache Storage.
  if (LIBRARY_URLS.includes(request.url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request.url);

        if (cached) return cached;

        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request.url, response.clone());
          }

          return response;

        } catch (error) {
          return new Response(
            "QR library unavailable offline.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain"
              }
            }
          );
        }
      })()
    );

    return;
  }

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

  // Other local files: cache first.
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
