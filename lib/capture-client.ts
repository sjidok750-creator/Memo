import type { CaptureEvent, CaptureRequest } from "./types";

/** /api/capture 의 NDJSON 스트림을 읽어 이벤트마다 콜백을 부른다. done/duplicate/error 로 끝난다. */
export async function captureStream(req: CaptureRequest, onEvent: (e: CaptureEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `서버 오류 (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let finished = false;
  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as CaptureEvent;
      if (ev.type === "error") throw new Error(ev.message);
      onEvent(ev);
      if (ev.type === "done" || ev.type === "duplicate") finished = true;
    }
  }
  if (!finished) throw new Error("연결이 끊겼습니다. 다시 시도해 주세요.");
}
