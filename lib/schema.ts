import { z } from "zod";
import { CATEGORY_GUIDE, CATEGORY_IDS } from "./categories";
import type { MemoMeta } from "./types";

/**
 * meta 의 빈 값. 스키마에 항목을 더해도 예전 백업·Claude 답이 검증에 걸리지 않도록
 * 받아들이는 쪽에서 항상 이걸 깔고 덮어쓴다.
 */
export const EMPTY_META: MemoMeta = { author: null, publisher: null, year: null, channel: null, duration: null, isbn: null };

/** Claude 구조화 출력 스키마. MemoContent 와 1:1 로 대응한다. */
export const MemoContentSchema = z.object({
  title: z.string().describe("메모 제목. 책은 정확한 책 제목, 영상은 내용을 압축한 제목, 사진은 내용을 한눈에 알 수 있는 제목"),
  category: z.enum(CATEGORY_IDS).describe(`분야. ${CATEGORY_GUIDE}. work 는 회사 일·직무·프로젝트·커리어 등 업무와 직접 관련된 내용`),
  tags: z.array(z.string()).describe("핵심 키워드 3~6개. 짧은 명사형"),
  oneLiner: z.string().describe("전체를 한 문장으로 정리한 '한 줄 정리'. 강조 마크 없이 순수 텍스트"),
  summary: z
    .string()
    .describe(
      "핵심 요약. 2~5개 문단, 문단 사이는 빈 줄. 가장 중요한 구절·문장은 **이렇게** 감싸서 강조 (문단마다 1~2곳, 전체의 20% 이하). 다른 마크다운 문법은 쓰지 않는다",
    ),
  keyPoints: z.array(z.string()).describe("주요 포인트 4~8개. 각 항목은 한두 문장이며 핵심어는 **이렇게** 강조 가능"),
  quotes: z
    .array(
      z.object({
        text: z.string().describe("명대사·명문장 본문. 원문에 충실하게. 외국어 원문은 한국어로 옮기되 자연스럽게"),
        note: z.string().nullable().describe("출처·맥락·원문(외국어) 등 짧은 설명. 없으면 null"),
      }),
    )
    .describe("명대사·명문장 발췌. 책은 5~10개, 영상은 인상적인 발언 0~5개, 사진은 텍스트에서 발췌 가능한 문장 0~5개. 확신이 없는 인용은 넣지 않는다"),
  meta: z.object({
    author: z.string().nullable().describe("저자 (책) / 발화자 (영상). 모르면 null"),
    publisher: z.string().nullable().describe("출판사. 모르면 null"),
    year: z.string().nullable().describe("출간·게시 연도. 모르면 null"),
    channel: z.string().nullable().describe("유튜브 채널명. 해당 없으면 null"),
    duration: z.string().nullable().describe("영상 길이 등. 해당 없으면 null"),
    isbn: z.string().nullable().describe("책의 ISBN (13자리 우선, 하이픈 없이). 표지를 찾는 데 쓴다. 책이 아니거나 확실하지 않으면 null"),
  }),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("요약의 신뢰도. 원문(자막·이미지)을 직접 읽었으면 high, 검색 결과 기반이면 medium, 기억에만 의존했으면 low"),
});

export type MemoContentParsed = z.infer<typeof MemoContentSchema>;
