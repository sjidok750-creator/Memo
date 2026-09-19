import type { Memo, MemoKind } from "./types";
import { stripMarks } from "./richtext";
import { categoryLabel } from "./categories";
import { localeOf, translate, type Lang } from "./i18n";

export function kindLabel(kind: MemoKind, lang: Lang): string {
  return translate(lang, `kind.${kind}`);
}

export function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(localeOf(lang), { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateShort(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(localeOf(lang), sameYear ? { month: "short", day: "numeric" } : { year: "2-digit", month: "short", day: "numeric" });
}

/** 메모 한 장을 마크다운으로 (복사용) */
export function memoToMarkdown(m: Memo, lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const lines: string[] = [];
  lines.push(`# ${m.title}`);
  const src: string[] = [kindLabel(m.kind, lang), categoryLabel(m.category, lang), formatDate(m.createdAt, lang)];
  if (m.meta.author) src.push(m.meta.author);
  if (m.meta.channel) src.push(m.meta.channel);
  if (m.source.url) src.push(m.source.url);
  lines.push(`> ${src.join(" · ")}`, "");
  lines.push(`**${t("md.oneLiner")}** ${m.oneLiner}`, "");
  lines.push(`## ${t("detail.summary")}`, "", m.summary, "");
  if (m.keyPoints.length) lines.push(`## ${t("detail.points")}`, "", ...m.keyPoints.map((p) => `- ${p}`), "");
  if (m.quotes.length) {
    lines.push(`## ${t(`detail.quotes.${m.kind}`)}`, "");
    for (const q of m.quotes) lines.push(`> ${stripMarks(q.text)}`, ...(q.note ? [`> — ${q.note}`] : []), "");
  }
  if (m.tags.length) lines.push(m.tags.map((x) => `#${x}`).join(" "));
  return lines.join("\n");
}
