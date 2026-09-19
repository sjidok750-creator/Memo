import type { CategoryId } from "./types";
import type { Lang } from "./i18n";

export interface Category {
  id: CategoryId;
  label: Record<Lang, string>;
  /** 칩·점 색상 (라이트) */
  color: string;
  /** 다크 모드 색상 */
  dark: string;
}

export const CATEGORIES: Category[] = [
  { id: "work", label: { ko: "업무", en: "Work", ja: "仕事" }, color: "#4338CA", dark: "#A5A6FF" },
  { id: "business", label: { ko: "경제·경영", en: "Business", ja: "経済・経営" }, color: "#B45309", dark: "#F0A24B" },
  { id: "self", label: { ko: "자기계발", en: "Self-growth", ja: "自己啓発" }, color: "#0F766E", dark: "#4FD1C5" },
  { id: "humanities", label: { ko: "인문·철학", en: "Humanities", ja: "人文・哲学" }, color: "#6D28D9", dark: "#B69CFF" },
  { id: "science", label: { ko: "과학·기술", en: "Science & Tech", ja: "科学・技術" }, color: "#1D4ED8", dark: "#7FA8FF" },
  { id: "history", label: { ko: "역사", en: "History", ja: "歴史" }, color: "#92400E", dark: "#D9A066" },
  { id: "arts", label: { ko: "문학·예술", en: "Arts & Literature", ja: "文学・芸術" }, color: "#BE185D", dark: "#F27EB1" },
  { id: "health", label: { ko: "건강·라이프", en: "Health & Life", ja: "健康・生活" }, color: "#15803D", dark: "#6FCF8A" },
  { id: "society", label: { ko: "사회·정치", en: "Society & Politics", ja: "社会・政治" }, color: "#B91C1C", dark: "#F08A8A" },
  { id: "education", label: { ko: "교육·학습", en: "Education", ja: "教育・学習" }, color: "#0369A1", dark: "#67B8E8" },
  { id: "etc", label: { ko: "기타", en: "Other", ja: "その他" }, color: "#57534E", dark: "#B8B2A7" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function categoryLabel(id: string, lang: Lang): string {
  return categoryOf(id).label[lang];
}

/** Claude 에게 주는 분야 설명 */
export const CATEGORY_GUIDE = CATEGORIES.map((c) => `${c.id}=${c.label.ko}(${c.label.en})`).join(", ");
