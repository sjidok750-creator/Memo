import { NextRequest } from "next/server";
import { CaptureError, runCapture } from "@/lib/capture";
import type { CaptureEvent, CaptureRequest } from "@/lib/types";
import { friendlyError } from "@/lib/errors";

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
        const message = err instanceof CaptureError ? err.message : friendlyError(err);
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
