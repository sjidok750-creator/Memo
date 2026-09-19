import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/lib/store";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9]+\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return new Response("bad name", { status: 400 });
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": TYPES[ext], "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
