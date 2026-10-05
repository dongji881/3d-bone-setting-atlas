/* 正骨学堂 离线缓存 Service Worker：应用外壳 + 解剖资产缓存优先 */
const SHELL = "zgxt-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/index.html"]))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches
              .open(SHELL)
              .then((cache) => cache.put(req, copy))
              .catch(() => undefined);
          }
          return res;
        })
        .catch(() => caches.match("/index.html"));
    }),
  );
});
