import { NextRequest } from "next/server";
import { CaptureError, runCapture } from "@/lib/capture";
import type { CaptureEvent, CaptureRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** NDJSON 스트림으로 진행 상황과 결과를 흘려보낸다 */
export async function POST(req: NextRequest) {
  let body: CaptureRequest;
  try {
    body = (await req.json()) as CaptureRequest;
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: CaptureEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const { memo, duplicate } = await runCapture(body, send, req.signal);
        send(duplicate ? { type: "duplicate", memo } : { type: "done", memo });
      } catch (err) {
        const message = err instanceof CaptureError ? err.message : describeError(err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

function describeError(err: unknown): string {
  const e = err as { status?: number; message?: string; name?: string };
  if (e?.name === "AbortError") return "취소되었습니다.";
  if (e?.status === 401) return "API 키가 올바르지 않습니다. ANTHROPIC_API_KEY 를 확인하세요.";
  if (e?.status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도하세요.";
  if (e?.status && e.status >= 500) return "Claude 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도하세요.";
  return e?.message ? `요약에 실패했습니다: ${e.message}` : "요약에 실패했습니다.";
}
