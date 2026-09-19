import { NextRequest } from "next/server";
import { MemoContentSchema } from "@/lib/schema";
import { importMemos, listMemos, readImageAsDataUrl } from "@/lib/store";
import type { Memo } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 모든 메모를 사진까지 포함한 JSON 하나로 내려준다 */
export async function GET() {
  const memos = await listMemos();
  const out = [];
  for (const m of memos) {
    const source: Memo["source"] & { imageData?: string } = { ...m.source };
    if (m.source.image) {
      const data = await readImageAsDataUrl(m.source.image);
      if (data) source.imageData = data;
      delete source.image;
    }
    out.push({ ...m, source });
  }
  const body = JSON.stringify({ app: "memo", version: 1, exportedAt: new Date().toISOString(), memos: out }, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="memo-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/** 백업 JSON 을 받아 합친다 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { memos?: unknown } | null;
  if (!body || !Array.isArray(body.memos)) return Response.json({ error: "백업 파일 형식이 아닙니다." }, { status: 400 });
  const valid: Memo[] = [];
  for (const raw of body.memos as Partial<Memo>[]) {
    if (!raw || typeof raw.id !== "string" || !["youtube", "book", "photo"].includes(raw.kind ?? "")) continue;
    const content = MemoContentSchema.safeParse(raw);
    if (!content.success) continue;
    valid.push({
      ...content.data,
      id: raw.id,
      kind: raw.kind as Memo["kind"],
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
      source: typeof raw.source === "object" && raw.source ? raw.source : {},
      model: typeof raw.model === "string" ? raw.model : undefined,
    });
  }
  const result = await importMemos(valid);
  return Response.json({ ...result, invalid: (body.memos as unknown[]).length - valid.length });
}
