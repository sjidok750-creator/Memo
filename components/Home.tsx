"use client";

import { useMemo, useRef } from "react";
import type { Memo } from "@/lib/types";
import { categoryOf } from "@/lib/categories";
import { stripMarks } from "@/lib/richtext";
import type { MemoKind } from "@/lib/types";
import { Capture } from "./Capture";
import { MemoCard } from "./MemoCard";
import { useMemos } from "./MemoProvider";
import { IconDownload, IconSearch, IconUpload } from "./Icons";
import { DEMO, demoStore } from "@/lib/demo";
import { Connect } from "./Connect";

const KINDS: { id: MemoKind | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "youtube", label: "유튜브" },
  { id: "book", label: "책" },
  { id: "photo", label: "사진" },
];

export function Home() {
  const { memos, loading, category, kind, setKind, query, setQuery, health, refresh, toast } = useMemos();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memos.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (kind !== "all" && m.kind !== kind) return false;
      if (!q) return true;
      const hay = [m.title, m.oneLiner, stripMarks(m.summary), m.tags.join(" "), m.meta.author ?? "", m.meta.channel ?? ""].join("\n").toLowerCase();
      return hay.includes(q);
    });
  }, [memos, category, kind, query]);

  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    if (!DEMO) {
      window.location.href = "/api/backup";
      return;
    }
    const blob = new Blob([demoStore.exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `memo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { memos?: Memo[] };
      if (!Array.isArray(parsed.memos)) throw new Error("백업 파일 형식이 아니에요");
      let result: { added: number; skipped: number };
      if (DEMO) result = demoStore.importAll(parsed.memos);
      else {
        const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "가져오기에 실패했어요");
        result = (await res.json()) as { added: number; skipped: number };
      }
      await refresh();
      toast(`${result.added}개를 가져왔어요${result.skipped ? ` (이미 있는 ${result.skipped}개는 건너뜀)` : ""}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const heading = category === "all" ? "전체 메모" : categoryOf(category).label;
  const hour = new Date().getHours();
  const greet = hour < 5 ? "늦은 밤이에요" : hour < 12 ? "좋은 아침이에요" : hour < 18 ? "좋은 오후예요" : "좋은 저녁이에요";

  return (
    <>
      <header className="home-head">
        <div className="eyebrow">{greet}</div>
        <h1 className="home-title">오늘은 무엇을 기억해 둘까요?</h1>
      </header>

      {DEMO && <Connect />}
      {health && !health.apiKey && (
        <div className="banner">
          <span>
            아직 Claude 와 연결되지 않았어요. 프로젝트 폴더에 <code>.env.local</code> 파일을 만들고 <code>ANTHROPIC_API_KEY=sk-ant-...</code> 를 넣은 뒤 서버를 다시 시작하세요.
          </span>
        </div>
      )}

      <Capture />

      <div className="toolbar">
        <h2>
          {heading} <span className="n">{visible.length}개</span>
        </h2>
        <div className="toolbar-right">
          <label className="search">
            <IconSearch size={15} />
            <input type="search" placeholder="제목, 내용, 태그 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="seg" role="tablist" aria-label="종류">
            {KINDS.map((k) => (
              <button key={k.id} role="tab" aria-selected={kind === k.id} className={kind === k.id ? "on" : ""} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          {memos.length === 0 ? (
            <>
              <strong>아직 메모가 없어요</strong>
              위에 유튜브 링크나 책 제목을 넣어 첫 메모를 만들어 보세요. 사진은 끌어다 놓거나 붙여넣으면 됩니다.
            </>
          ) : (
            <>
              <strong>조건에 맞는 메모가 없어요</strong>
              다른 분야나 검색어로 찾아보세요.
            </>
          )}
        </div>
      ) : (
        <div className="grid">
          {visible.map((m, i) => (
            <MemoCard key={m.id} memo={m} index={i} />
          ))}
        </div>
      )}

      <div className="backup-row">
        <span>백업</span>
        <button className="link-btn" onClick={onExport} disabled={memos.length === 0}>
          <IconDownload size={13} /> JSON으로 내보내기
        </button>
        <button className="link-btn" onClick={() => fileRef.current?.click()}>
          <IconUpload size={13} /> 백업 파일 가져오기
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
      </div>
    </>
  );
}
