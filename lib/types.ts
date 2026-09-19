export type MemoKind = "youtube" | "book" | "photo";

export type CategoryId =
  | "work"
  | "business"
  | "self"
  | "humanities"
  | "science"
  | "history"
  | "arts"
  | "health"
  | "society"
  | "education"
  | "etc";

export interface Quote {
  /** 명대사 · 명문장 본문 */
  text: string;
  /** 출처·맥락·원문 등 짧은 설명 (없으면 null) */
  note: string | null;
}

export interface MemoMeta {
  author: string | null;
  publisher: string | null;
  year: string | null;
  channel: string | null;
  duration: string | null;
}

/** Claude가 생성하는 요약 본문 (구조화 출력) */
export interface MemoContent {
  title: string;
  category: CategoryId;
  tags: string[];
  oneLiner: string;
  summary: string;
  keyPoints: string[];
  quotes: Quote[];
  meta: MemoMeta;
  confidence: "high" | "medium" | "low";
}

export interface MemoSource {
  /** 유튜브: 원본 URL */
  url?: string;
  videoId?: string;
  thumbnail?: string;
  /** 책: 사용자가 입력한 검색어 */
  query?: string;
  /** 사진: 저장된 파일 이름 */
  image?: string;
  /** 사진에 덧붙인 사용자 메모 */
  note?: string;
  /** 유튜브 자막을 실제로 읽었는지 */
  transcript?: boolean;
}

export interface Memo extends MemoContent {
  id: string;
  kind: MemoKind;
  createdAt: string;
  updatedAt: string;
  source: MemoSource;
  /** 어떤 모델이 요약했는지 (표시용) */
  model?: string;
  /** 요약 아래에 사용자가 직접 적는 생각 */
  thoughts?: string;
}

/** /api/capture 가 NDJSON으로 흘려보내는 이벤트 */
export type CaptureEvent =
  | { type: "stage"; id: string; label: string }
  | { type: "done"; memo: Memo }
  | { type: "duplicate"; memo: Memo }
  | { type: "error"; message: string };

export interface CaptureRequest {
  kind: MemoKind;
  /** youtube: URL, book: 제목(+저자) */
  input?: string;
  /** photo: 덧붙일 메모 */
  note?: string;
  /** photo: data URL (image/jpeg|png|webp|gif) */
  image?: string;
  /** 기존 메모를 다시 요약해 내용을 교체할 때 그 메모의 id */
  replace?: string;
  /** 요약을 쓸 언어 (UI 언어를 따른다) */
  lang?: "ko" | "en" | "ja";
}
