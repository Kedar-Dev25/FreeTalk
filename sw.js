
const CACHE_NAME = "freetalk-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            key => key.startsWith("freetalk-") &&
                   key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// FETCH
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // PAGE NAVIGATION
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);

          const rootURL = new URL("./", self.registration.scope).href;
          const indexURL = new URL(
            "./index.html",
            self.registration.scope
          ).href;

          const cachedPage =
            await cache.match(request, { ignoreSearch: true }) ||
            await cache.match(rootURL) ||
            await cache.match(indexURL);

          return cachedPage || new Response(
            "FreeTalk is not available offline yet.",
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

  // OTHER FILES
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
          status: 503
        });
      }
    })()
  );
});
