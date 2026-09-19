"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MemoDetail } from "@/components/MemoDetail";

/** 정적 내보내기(데모)용 상세 화면: /memo/view?id=... */
function View() {
  const id = useSearchParams().get("id") ?? "";
  return <MemoDetail id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="notfound">불러오는 중…</div>}>
      <View />
    </Suspense>
  );
}
