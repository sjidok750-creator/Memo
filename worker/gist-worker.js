/**
 * Gist 동기화 서버 — 단일 파일, 의존성 없음.
 *
 * 폰에서 배포하기:
 *   Cloudflare 대시보드 → Workers → Create → Start with Hello World → Deploy
 *   → Edit code → 이 파일 전체를 붙여넣고 Deploy
 *   → Settings → Bindings → D1 데이터베이스 추가 (변수 이름 DB)
 *   → 워커 주소를 열면 Claude 커넥터 주소와 앱 동기화 주소가 나온다.
 *
 * 주소
 *   GET  /                       설정 페이지 (처음 한 번만 토큰을 보여준다)
 *   POST /mcp/<token>            Claude 커넥터 (MCP, JSON-RPC over HTTP)
 *   /api/<token>/...             Gist 앱 저장 API
 *   POST /rotate                 토큰 재발급 (Authorization: Bearer <현재 토큰>)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const APP_URL_DEFAULT = "https://sjidok750-creator.github.io/Memo";

/* ───────────────────────── 분야 ───────────────────────── */

const CATEGORIES = {
  work: "업무 / Work",
  business: "경제·경영 / Business",
  self: "자기계발 / Self-growth",
  humanities: "인문·철학 / Humanities",
  science: "과학·기술 / Science & Tech",
  history: "역사 / History",
  arts: "문학·예술 / Arts & Literature",
  health: "건강·라이프 / Health & Life",
  society: "사회·정치 / Society & Politics",
  education: "교육·학습 / Education",
  etc: "기타 / Other",
};
const CATEGORY_IDS = Object.keys(CATEGORIES);

/* ───────────────────────── 유틸 ───────────────────────── */

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS, ...extra },
  });
}

function randomId(prefix) {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return `${prefix}-${Date.now().toString(36)}${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ───────────────────────── D1 ───────────────────────── */

let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS memos (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, kind TEXT, category TEXT, json TEXT NOT NULL)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS memos_created ON memos(created_at DESC)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
      ])
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

async function getSetting(db, key) {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first();
  return row ? row.value : null;
}
async function setSetting(db, key, value) {
  await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, value).run();
}

async function listMemos(db, { limit = 500, category, query } = {}) {
  const n = Math.min(Math.max(Number(limit) || 500, 1), 1000);
  const where = [];
  const binds = [];
  if (category) {
    where.push(`category = ?`);
    binds.push(category);
  }
  if (query) {
    where.push(`json LIKE ?`);
    binds.push(`%${String(query).replace(/[%_]/g, "")}%`);
  }
  let sql = `SELECT json FROM memos`;
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(n);
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results.map((r) => JSON.parse(r.json));
}

async function getMemo(db, id) {
  const row = await db.prepare(`SELECT json FROM memos WHERE id = ?`).bind(id).first();
  return row ? JSON.parse(row.json) : null;
}

async function putMemo(db, memo) {
  await db
    .prepare(
      `INSERT INTO memos (id, created_at, updated_at, kind, category, json) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, kind = excluded.kind, category = excluded.category, json = excluded.json`,
    )
    .bind(memo.id, memo.createdAt, memo.updatedAt, memo.kind || null, memo.category || null, JSON.stringify(memo))
    .run();
}

async function deleteMemo(db, id) {
  const memo = await getMemo(db, id);
  if (!memo) return false;
  await db.prepare(`DELETE FROM memos WHERE id = ?`).bind(id).run();
  const img = memo.source && memo.source.image;
  if (typeof img === "string" && img.startsWith("img:")) {
    await db.prepare(`DELETE FROM images WHERE id = ?`).bind(img.slice(4)).run();
  }
  return true;
}

async function countMemos(db) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM memos`).first();
  return row ? row.n : 0;
}

async function storeDataUrl(db, dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(String(dataUrl));
  if (!m) return null;
  const bin = Uint8Array.from(atob(m[2].replace(/\s/g, "")), (c) => c.charCodeAt(0));
  if (bin.byteLength > 900000) return null;
  const id = randomId("i");
  await db.prepare(`INSERT INTO images (id, mime, data, created_at) VALUES (?, ?, ?, ?)`).bind(id, m[1], bin.buffer, new Date().toISOString()).run();
  return id;
}

/* ───────────────────────── MCP ───────────────────────── */

const INSTRUCTIONS = `Gist is the user's personal reading-notes app. Use these tools whenever the user asks to save, record, or keep a summary of a YouTube video, a book, an article, or a photo/page they show you ("Gist에 저장", "기록해줘", "save to Gist", …).

Writing a memo (one save_memo call per item):
- Write in the language the user is using unless they ask otherwise.
- Understand the source first: for a YouTube link, read the page and search for what the video actually says; for a book, identify the exact edition (title, author, publisher, year) and its key ideas; for a photo, read any text in it.
- "summary": 2-5 paragraphs separated by blank lines. Wrap the most important phrases in **double asterisks** (about 1-2 per paragraph, under 20% of the text). No other markdown inside fields.
- "keyPoints": 4-8 items; **double asterisks** allowed for the key phrase.
- "quotes": lines you are confident really exist (books 5-10; videos 0-5 memorable remarks; photos sentences worth keeping verbatim). Source or original text goes in "note". Never invent quotes.
- "oneLiner": one plain sentence. "title": short; for books the exact title only (author goes in meta.author).
- Pick exactly one "category": ${CATEGORY_IDS.map((k) => `${k} (${CATEGORIES[k]})`).join(", ")}.
- "confidence": high if you read the source directly, medium if based on web research, low if unsure.
After saving, tell the user the one-liner and the link the tool returns. Don't save the same item twice; use list_memos to check when unsure.`;

const quoteSchema = {
  type: "object",
  properties: { text: { type: "string" }, note: { type: ["string", "null"], description: "Source, chapter, or original-language text" } },
  required: ["text"],
  additionalProperties: false,
};

const TOOLS = [
  {
    name: "save_memo",
    title: "Save a reading note to Gist",
    description: "Save a summarized memo (book, YouTube video, or photo) to the user's Gist app. Returns the memo id and a link.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["book", "youtube", "photo"], description: "What the source is" },
        title: { type: "string", description: "Short title. For books, the exact book title only" },
        category: { type: "string", enum: CATEGORY_IDS, description: "Exactly one field id" },
        tags: { type: "array", items: { type: "string" }, description: "3-6 short keywords" },
        oneLiner: { type: "string", description: "One plain sentence capturing the whole thing" },
        summary: { type: "string", description: "2-5 paragraphs separated by blank lines; key phrases wrapped in **double asterisks**" },
        keyPoints: { type: "array", items: { type: "string" }, description: "4-8 key points" },
        quotes: { type: "array", items: quoteSchema, description: "Memorable lines that really exist" },
        meta: {
          type: "object",
          properties: {
            author: { type: ["string", "null"] },
            publisher: { type: ["string", "null"] },
            year: { type: ["string", "null"] },
            channel: { type: ["string", "null"] },
            duration: { type: ["string", "null"] },
          },
          additionalProperties: false,
          description: "author/publisher/year for books, channel/duration for videos",
        },
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "high = read the source, medium = web research, low = unsure" },
        sourceUrl: { type: "string", description: "The YouTube URL, if any" },
        query: { type: "string", description: "What the user typed for the book" },
        thoughts: { type: "string", description: "The user's own thoughts, if they told you any" },
      },
      required: ["kind", "title", "category", "tags", "oneLiner", "summary", "keyPoints", "quotes", "confidence"],
      additionalProperties: false,
    },
  },
  {
    name: "list_memos",
    title: "List saved memos",
    description: "List the user's saved memos, newest first. Optional text query and category filter.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string", enum: CATEGORY_IDS },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_memo",
    title: "Get one memo",
    description: "Return the full content of a memo by id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
  },
  {
    name: "update_memo",
    title: "Update a memo",
    description: "Change a memo's title, category, tags, or the user's own thoughts.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        category: { type: "string", enum: CATEGORY_IDS },
        tags: { type: "array", items: { type: "string" } },
        thoughts: { type: "string", description: "Replaces the user's thoughts field" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_memo",
    title: "Delete a memo",
    description: "Delete a memo by id. Ask the user to confirm before calling this.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
  },
];

function ytId(url) {
  const m = /(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([A-Za-z0-9_-]{11})/.exec(String(url || ""));
  return m ? m[1] : null;
}

function memoLink(env, id) {
  const base = String(env.APP_URL || APP_URL_DEFAULT).replace(/\/$/, "");
  return base ? `${base}/memo/view/?id=${encodeURIComponent(id)}` : id;
}

const text = (s, isError) => ({ content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) });

async function runTool(name, args, env) {
  const db = env.DB;
  const a = args || {};
  if (name === "save_memo") {
    const missing = ["kind", "title", "category", "oneLiner", "summary", "confidence"].filter((k) => !a[k]);
    if (missing.length) return text(`Missing required fields: ${missing.join(", ")}`, true);
    if (!CATEGORY_IDS.includes(a.category)) return text(`Unknown category "${a.category}". Use one of: ${CATEGORY_IDS.join(", ")}`, true);
    const now = new Date().toISOString();
    const id = randomId("m");
    const vid = ytId(a.sourceUrl);
    const source =
      a.kind === "youtube"
        ? { url: a.sourceUrl, videoId: vid || undefined, thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : undefined, transcript: false }
        : a.kind === "book"
          ? { query: a.query || a.title }
          : {};
    const memo = {
      id,
      kind: a.kind,
      createdAt: now,
      updatedAt: now,
      title: a.title,
      category: a.category,
      tags: Array.isArray(a.tags) ? a.tags.slice(0, 12) : [],
      oneLiner: a.oneLiner,
      summary: a.summary,
      keyPoints: Array.isArray(a.keyPoints) ? a.keyPoints : [],
      quotes: (Array.isArray(a.quotes) ? a.quotes : []).map((q) => (typeof q === "string" ? { text: q, note: null } : { text: q.text, note: q.note ?? null })),
      meta: { author: null, publisher: null, year: null, channel: null, duration: null, ...(a.meta || {}) },
      confidence: ["high", "medium", "low"].includes(a.confidence) ? a.confidence : "medium",
      source,
      model: "claude-connector",
      ...(a.thoughts ? { thoughts: a.thoughts } : {}),
    };
    await putMemo(db, memo);
    return text(`Saved "${memo.title}" (id ${id}).\nOpen: ${memoLink(env, id)}`);
  }

  if (name === "list_memos") {
    const memos = await listMemos(db, { query: a.query, category: a.category, limit: a.limit || 20 });
    if (!memos.length) return text("No memos found.");
    return text(memos.map((m) => `- ${m.id} · [${m.kind}/${m.category}] ${m.title} (${String(m.createdAt).slice(0, 10)})\n  ${m.oneLiner}`).join("\n"));
  }

  if (name === "get_memo") {
    const m = await getMemo(db, a.id);
    if (!m) return text(`No memo with id ${a.id}.`, true);
    const { source, ...rest } = m;
    return text(JSON.stringify(rest, null, 2));
  }

  if (name === "update_memo") {
    const m = await getMemo(db, a.id);
    if (!m) return text(`No memo with id ${a.id}.`, true);
    if (a.category && !CATEGORY_IDS.includes(a.category)) return text(`Unknown category "${a.category}".`, true);
    const next = { ...m, updatedAt: new Date().toISOString() };
    for (const k of ["title", "category", "tags", "thoughts"]) if (a[k] !== undefined) next[k] = a[k];
    await putMemo(db, next);
    return text(`Updated "${next.title}".`);
  }

  if (name === "delete_memo") {
    const ok = await deleteMemo(db, a.id);
    return text(ok ? `Deleted ${a.id}.` : `No memo with id ${a.id}.`, !ok);
  }

  return text(`Unknown tool: ${name}`, true);
}

const rpcOk = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handleRpc(msg, env) {
  const { id, method, params } = msg || {};
  const hasId = id !== undefined && id !== null;
  try {
    if (method === "initialize") {
      const asked = params && typeof params.protocolVersion === "string" ? params.protocolVersion : null;
      return rpcOk(id, {
        protocolVersion: asked || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "gist", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    if (method === "ping") return rpcOk(id, {});
    if (method === "tools/list") return rpcOk(id, { tools: TOOLS });
    if (method === "tools/call") {
      if (!env.DB) return rpcOk(id, text("The Gist server has no database bound yet. Open the server URL in a browser for setup instructions.", true));
      const result = await runTool(params && params.name, params && params.arguments, env);
      return rpcOk(id, result);
    }
    if (method === "resources/list") return rpcOk(id, { resources: [] });
    if (method === "prompts/list") return rpcOk(id, { prompts: [] });
    if (!hasId) return null; // 알림(notification)은 응답하지 않는다
    return rpcErr(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    if (!hasId) return null;
    return rpcErr(id, -32603, `Internal error: ${e && e.message ? e.message : String(e)}`);
  }
}

async function handleMcp(request, env) {
  if (request.method === "GET") return new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST, DELETE" } });
  if (request.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST" } });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const batch = Array.isArray(body);
  const messages = batch ? body : [body];
  const out = [];
  for (const msg of messages) {
    const res = await handleRpc(msg, env);
    if (res) out.push(res);
  }
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return json(batch ? out : out[0]);
}

/* ───────────────────────── 설정 페이지 ───────────────────────── */

function page(inner) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gist 동기화 서버</title>
<style>
:root{color-scheme:light dark}
body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Hiragino Sans",Pretendard,sans-serif;background:#f7f5f0;color:#1c1b18;margin:0;padding:28px 18px 60px;line-height:1.65;word-break:keep-all}
main{max-width:620px;margin:0 auto}
h1{font-size:25px;letter-spacing:-.03em;margin:0 0 4px;display:flex;align-items:center;gap:10px}
h2{font-size:16px;margin:28px 0 8px;letter-spacing:-.02em}
.sub{color:#7d786f;font-size:14px;margin:0 0 20px}
.ok{background:#e6f4ea;color:#256b42;padding:13px 15px;border-radius:13px;font-size:14.5px}
.warn{background:#fdecea;color:#a3261e;padding:13px 15px;border-radius:13px;font-size:14.5px}
.box{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e5e1d7;border-radius:13px;padding:11px 13px;margin-bottom:6px}
code{flex:1;min-width:0;word-break:break-all;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
button,.btn{background:#d97757;color:#fff;border:0;border-radius:10px;padding:9px 15px;font-weight:600;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block;white-space:nowrap}
.how{font-size:14px;color:#5a564f;margin:6px 0 0}
ol{padding-left:22px;font-size:14.5px;color:#45423c}
li{margin:6px 0}
.mark{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#f5a27c,#d2603a);display:inline-block}
@media (prefers-color-scheme:dark){body{background:#191816;color:#ece8e0}.box{background:#22201d;border-color:#34312c}.sub,.how{color:#918c82}ol{color:#c9c4ba}.ok{background:#1e3226;color:#7fcf9a}.warn{background:#3d2322;color:#f08a8a}}
</style></head><body><main><h1><span class="mark"></span>Gist 동기화 서버</h1>${inner}</main>
<script>function copy(id,btn){navigator.clipboard.writeText(document.getElementById(id).textContent).then(function(){var o=btn.textContent;btn.textContent='복사됨';setTimeout(function(){btn.textContent=o},1500)})}</script>
</body></html>`;
}

function setupNeedsDb() {
  return page(`<p class="sub">아직 데이터베이스가 연결되지 않았어요.</p>
<div class="warn">이 워커에 <b>D1 데이터베이스</b>를 붙여야 메모를 저장할 수 있어요.</div>
<h2>폰에서 하는 방법</h2>
<ol>
<li>Cloudflare 대시보드에서 이 워커를 엽니다.</li>
<li><b>Settings → Bindings → Add binding</b></li>
<li><b>D1 database</b> 선택</li>
<li>Variable name 에 <b>DB</b> (대문자)</li>
<li>D1 database 에서 <b>Create new</b> → 이름은 <b>gist-memos</b></li>
<li>Deploy(저장) 후 이 페이지를 새로고침하세요.</li>
</ol>`);
}

function setupPage({ origin, token, count, appUrl }) {
  if (token) {
    const mcp = `${origin}/mcp/${token}`;
    const sync = `${origin}/s/${token}`;
    const app = String(appUrl || APP_URL_DEFAULT).replace(/\/$/, "");
    return page(`<p class="sub">Claude 커넥터와 Gist 앱이 함께 쓰는 메모 저장소예요.</p>
<div class="ok">준비됐어요. 아래 두 주소는 <b>지금 한 번만</b> 보입니다. 각각 바로 설정하거나 어딘가에 적어 두세요.</div>

<h2>1. Claude 커넥터 주소</h2>
<div class="box"><code id="mcp">${esc(mcp)}</code><button onclick="copy('mcp',this)">복사</button></div>
<p class="how">claude.ai → 설정 → 커넥터 → <b>커스텀 커넥터 추가</b> → 이름 <b>Gist</b>, 위 주소 붙여넣기. 추가하면 아이폰 Claude 앱에서도 바로 쓸 수 있어요.</p>

<h2>2. Gist 앱 동기화 주소</h2>
<div class="box"><code id="sync">${esc(sync)}</code><button onclick="copy('sync',this)">복사</button></div>
<p class="how">아래 버튼을 누르면 Gist 가 열리면서 자동으로 연결돼요. 이 기기에 있던 메모도 서버로 올라갑니다.</p>
${app ? `<p><a class="btn" href="${esc(app)}/#sync=${encodeURIComponent(sync)}">지금 Gist 앱에 연결하기</a></p>` : ""}`);
  }
  return page(`<p class="sub">이미 설정된 서버예요. 저장된 메모 ${count}개.</p>
<p class="how">주소를 잃어버렸으면 Cloudflare 대시보드 → 이 워커 → D1 → <code>settings</code> 표에서 <code>token</code> 행을 지우고 이 페이지를 새로고침하세요. 새 주소가 만들어지고, 커넥터와 앱은 다시 연결해야 합니다.</p>`);
}

/* ───────────────────────── 라우팅 ───────────────────────── */

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const wantsHtml = (request.headers.get("Accept") || "").includes("text/html");

    // D1 이 아직 없을 때: 커넥터는 붙일 수 있게 두고(도구 호출만 안내), 나머지는 설정 안내
    if (!env.DB) {
      if (parts[0] === "mcp") return handleMcp(request, env);
      if (parts.length === 0 || wantsHtml) return new Response(setupNeedsDb(), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      return json({ error: "no_database", message: "Bind a D1 database as DB. Open this server in a browser for instructions." }, 503);
    }

    try {
      await ensureSchema(env.DB);
    } catch (e) {
      if (parts.length === 0 || wantsHtml) return new Response(setupNeedsDb(), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
      return json({ error: "database_error", detail: String(e) }, 500);
    }

    // 설정 페이지
    if (parts.length === 0) {
      let token = await getSetting(env.DB, "token");
      let fresh = false;
      if (!token) {
        token = newToken();
        await setSetting(env.DB, "token", token);
        fresh = true;
      }
      return new Response(setupPage({ origin: url.origin, token: fresh ? token : null, count: await countMemos(env.DB), appUrl: env.APP_URL }), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // 토큰 재발급
    if (parts[0] === "rotate" && request.method === "POST") {
      const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const cur = await getSetting(env.DB, "token");
      if (!cur || !sameToken(given, cur)) return json({ error: "unauthorized" }, 401);
      const token = newToken();
      await setSetting(env.DB, "token", token);
      return json({ token, mcp: `${url.origin}/mcp/${token}`, sync: `${url.origin}/s/${token}` });
    }

    const scope = parts[0];
    const token = parts[1] || "";
    if (!["mcp", "api", "s"].includes(scope)) return json({ error: "not found" }, 404);

    const cur = await getSetting(env.DB, "token");
    if (!cur || !sameToken(token, cur)) return json({ error: "unauthorized" }, 401);

    // 앱으로 보내기
    if (scope === "s") {
      const app = String(env.APP_URL || APP_URL_DEFAULT).replace(/\/$/, "");
      if (app) return Response.redirect(`${app}/#sync=${encodeURIComponent(`${url.origin}/s/${token}`)}`, 302);
      return json({ ok: true, server: url.origin });
    }

    if (scope === "mcp") return handleMcp(request, env);

    // REST
    const rest = parts.slice(2);
    const method = request.method;

    if (rest[0] === "ping") return json({ ok: true, count: await countMemos(env.DB), server: url.origin });

    if (rest[0] === "memos" && rest.length === 1) {
      if (method === "GET") return json({ memos: await listMemos(env.DB, { limit: url.searchParams.get("limit") || 1000 }) });
      if (method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: "bad json" }, 400);
        const list = Array.isArray(body.memos) ? body.memos : [body];
        const overwrite = url.searchParams.get("overwrite") === "1";
        let added = 0;
        let skipped = 0;
        const ids = [];
        for (const raw of list) {
          if (!raw || typeof raw !== "object" || typeof raw.title !== "string") {
            skipped++;
            continue;
          }
          const now = new Date().toISOString();
          const memo = { ...raw, id: typeof raw.id === "string" && raw.id ? raw.id : randomId("m"), createdAt: raw.createdAt || now, updatedAt: now };
          if (!overwrite && (await getMemo(env.DB, memo.id))) {
            skipped++;
            continue;
          }
          const src = { ...(memo.source || {}) };
          const data = src.imageData || (typeof src.image === "string" && src.image.startsWith("data:") ? src.image : null);
          if (data) {
            const imgId = await storeDataUrl(env.DB, data);
            delete src.imageData;
            if (imgId) src.image = `img:${imgId}`;
            else delete src.image;
            memo.source = src;
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
      if (method === "GET") {
        const memo = await getMemo(env.DB, id);
        return memo ? json({ memo }) : json({ error: "not found" }, 404);
      }
      if (method === "PATCH") {
        const memo = await getMemo(env.DB, id);
        if (!memo) return json({ error: "not found" }, 404);
        const patch = (await request.json().catch(() => ({}))) || {};
        delete patch.id;
        delete patch.createdAt;
        const next = { ...memo, ...patch, id, updatedAt: new Date().toISOString() };
        await putMemo(env.DB, next);
        return json({ memo: next });
      }
      if (method === "DELETE") return (await deleteMemo(env.DB, id)) ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    if (rest[0] === "images" && rest.length === 1 && method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.dataUrl) return json({ error: "dataUrl required" }, 400);
      const imgId = await storeDataUrl(env.DB, body.dataUrl);
      return imgId ? json({ id: `img:${imgId}` }) : json({ error: "bad image" }, 400);
    }

    if (rest[0] === "images" && rest.length === 2 && method === "GET") {
      const row = await env.DB.prepare(`SELECT mime, data FROM images WHERE id = ?`).bind(rest[1]).first();
      if (!row) return new Response("not found", { status: 404, headers: CORS });
      return new Response(row.data, { headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=31536000, immutable", ...CORS } });
    }

    return json({ error: "not found" }, 404);
  },
};
