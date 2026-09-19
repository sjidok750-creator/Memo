/** SDK·네트워크 오류를 사용자에게 보여줄 문장으로 */
export function friendlyError(err: unknown): string {
  const e = err as { status?: number; message?: string; name?: string };
  if (e?.name === "AbortError") return "취소되었습니다.";
  if (e?.status === 401) return "API 키가 올바르지 않습니다. 키를 확인해 주세요.";
  if (e?.status === 403) return "이 키로는 접근할 수 없습니다 (권한 부족).";
  if (e?.status === 400) return `요청이 거부되었습니다: ${(e.message ?? "").replace(/^\d+\s*/, "").slice(0, 200)}`;
  if (e?.status === 429) return "요청이 너무 많거나 사용량 한도에 닿았습니다. 잠시 후 다시 시도하세요.";
  if (e?.status === 529 || (e?.status && e.status >= 500)) return "Claude 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도하세요.";
  if (e?.name === "APIConnectionError" || /fetch failed|Failed to fetch|NetworkError/i.test(e?.message ?? "")) return "Anthropic 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.";
  return e?.message ? `요약에 실패했습니다: ${e.message.slice(0, 300)}` : "요약에 실패했습니다.";
}
