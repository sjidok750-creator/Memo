"use client";

import { useMemo, useRef, useState } from "react";
import type { Memo } from "@/lib/types";
import { categoryOf } from "@/lib/categories";
import { stripMarks } from "@/lib/richtext";
import type { MemoKind } from "@/lib/types";
import { Capture } from "./Capture";
import { MemoCard } from "./MemoCard";
import { useMemos } from "./MemoProvider";
import { IconDownload, IconSearch, IconUpload } from "./Icons";
import { DEMO } from "@/lib/demo";
import { clientStore } from "@/lib/store-client";
import { Connect } from "./Connect";
import { LangSwitch } from "./LangSwitch";
import { useEffect } from "react";
import { useReplyImport } from "./useReplyImport";
import { ActionSheet } from "./ActionSheet";

const KINDS: (MemoKind | "all")[] = ["all", "youtube", "book", "photo"];

export function Home() {
  const { memos, loading, category, kind, setKind, query, setQuery, health, refresh, toast, lang, t, synced } = useMemos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Memo | null>(null);
  const importReply = useReplyImport();

  // iOS 단축어 등에서 #import=<답> 또는 ?import=<답> 으로 열면 바로 저장한다
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("import");
    const fromQuery = new URLSearchParams(window.location.search).get("import");
    const raw = fromHash ?? fromQuery;
    if (!raw) return;
    window.history.replaceState(null, "", window.location.pathname);
    void importReply(raw).then((ok) => {
      if (!ok) toast(t("app.invalid"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sheetMemo = sheet ? (memos.find((m) => m.id === sheet.id) ?? null) : null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memos.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (kind !== "all" && m.kind !== kind) return false;
      if (!q) return true;
      const hay = [m.title, m.oneLiner, stripMarks(m.summary), m.tags.join(" "), m.meta.author ?? "", m.meta.channel ?? "", m.thoughts ?? ""].join("\n").toLowerCase();
      return hay.includes(q);
    });
  }, [memos, category, kind, query]);

  const onExport = async () => {
    if (!DEMO) {
      window.location.href = "/api/backup";
      return;
    }
    const blob = new Blob([await clientStore.exportAll(lang)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gist-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { memos?: Memo[] };
      if (!Array.isArray(parsed.memos)) throw new Error(t("backup.badFile"));
      let result: { added: number; skipped: number };
      if (DEMO) result = await clientStore.importAll(parsed.memos, lang);
      else {
        const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || t("backup.failed"));
        result = (await res.json()) as { added: number; skipped: number };
      }
      await refresh();
      toast(t("backup.done", { added: result.added }) + (result.skipped ? t("backup.skipped", { skipped: result.skipped }) : ""));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const heading = category === "all" ? t("home.all") : categoryOf(category).label[lang];
  const hour = new Date().getHours();
  const greet = hour < 5 ? t("greet.night") : hour < 12 ? t("greet.morning") : hour < 18 ? t("greet.afternoon") : t("greet.evening");

  return (
    <>
      <header className="home-head">
        <div>
          <div className="eyebrow">{greet}</div>
          <h1 className="home-title">{t("home.title")}</h1>
        </div>
        <LangSwitch />
      </header>

      {DEMO && !synced && <Connect />}

      {health && !health.apiKey && (
        <div className="banner">
          <span
            dangerouslySetInnerHTML={{
              __html: t("home.needKey", { file: "<code>.env.local</code>", env: "<code>ANTHROPIC_API_KEY=sk-ant-...</code>" }),
            }}
          />
        </div>
      )}

      <Capture />

      <div className="toolbar">
        <h2>
          {heading} <span className="n">{t("home.count", { n: visible.length })}</span>
        </h2>
        <div className="toolbar-right">
          <label className="search">
            <IconSearch size={15} />
            <input type="search" placeholder={t("home.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="seg" role="tablist">
            {KINDS.map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                {k === "all" ? t("nav.all") : t(`kind.${k}`)}
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
              <strong>{t("home.emptyTitle")}</strong>
              {t("home.emptyBody")}
            </>
          ) : (
            <>
              <strong>{t("home.noMatchTitle")}</strong>
              {t("home.noMatchBody")}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid">
            {visible.map((m, i) => (
              <MemoCard key={m.id} memo={m} index={i} onMenu={setSheet} />
            ))}
          </div>
          <div className="grid-hint">{t("sheet.hint")}</div>
        </>
      )}
      {sheetMemo && <ActionSheet memo={sheetMemo} onClose={() => setSheet(null)} />}

      <div className="backup-row">
        <span>{t("backup.label")}</span>
        <button className="link-btn" onClick={() => void onExport()} disabled={memos.length === 0}>
          <IconDownload size={13} /> {t("backup.export")}
        </button>
        <button className="link-btn" onClick={() => fileRef.current?.click()}>
          <IconUpload size={13} /> {t("backup.import")}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
      </div>
    </>
  );
}
