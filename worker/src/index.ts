/**
 * Gist 동기화 서버 (Cloudflare Worker)
 *   GET  /                      설정 페이지: 처음 열면 토큰을 만들어 보여준다
 *   POST /mcp/<token>           Claude 커넥터 (MCP, Streamable HTTP)
 *   /api/<token>/...            Gist 앱 저장 API (CORS 허용)
 */
import { countMemos, deleteMemo, ensureSchema, getImage, getMemo, getSetting, listMemos, newId, newToken, putImage, putMemo, setSetting, type Env, type Memo } from "./db";
import { handleMcp } from "./mcp";
import { setupPage } from "./ui";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS, ...extra } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function currentToken(env: Env): Promise<string | null> {
  return getSetting(env.DB, "token");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      await ensureSchema(env.DB);
    } catch (e) {
      return json({ error: "D1 database is not bound. Check wrangler.jsonc d1_databases.", detail: String(e) }, 500);
    }

    // ---- 설정 페이지 ----
    if (parts.length === 0) {
      let token = await currentToken(env);
      let fresh = false;
      if (!token) {
        token = newToken();
        await setSetting(env.DB, "token", token);
        fresh = true;
      }
      const count = await countMemos(env.DB);
      return new Response(setupPage({ origin: url.origin, token: fresh ? token : null, count, appUrl: env.APP_URL ?? "" }), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // ---- 토큰 재발급: POST /rotate  (Authorization: Bearer <현재 토큰>) ----
    if (parts[0] === "rotate" && request.method === "POST") {
      const given = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const cur = await currentToken(env);
      if (!cur || !timingSafeEqual(given, cur)) return json({ error: "unauthorized" }, 401);
      const token = newToken();
      await setSetting(env.DB, "token", token);
      return json({ token, mcp: `${url.origin}/mcp/${token}`, sync: `${url.origin}/s/${token}` });
    }

    // ---- 토큰 검사 ----
    const scope = parts[0];
    const token = parts[1] ?? "";
    if (!["mcp", "api", "s"].includes(scope)) return json({ error: "not found" }, 404);
    const cur = await currentToken(env);
    if (!cur || !token || !timingSafeEqual(token, cur)) return json({ error: "unauthorized" }, 401);

    // ---- /s/<token>: 앱에 붙여넣는 동기화 주소. 열면 앱으로 보낸다 ----
    if (scope === "s") {
      const app = (env.APP_URL ?? "").replace(/\/$/, "");
      if (app) return Response.redirect(`${app}/#sync=${encodeURIComponent(`${url.origin}/s/${token}`)}`, 302);
      return json({ ok: true, server: url.origin });
    }

    // ---- MCP ----
    if (scope === "mcp") {
      const res = await handleMcp(request, env);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    }

    // ---- REST ----
    const rest = parts.slice(2);
    const m = request.method;

    if (rest[0] === "ping") return json({ ok: true, count: await countMemos(env.DB), server: url.origin });

    if (rest[0] === "memos" && rest.length === 1) {
      if (m === "GET") {
        return json({ memos: await listMemos(env.DB, { limit: Number(url.searchParams.get("limit")) || 1000 }) });
      }
      if (m === "POST") {
        // 하나 또는 여럿 (백업 가져오기). 같은 id 는 건너뛴다 (?overwrite=1 이면 덮어씀)
        const body = (await request.json().catch(() => null)) as Memo | { memos: Memo[] } | null;
        if (!body) return json({ error: "bad json" }, 400);
        const list = Array.isArray((body as { memos?: Memo[] }).memos) ? (body as { memos: Memo[] }).memos : [body as Memo];
        const overwrite = url.searchParams.get("overwrite") === "1";
        let added = 0;
        let skipped = 0;
        const ids: string[] = [];
        for (const raw of list) {
          if (!raw || typeof raw !== "object" || typeof raw.title !== "string") {
            skipped++;
            continue;
          }
          const now = new Date().toISOString();
          const memo: Memo = { ...raw, id: typeof raw.id === "string" && raw.id ? raw.id : newId("m"), createdAt: raw.createdAt ?? now, updatedAt: now };
          if (!overwrite && (await getMemo(env.DB, memo.id))) {
            skipped++;
            continue;
          }
          // 사진이 data URL 로 오면 images 에 넣고 참조로 바꾼다
          const src = (memo.source ?? {}) as { image?: string; imageData?: string };
          const data = src.imageData ?? (src.image?.startsWith("data:") ? src.image : undefined);
          if (data) {
            const id = await storeDataUrl(env, data);
            memo.source = { ...src, image: id ? `img:${id}` : undefined, imageData: undefined };
          }
          await putMemo(env.DB, memo);
          ids.push(memo.id);
          added++;
        }
        return json({ added, skipped, ids });
      }
    }

    if (rest[0] === "memos" && rest.length === 2) {
      const id = rest[1];
      if (m === "GET") {
        const memo = await getMemo(env.DB, id);
        return memo ? json({ memo }) : json({ error: "not found" }, 404);
      }
      if (m === "PATCH") {
        const memo = await getMemo(env.DB, id);
        if (!memo) return json({ error: "not found" }, 404);
        const patch = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        delete patch.id;
        delete patch.createdAt;
        const next: Memo = { ...memo, ...patch, id, updatedAt: new Date().toISOString() };
        await putMemo(env.DB, next);
        return json({ memo: next });
      }
      if (m === "DELETE") {
        return (await deleteMemo(env.DB, id)) ? json({ ok: true }) : json({ error: "not found" }, 404);
      }
    }

    if (rest[0] === "images" && rest.length === 1 && m === "POST") {
      const body = (await request.json().catch(() => null)) as { dataUrl?: string } | null;
      if (!body?.dataUrl) return json({ error: "dataUrl required" }, 400);
      const id = await storeDataUrl(env, body.dataUrl);
      return id ? json({ id: `img:${id}` }) : json({ error: "bad image" }, 400);
    }
    if (rest[0] === "images" && rest.length === 2 && m === "GET") {
      const img = await getImage(env.DB, rest[1]);
      if (!img) return new Response("not found", { status: 404, headers: CORS });
      return new Response(img.data, { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=31536000, immutable", ...CORS } });
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

async function storeDataUrl(env: Env, dataUrl: string): Promise<string | null> {
  const mt = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataUrl);
  if (!mt) return null;
  const bin = Uint8Array.from(atob(mt[2].replace(/\s/g, "")), (c) => c.charCodeAt(0));
  if (bin.byteLength > 900_000) return null; // D1 행 크기 한도 안쪽
  return putImage(env.DB, mt[1], bin.buffer);
}
