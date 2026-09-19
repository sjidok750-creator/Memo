"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";
import { useMemos } from "./MemoProvider";
import { BrandMark } from "./Icons";

export function Sidebar() {
  const { memos, category, setCategory, health, lang, t } = useMemos();
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
        <BrandMark size={34} id="side" />
        <span>
          <div className="brand-name">Gist</div>
          <div className="brand-sub">{t("brand.tagline")}</div>
        </span>
      </Link>

      <div className="nav-title">{t("nav.fields")}</div>
      <nav className="nav" aria-label={t("nav.fields")}>
        <button className={`nav-item ${category === "all" && pathname === "/" ? "active" : ""}`} onClick={() => pick("all")}>
          <span className="dot" style={{ "--c": "var(--accent)" } as React.CSSProperties} />
          {t("nav.all")}
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
              {c.label[lang]}
              <span className="count">{n || ""}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        {health === null ? (
          <span>{t("status.checking")}</span>
        ) : health.apiKey ? (
          <>
            <span className="status-dot" />
            <span>{health.model === "demo" ? t("status.demo") : health.mock ? t("status.mock") : t("status.connected", { model: health.model })}</span>
          </>
        ) : (
          <>
            <span className="status-dot bad" />
            <span>{t("status.needKey")}</span>
          </>
        )}
      </div>
    </aside>
  );
}
