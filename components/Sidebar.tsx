"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";
import { useMemos } from "./MemoProvider";
import { IconNote } from "./Icons";

export function Sidebar() {
  const { memos, category, setCategory, health } = useMemos();
  const pathname = usePathname();
  const router = useRouter();

  const counts = memos.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + 1;
    return acc;
  }, {});

  const pick = (c: CategoryId | "all") => {
    setCategory(c);
    if (pathname !== "/") router.push("/");
  };

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" onClick={() => setCategory("all")}>
        <span className="brand-mark">
          <IconNote size={17} />
        </span>
        <span>
          <div className="brand-name">나만의 메모장</div>
          <div className="brand-sub">보고 읽은 것을 핵심만</div>
        </span>
      </Link>

      <div className="nav-title">분야</div>
      <nav className="nav" aria-label="분야">
        <button className={`nav-item ${category === "all" && pathname === "/" ? "active" : ""}`} onClick={() => pick("all")}>
          <span className="dot" style={{ "--c": "var(--accent)" } as React.CSSProperties} />
          전체
          <span className="count">{memos.length}</span>
        </button>
        {CATEGORIES.map((c) => {
          const n = counts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              className={`nav-item ${category === c.id && pathname === "/" ? "active" : ""} ${n === 0 ? "dim" : ""}`}
              onClick={() => pick(c.id)}
              style={{ "--c": `light-dark(${c.color}, ${c.dark})` } as React.CSSProperties}
            >
              <span className="dot" />
              {c.label}
              <span className="count">{n || ""}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        {health === null ? (
          <span>연결 확인 중…</span>
        ) : health.apiKey ? (
          <>
            <span className="status-dot" />
            <span>Claude · {health.mock ? "예시 모드" : health.model}</span>
          </>
        ) : (
          <>
            <span className="status-dot bad" />
            <span>API 키 필요</span>
          </>
        )}
      </div>
    </aside>
  );
}
