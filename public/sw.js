// Deliberately minimal service worker: network-first for every same-origin
// GET with the cache as an offline fallback. Navigations always hit the
// network first, so a fresh deploy is picked up on the next load — this
// worker can never pin users to a stale build.
const CACHE = "tp-v1";

self.addEventListener("install", (e) => {
  // precache the shell; hashed assets fill in via runtime caching (a page is
  // fully offline-capable from its second visit onward)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/") : Response.error()))
      )
  );
});
