import { isUrlLike, parseYouTubeId } from "./youtube";

export type Detected =
  | { kind: "empty" }
  | { kind: "youtube"; videoId: string }
  | { kind: "book"; query: string }
  | { kind: "unsupported-url" };

/** 입력창의 글자만 보고 무엇을 하려는지 알아낸다 */
export function detectInput(raw: string): Detected {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const videoId = parseYouTubeId(text);
  if (videoId) return { kind: "youtube", videoId };
  if (isUrlLike(text)) return { kind: "unsupported-url" };
  return { kind: "book", query: text };
}
