/**
 * 브라우저 모드(정적 배포)에서 쓰는 사용자 본인의 Claude API 키.
 * 이 기기의 localStorage 에만 저장되고 api.anthropic.com 으로만 전송된다.
 */
const KEY = "memo-claude-api-key";
export const KEY_EVENT = "memo-key-change";

export function getBrowserApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setBrowserApiKey(key: string | null): void {
  try {
    if (key) window.localStorage.setItem(KEY, key);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(KEY_EVENT));
}

export function isBrowserConnected(): boolean {
  return Boolean(getBrowserApiKey());
}
