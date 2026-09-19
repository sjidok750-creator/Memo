import { isUrlLike, parseYouTubeId } from "./youtube";
import { looksLikeClaudeReply } from "./claude-app";

export type Detected =
  | { kind: "empty" }
  | { kind: "youtube"; videoId: string }
  | { kind: "book"; query: string }
  | { kind: "note"; text: string }
  | { kind: "unsupported-url" }
  | { kind: "import" };

/** 입력창의 글자만 보고 무엇을 하려는지 알아낸다 */
export function detectInput(raw: string): Detected {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (looksLikeClaudeReply(text)) return { kind: "import" };
  const videoId = parseYouTubeId(text);
  if (videoId) return { kind: "youtube", videoId };
  if (isUrlLike(text)) return { kind: "unsupported-url" };
  if (looksLikePassage(text)) return { kind: "note", text };
  return { kind: "book", query: text };
}

/**
 * 제목·이름이 아니라 "적어 둘 글" 로 보이는지.
 * 줄이 여럿이거나, 길거나, 따옴표로 감쌌거나, 문장으로 끝나면 글귀로 본다.
 * 어림짐작이라 틀릴 수 있으므로 화면에서 언제든 바꿀 수 있게 해 둔다.
 */
export function looksLikePassage(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  if (text.includes("\n")) return true;
  if (text.length >= 40) return true;
  if (/^["'“”‘’「『].*["'“”‘’」』]$/s.test(text)) return true;
  return /[.!?。！？…]$/.test(text) && text.length >= 15;
}
