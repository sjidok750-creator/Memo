/* Gist service worker · build 20260919172417 */
const VERSION = "20260919172417";
const CACHE = "gist-" + VERSION;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
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
  // 동기화 서버·유튜브 썸네일 등 외부 요청은 건드리지 않는다
  if (url.origin !== self.location.origin) return;

  // 화면은 항상 네트워크 우선 (옛 버전에 갇히지 않게)
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(url.href, { cache: "no-store", credentials: "same-origin" });
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = (await caches.match(req)) || (await caches.match(new URL("./", self.location).href));
          if (cached) return cached;
          return new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  // 해시가 붙은 정적 파일은 캐시 우선, 나머지는 네트워크 우선
  const immutable = url.pathname.includes("/_next/static/");
  event.respondWith(
    (async () => {
      if (immutable) {
        const hit = await caches.match(req);
        if (hit) return hit;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const hit = await caches.match(req);
        if (hit) return hit;
        throw new Error("offline");
      }
    })(),
  );
});
