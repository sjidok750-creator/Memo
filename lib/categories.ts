import type { CategoryId } from "./types";

export interface Category {
  id: CategoryId;
  label: string;
  /** 칩·점 색상 (라이트) */
  color: string;
  /** 다크 모드 색상 */
  dark: string;
}

export const CATEGORIES: Category[] = [
  { id: "business", label: "경제·경영", color: "#B45309", dark: "#F0A24B" },
  { id: "self", label: "자기계발", color: "#0F766E", dark: "#4FD1C5" },
  { id: "humanities", label: "인문·철학", color: "#6D28D9", dark: "#B69CFF" },
  { id: "science", label: "과학·기술", color: "#1D4ED8", dark: "#7FA8FF" },
  { id: "history", label: "역사", color: "#92400E", dark: "#D9A066" },
  { id: "arts", label: "문학·예술", color: "#BE185D", dark: "#F27EB1" },
  { id: "health", label: "건강·라이프", color: "#15803D", dark: "#6FCF8A" },
  { id: "society", label: "사회·정치", color: "#B91C1C", dark: "#F08A8A" },
  { id: "education", label: "교육·학습", color: "#0369A1", dark: "#67B8E8" },
  { id: "etc", label: "기타", color: "#57534E", dark: "#B8B2A7" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
