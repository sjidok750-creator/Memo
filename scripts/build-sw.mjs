/**
 * 서비스 워커(public/sw.js)를 빌드 시각으로 버전을 박아 생성한다.
 * 화면(HTML)은 항상 새로 받아오고(network-first), 해시가 붙은 정적 파일만 캐시한다.
 * 홈 화면에 추가한 앱이 옛 화면에 갇히지 않게 하는 것이 목적이다.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const version = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

const sw = `/* Gist service worker · build ${version} */
const VERSION = ${JSON.stringify(version)};
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
`;

writeFileSync(path.join(root, "public", "sw.js"), sw);
console.log(`public/sw.js 생성 (build ${version})`);
