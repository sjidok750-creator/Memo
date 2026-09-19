/**
 * 글귀 메모: 사용자가 직접 적어 그대로 보관하는 명언·좋은 문장.
 * Claude 를 거치지 않으므로 네트워크도 API 키도 필요 없고 바로 저장된다.
 */
import { EMPTY_META } from "./schema";
import type { Memo } from "./types";

/** 카드 제목으로 쓸 길이 (넘으면 잘라서 … ) */
const TITLE_MAX = 40;

/** 글 전체를 감싼 따옴표는 장식이라 떼어 낸다 (제목과 본문이 어긋나는 것을 막는다) */
function unwrapQuotes(text: string): string {
  const m = /^(["'“”‘’「『])([\s\S]+)(["'“”‘’」』])$/.exec(text.trim());
  if (!m) return text.trim();
  const inner = m[2].trim();
  // 안쪽에 또 따옴표가 있으면 원문 그대로 둔다 (대화문 등)
  return /^["'“”‘’「『]/.test(inner) ? text.trim() : inner;
}

/** 마지막 줄이 출처처럼 보이면 떼어 낸다 ("— 니체", "- 니체", "출처: …", "by …") */
export function splitSource(raw: string): { body: string; from: string | null } {
  const text = raw.trim();
  const lines = text.split("\n");
  if (lines.length < 2) return { body: text, from: null };
  const last = lines[lines.length - 1].trim();
  const m = /^(?:[-–—]+\s*|출처\s*[:：]\s*|by\s+|出典\s*[:：]\s*)(.+)$/i.exec(last);
  if (!m || m[1].length > 80) return { body: text, from: null };
  return { body: lines.slice(0, -1).join("\n").trim(), from: m[1].trim() };
}

/** 글 첫머리로 카드 제목을 만든다 */
export function noteTitle(body: string): string {
  const first = body.split("\n").find((l) => l.trim()) ?? body;
  const line = first.trim().replace(/^["'“”‘’「『]+/, "");
  if (line.length <= TITLE_MAX) return line.replace(/["'“”‘’」』]+$/, "");
  // 글자 수 안에서 문장이 끝나면 거기까지
  const cut = line.slice(0, TITLE_MAX);
  const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("。"), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return stop > TITLE_MAX * 0.5 ? cut.slice(0, stop + 1) : `${cut.trim()}…`;
}

export function newNoteId(): string {
  return `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 적은 글(+사진)을 그대로 메모로 만든다 */
export function buildNoteMemo(input: { text: string; image?: string; fallbackTitle: string }): Memo {
  const { body: raw, from } = splitSource(input.text);
  const body = unwrapQuotes(raw);
  const now = new Date().toISOString();
  return {
    id: newNoteId(),
    kind: "note",
    createdAt: now,
    updatedAt: now,
    title: noteTitle(body) || input.fallbackTitle,
    category: "etc",
    tags: [],
    oneLiner: from ?? "",
    summary: body,
    keyPoints: [],
    quotes: [],
    meta: { ...EMPTY_META, author: from ?? null },
    confidence: "high",
    source: { image: input.image, from: from ?? undefined },
    model: "me",
  };
}
