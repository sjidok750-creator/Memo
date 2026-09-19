/** Claude 커넥터용 MCP 서버. 도구: save_memo, list_memos, get_memo, update_memo, delete_memo */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { deleteMemo, getMemo, listMemos, newId, putMemo, type Env, type Memo } from "./db";

export const CATEGORIES: Record<string, string> = {
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
const CATEGORY_IDS = Object.keys(CATEGORIES) as [string, ...string[]];

const INSTRUCTIONS = `Gist is the user's personal reading-notes app. Use these tools when the user asks to save, record, or keep a summary of a YouTube video, a book, an article, or a photo/page they show you ("Gist에 저장", "기록해줘", "save to Gist", etc.).

How to write a memo (call save_memo once per item):
- Write in the language the user is using unless they ask otherwise.
- First understand the source: for a YouTube link, read the page / search for what the video says; for a book, identify the exact edition (title, author, publisher, year) and its key ideas; for a photo, read any text in it.
- "summary": 2-5 paragraphs separated by blank lines. Wrap the most important phrases in **double asterisks** (about 1-2 per paragraph, under 20% of the text). No other markdown inside fields.
- "keyPoints": 4-8 items; **double asterisks** allowed for the key phrase.
- "quotes": memorable lines you are confident are real (books: 5-10; videos: 0-5 memorable remarks; photos: sentences worth keeping verbatim). Put the source/original text in "note". Never invent quotes.
- "oneLiner": one plain sentence. "title": short; for books the exact title only (author goes in meta.author).
- Pick exactly one "category": ${Object.entries(CATEGORIES)
  .map(([k, v]) => `${k} (${v})`)
  .join(", ")}.
- "confidence": high if you read the source directly, medium if based on web research, low if uncertain.
After saving, tell the user the one-liner and the link returned by the tool. Do not save the same item twice; use list_memos to check when unsure.`;

const quoteSchema = z.object({ text: z.string(), note: z.string().nullable().optional() });
const metaSchema = z.object({
  author: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
});

const memoInput = {
  kind: z.enum(["book", "youtube", "photo"]).describe("What the source is"),
  title: z.string().describe("Short title. For books, the exact book title only"),
  category: z.enum(CATEGORY_IDS).describe("Exactly one field id"),
  tags: z.array(z.string()).max(8).describe("3-6 short keywords"),
  oneLiner: z.string().describe("One plain sentence capturing the whole thing"),
  summary: z.string().describe("2-5 paragraphs separated by blank lines; key phrases wrapped in **double asterisks**"),
  keyPoints: z.array(z.string()).max(10).describe("4-8 key points"),
  quotes: z.array(quoteSchema).max(12).describe("Memorable lines that really exist, with source in note"),
  meta: metaSchema.optional().describe("author, publisher, year (books); channel, duration (videos)"),
  confidence: z.enum(["high", "medium", "low"]).describe("high = read the source, medium = web research, low = unsure"),
  sourceUrl: z.string().optional().describe("The YouTube URL, if any"),
  query: z.string().optional().describe("What the user typed for the book (title/author)"),
  thoughts: z.string().optional().describe("The user's own thoughts, if they told you any"),
};

function ytId(url: string | undefined): string | null {
  if (!url) return null;
  const m = /(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([A-Za-z0-9_-]{11})/.exec(url);
  return m ? m[1] : null;
}

function link(env: Env, id: string): string {
  const base = (env.APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/memo/view/?id=${encodeURIComponent(id)}` : id;
}

function brief(m: Memo): string {
  const d = String(m.createdAt).slice(0, 10);
  return `- ${m.id} · [${m.kind}/${m.category}] ${m.title} (${d})\n  ${m.oneLiner}`;
}

export function buildServer(env: Env): McpServer {
  const server = new McpServer({ name: "gist", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "save_memo",
    {
      title: "Save a reading note to Gist",
      description: "Save a summarized memo (book, YouTube video, or photo) to the user's Gist app. Returns the memo id and a link.",
      inputSchema: memoInput,
    },
    async (input) => {
      const now = new Date().toISOString();
      const id = newId("m");
      const vid = ytId(input.sourceUrl);
      const source: Record<string, unknown> =
        input.kind === "youtube"
          ? { url: input.sourceUrl, videoId: vid ?? undefined, thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : undefined, transcript: false }
          : input.kind === "book"
            ? { query: input.query ?? input.title }
            : {};
      const memo: Memo = {
        id,
        kind: input.kind,
        createdAt: now,
        updatedAt: now,
        title: input.title,
        category: input.category,
        tags: input.tags,
        oneLiner: input.oneLiner,
        summary: input.summary,
        keyPoints: input.keyPoints,
        quotes: input.quotes.map((q) => ({ text: q.text, note: q.note ?? null })),
        meta: { author: null, publisher: null, year: null, channel: null, duration: null, ...(input.meta ?? {}) },
        confidence: input.confidence,
        source,
        model: "claude-connector",
        ...(input.thoughts ? { thoughts: input.thoughts } : {}),
      };
      await putMemo(env.DB, memo);
      return { content: [{ type: "text", text: `Saved "${input.title}" (id ${id}).\nOpen: ${link(env, id)}` }] };
    },
  );

  server.registerTool(
    "list_memos",
    {
      title: "List saved memos",
      description: "List the user's saved memos, newest first. Optional text query and category filter.",
      inputSchema: { query: z.string().optional(), category: z.enum(CATEGORY_IDS).optional(), limit: z.number().int().min(1).max(100).optional() },
    },
    async ({ query, category, limit }) => {
      const memos = await listMemos(env.DB, { query, category, limit: limit ?? 20 });
      return { content: [{ type: "text", text: memos.length ? memos.map(brief).join("\n") : "No memos found." }] };
    },
  );

  server.registerTool(
    "get_memo",
    { title: "Get one memo", description: "Return the full content of a memo by id.", inputSchema: { id: z.string() } },
    async ({ id }) => {
      const m = await getMemo(env.DB, id);
      if (!m) return { content: [{ type: "text", text: `No memo with id ${id}.` }], isError: true };
      const { source: _s, ...rest } = m;
      return { content: [{ type: "text", text: JSON.stringify(rest, null, 2) }] };
    },
  );

  server.registerTool(
    "update_memo",
    {
      title: "Update a memo",
      description: "Change a memo's title, category, tags, or the user's own thoughts.",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        category: z.enum(CATEGORY_IDS).optional(),
        tags: z.array(z.string()).max(12).optional(),
        thoughts: z.string().optional().describe("Replaces the user's thoughts field"),
      },
    },
    async ({ id, ...patch }) => {
      const m = await getMemo(env.DB, id);
      if (!m) return { content: [{ type: "text", text: `No memo with id ${id}.` }], isError: true };
      const next: Memo = { ...m, updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (next as Record<string, unknown>)[k] = v;
      await putMemo(env.DB, next);
      return { content: [{ type: "text", text: `Updated "${next.title}".` }] };
    },
  );

  server.registerTool(
    "delete_memo",
    { title: "Delete a memo", description: "Delete a memo by id. Ask the user to confirm before calling this.", inputSchema: { id: z.string() } },
    async ({ id }) => {
      const ok = await deleteMemo(env.DB, id);
      return { content: [{ type: "text", text: ok ? `Deleted ${id}.` : `No memo with id ${id}.` }], isError: !ok };
    },
  );

  return server;
}

/** 요청 하나마다 무상태 전송을 만들어 처리한다 (Workers 에는 요청 간 메모리가 없다) */
export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const server = buildServer(env);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // 응답을 다 쓴 뒤 정리. 스트리밍 응답이 아니므로 바로 닫아도 된다
    void server.close().catch(() => undefined);
  }
}
