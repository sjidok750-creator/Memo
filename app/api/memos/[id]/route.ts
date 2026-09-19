import { NextRequest } from "next/server";
import { CATEGORY_IDS } from "@/lib/categories";
import { deleteMemo, getMemo, updateMemo } from "@/lib/store";
import type { Memo } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const memo = await getMemo(id);
  if (!memo) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ memo }, { headers: { "Cache-Control": "no-store" } });
}

/** 사용자가 직접 고칠 수 있는 필드만 받는다 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Memo>;
  const patch: Partial<Memo> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body.category === "string" && (CATEGORY_IDS as string[]).includes(body.category)) patch.category = body.category;
  if (Array.isArray(body.tags)) patch.tags = body.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 12);
  if (!Object.keys(patch).length) return Response.json({ error: "no valid fields" }, { status: 400 });
  const memo = await updateMemo(id, patch);
  if (!memo) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ memo });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const removed = await deleteMemo(id);
  if (!removed) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
