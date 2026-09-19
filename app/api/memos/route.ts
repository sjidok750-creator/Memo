import { listMemos } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ memos: await listMemos() }, { headers: { "Cache-Control": "no-store" } });
}
