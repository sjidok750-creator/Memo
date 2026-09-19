import { translate, type Lang } from "./i18n";

/** API 오류 본문(JSON 문자열)에서 사람이 읽을 메시지만 꺼낸다 */
function apiMessage(raw: string): string {
  const s = raw.replace(/^\d{3}\s*/, "").trim();
  try {
    const j = JSON.parse(s.slice(s.indexOf("{"))) as { error?: { message?: string }; message?: string };
    return j.error?.message ?? j.message ?? s;
  } catch {
    return s;
  }
}

/** SDK·네트워크 오류를 사용자에게 보여줄 문장으로 (UI 언어에 맞춰) */
export function friendlyError(err: unknown, lang: Lang = "ko"): string {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const e = err as { status?: number; message?: string; name?: string };
  const msg = apiMessage(e?.message ?? "");
  if (e?.name === "AbortError") return t("err.cancelled");
  if (/credit balance/i.test(msg)) return t("err.credit");
  if (e?.status === 401) return t("err.auth");
  if (e?.status === 403) return t("err.perm");
  if (e?.status === 429 || /rate limit/i.test(msg)) return t("err.rate");
  if (e?.status === 400) return t("err.rejected", { msg: msg.slice(0, 200) });
  if (e?.status === 529 || (e?.status && e.status >= 500) || /overloaded/i.test(msg)) return t("err.server");
  if (e?.name === "APIConnectionError" || /fetch failed|Failed to fetch|NetworkError|Load failed/i.test(msg)) return t("err.network");
  return msg ? t("err.generic", { msg: msg.slice(0, 300) }) : t("err.unknown");
}
