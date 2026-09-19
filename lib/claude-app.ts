/**
 * API 키 없이 Claude 웹/앱(구독)으로 요약하는 경로.
 * 1) 요청문을 만들어 claude.ai/new 에 채워 연다  2) Claude 의 답(JSON 코드 블록)을 붙여넣으면 메모로 저장한다.
 */
import { CATEGORIES } from "./categories";
import { MemoContentSchema } from "./schema";
import { LANG_NAME, type Lang } from "./i18n";
import type { CaptureRequest, MemoContent, MemoKind } from "./types";

export const PENDING_IMPORT_KEY = "memo-pending-import";

export interface PendingImport {
  kind: MemoKind;
  input?: string;
  image?: string;
  note?: string;
  lang: Lang;
  at: number;
}

export function savePendingImport(p: PendingImport) {
  try {
    window.localStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(p));
  } catch {
    /* 사진이 커서 못 넣으면 사진 없이 */
    try {
      window.localStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify({ ...p, image: undefined }));
    } catch {
      /* ignore */
    }
  }
}
export function readPendingImport(): PendingImport | null {
  try {
    const raw = window.localStorage.getItem(PENDING_IMPORT_KEY);
    return raw ? (JSON.parse(raw) as PendingImport) : null;
  } catch {
    return null;
  }
}
export function clearPendingImport() {
  try {
    window.localStorage.removeItem(PENDING_IMPORT_KEY);
  } catch {
    /* ignore */
  }
}

const SCHEMA_HINT = (lang: Lang) =>
  JSON.stringify(
    {
      app: "gist",
      kind: "book | youtube | photo",
      title: "...",
      category: CATEGORIES.map((c) => c.id).join(" | "),
      tags: ["...", "..."],
      oneLiner: "...",
      summary: "2~5 paragraphs separated by blank lines. Wrap the most important phrases in **double asterisks** (1-2 per paragraph).",
      keyPoints: ["4-8 items, **key phrase** allowed"],
      quotes: [{ text: "verbatim quote", note: "source / original text or null" }],
      meta: { author: null, publisher: null, year: null, channel: null, duration: null },
      confidence: "high | medium | low",
    },
    null,
    1,
  ).replace(/\n\s*/g, " ") + `  (category: ${CATEGORIES.map((c) => `${c.id}=${c.label[lang]}`).join(", ")})`;

/** claude.ai 에 붙여넣을 요청문 */
export function buildClaudePrompt(req: CaptureRequest, lang: Lang): string {
  const L = LANG_NAME[lang];
  const target =
    req.kind === "youtube"
      ? `YouTube video: ${req.input}\nFind out what this video actually says (read the page, search for summaries/transcripts).`
      : req.kind === "book"
        ? `Book: "${req.input}"\nIdentify the exact book (title, author, publisher, year). Summarize its key ideas and structure. Collect 5-10 memorable quotes that you are confident are real (translated to ${L}; original text in note).`
        : `The attached photo.${req.note ? ` My note: "${req.note}".` : ""}\nIf it contains text (book page, document, slide, screenshot), read it and summarize; put sentences worth keeping verbatim into quotes. If not, describe what it shows and why it matters.`;
  return `You are writing a reading note for my personal memo app. Write everything in ${L}.

${target}

Rules
- Be faithful to the source; do not invent. Only include quotes you are sure exist.
- In "summary" and "keyPoints", wrap the most important phrases in **double asterisks** (about 1-2 per paragraph, under 20% of the text). No other markdown inside the fields.
- "oneLiner" is one plain sentence. "title" is short. Pick exactly one "category".

Reply with ONLY one JSON code block (\`\`\`json ... \`\`\`) in this shape, nothing else:
${SCHEMA_HINT(lang)}`;
}

/** claude.ai 새 대화에 요청문을 채워 여는 주소 */
export function claudeNewUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

export interface ParsedReply {
  content: MemoContent;
  kind?: MemoKind;
}

/** 붙여넣은 글이 Claude 의 답(JSON)인지 빠르게 판별 */
export function looksLikeClaudeReply(text: string): boolean {
  const t = text.trim();
  return t.includes("{") && /"summary"\s*:/.test(t) && /"oneLiner"\s*:/.test(t);
}

/** Claude 의 답에서 JSON 을 꺼내 검증한다. 코드 펜스·앞뒤 설명은 무시 */
export function parseClaudeReply(text: string): ParsedReply | { error: string } {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return { error: "no-json" };
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(s, e + 1));
  } catch {
    // 흔한 실수: 뒤따르는 쉼표, 스마트 따옴표
    try {
      raw = JSON.parse(
        text
          .slice(s, e + 1)
          .replace(/[“”]/g, '"')
          .replace(/,\s*([}\]])/g, "$1"),
      );
    } catch {
      return { error: "bad-json" };
    }
  }
  const obj = raw as Record<string, unknown>;
  // 느슨하게 보정: quotes 가 문자열 배열이면 객체로, meta 누락이면 채움
  if (Array.isArray(obj.quotes)) obj.quotes = obj.quotes.map((q) => (typeof q === "string" ? { text: q, note: null } : { note: null, ...(q as object) }));
  if (!obj.meta || typeof obj.meta !== "object") obj.meta = {};
  obj.meta = { author: null, publisher: null, year: null, channel: null, duration: null, ...(obj.meta as object) };
  if (!Array.isArray(obj.tags)) obj.tags = [];
  if (!Array.isArray(obj.keyPoints)) obj.keyPoints = [];
  if (!Array.isArray(obj.quotes)) obj.quotes = [];
  if (!["high", "medium", "low"].includes(String(obj.confidence))) obj.confidence = "medium";
  if (!CATEGORIES.some((c) => c.id === obj.category)) obj.category = "etc";
  const parsed = MemoContentSchema.safeParse(obj);
  if (!parsed.success) return { error: "schema:" + parsed.error.issues.map((i) => i.path.join(".")).join(",") };
  const kind = ["book", "youtube", "photo"].includes(String(obj.kind)) ? (obj.kind as MemoKind) : undefined;
  return { content: parsed.data, kind };
}
