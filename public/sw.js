/*
 * Served verbatim from `public/`, so it never passes through the bundler and stays plain JS.
 *
 * Its only job is to make the app installable: `beforeinstallprompt` still requires a real fetch
 * handler even though Chrome dropped that requirement for menu install.
 * https://developer.chrome.com/blog/update-install-criteria
 *
 * The offline cache is written by the app on every load (see `registerServiceWorker` in
 * `__root.tsx`), not here — an install-time copy would go stale until this file's bytes change.
 * This worker only reads it, so it can activate immediately, and `/api/auth/*`, `/api/chat` and
 * `/_serverFn/*` are never intercepted.
 */

const CACHE_NAME = "mnemonic-offline";
const OFFLINE_URL = "/offline";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Without navigation preload every navigation waits for worker boot before hitting the network.
  event.waitUntil(
    Promise.all([self.clients.claim(), self.registration.navigationPreload?.enable()]),
  );
});

const respondFromCache = async (cacheKey) => {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(cacheKey)) ?? Response.error();
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith(
      Promise.resolve(event.preloadResponse)
        .then((preloaded) => preloaded ?? fetch(request))
        .catch(async () => respondFromCache(OFFLINE_URL)),
    );
    return;
  }

  // Without this the offline document renders unstyled: its stylesheet is a subresource, so it
  // never reaches the branch above. Nothing else is intercepted — auth, the chat stream and server
  // functions all have an empty destination, and this stays network-first regardless.
  if (request.destination === "style") {
    event.respondWith(fetch(request).catch(async () => respondFromCache(request)));
  }
});
