import { hasApiKey, MOCK, MODEL } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, apiKey: hasApiKey(), mock: MOCK, model: MOCK ? "mock" : MODEL });
}
