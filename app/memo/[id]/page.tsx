import { MemoDetail } from "@/components/MemoDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemoDetail id={id} />;
}
