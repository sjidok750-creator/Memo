import type { Memo, MemoKind } from "./types";
import { stripMarks } from "./richtext";
import { categoryOf } from "./categories";

export const KIND_LABEL: Record<MemoKind, string> = { youtube: "유튜브", book: "책", photo: "사진" };

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("ko-KR", sameYear ? { month: "short", day: "numeric" } : { year: "2-digit", month: "short", day: "numeric" });
}

/** 메모 한 장을 마크다운으로 (복사용) */
export function memoToMarkdown(m: Memo): string {
  const lines: string[] = [];
  lines.push(`# ${m.title}`);
  const src: string[] = [`${KIND_LABEL[m.kind]}`, categoryOf(m.category).label, formatDate(m.createdAt)];
  if (m.meta.author) src.push(m.meta.author);
  if (m.meta.channel) src.push(m.meta.channel);
  if (m.source.url) src.push(m.source.url);
  lines.push(`> ${src.join(" · ")}`, "");
  lines.push(`**한 줄 정리** ${m.oneLiner}`, "");
  lines.push("## 핵심 요약", "", m.summary, "");
  if (m.keyPoints.length) lines.push("## 주요 포인트", "", ...m.keyPoints.map((p) => `- ${p}`), "");
  if (m.quotes.length) {
    lines.push("## 명대사 · 명문장", "");
    for (const q of m.quotes) lines.push(`> ${stripMarks(q.text)}`, ...(q.note ? [`> — ${q.note}`] : []), "");
  }
  if (m.tags.length) lines.push(m.tags.map((t) => `#${t}`).join(" "));
  return lines.join("\n");
}
