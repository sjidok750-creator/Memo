"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMemos } from "./MemoProvider";
import { BrandMark, IconCopy, IconX } from "./Icons";
import { DEMO } from "@/lib/demo";
import { MODEL } from "@/lib/claude";
import { ConnectKeyPanel, useClaudeConnection } from "./Connect";
import { syncShareUrl } from "@/lib/sync";

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
      <div className="brand-row">
      <Link href="/" className="brand" onClick={() => setCategory("all")}>
        <BrandMark size={34} id="side" />
        <span>
          <div className="brand-name">Gist</div>
          <div className="brand-sub">{t("brand.tagline")}</div>
        </span>
      </Link>
      <StatusPill />
      </div>

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

    </aside>
  );
}

/** 맨 위 이름 옆의 연결 상태. 누르면 연결 해제·예시 메모 지우기 메뉴 */
function StatusPill() {
  const { health, t, synced, connectSync, disconnectSync, toast } = useMemos();
  const conn = useClaudeConnection();
  const [open, setOpen] = useState(false);
  const [syncUrl, setSyncUrl] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSync, setShowSync] = useState(false);
  const shareUrl = open && synced ? syncShareUrl() : null;
  const serverHost = (() => {
    try {
      return synced ? new URL(JSON.parse(window.localStorage.getItem("memo-sync") ?? "{}").server).host : "";
    } catch {
      return "";
    }
  })();
  const doConnectSync = async () => {
    if (!syncUrl.trim()) return;
    setSyncBusy(true);
    setSyncError(null);
    const r = await connectSync(syncUrl);
    setSyncBusy(false);
    if (!r.ok) {
      setSyncError(r.message);
      return;
    }
    setSyncUrl("");
    setShowSync(false);
    toast(r.migrated ? `${t("sync.done")} · ${t("sync.migrated", { n: r.migrated })}` : t("sync.done"));
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (health === null) return null;

  const connected = DEMO ? conn.connected === true : health.apiKey && !health.mock;
  const label = DEMO
    ? synced
      ? t("status.short.synced")
      : connected
        ? t("status.short.connected")
        : t("status.short.demo")
    : health.apiKey
      ? health.mock
        ? t("status.short.mock")
        : t("status.short.connected")
      : t("status.short.needKey");
  const bad = !DEMO && !health.apiKey;
  const canMenu = DEMO;
  const on = DEMO ? synced || connected : connected;

  return (
    <>
      <button className={`status-pill ${on ? "on" : ""} ${bad ? "bad" : ""}`} onClick={() => canMenu && setOpen(true)} disabled={!canMenu} title={connected ? `Claude · ${MODEL}` : undefined} aria-label={t("status.menu")}>
        <span className={`status-dot ${bad ? "bad" : ""} ${!on && !bad ? "idle" : ""}`} />
        {label}
      </button>
      {open &&
        createPortal(
        <div className="sheet-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t("status.menu")} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <span className={`status-dot ${!on ? "idle" : ""}`} />
              <strong className="sheet-title">{t("status.menu")}</strong>
              <button className="btn ghost sm" onClick={() => setOpen(false)} aria-label={t("capture.close")}>
                <IconX />
              </button>
            </div>

            <div className="sheet-section">{t("sync.title")}</div>
            {synced ? (
              <>
                <div className="sheet-note">
                  <b>{t("sync.server")}: {serverHost}</b>
                  <br />
                  {t("sync.connectedBody")}
                </div>
                <div className="share-box">
                  <div className="share-label">{t("sync.otherDevice")}</div>
                  <div className="connect-row">
                    <code className="share-url">{shareUrl ?? ""}</code>
                    <button
                      className="btn sm primary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareUrl ?? "");
                          toast(t("sync.linkCopied"));
                        } catch {
                          toast(t("detail.copyFailed"));
                        }
                      }}
                    >
                      <IconCopy size={14} /> {t("sync.copyLink")}
                    </button>
                  </div>
                  <div className="connect-help">{t("sync.otherDeviceHelp")}</div>
                </div>
                <div className="sheet-actions">
                  <button
                    className="sheet-item danger"
                    onClick={() => {
                      if (!window.confirm(t("sync.disconnectConfirm"))) return;
                      disconnectSync();
                      setOpen(false);
                    }}
                  >
                    {t("sync.disconnect")}
                  </button>
                </div>
              </>
            ) : showSync ? (
              <div className="connect">
                <div className="connect-row">
                  <input
                    autoFocus
                    placeholder={t("sync.placeholder")}
                    value={syncUrl}
                    onChange={(e) => setSyncUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void doConnectSync()}
                    aria-label={t("sync.connect")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="btn sm primary" onClick={() => void doConnectSync()} disabled={syncBusy || !syncUrl.trim()}>
                    {syncBusy ? t("connect.checking") : t("connect.connect")}
                  </button>
                </div>
                {syncError && <div className="connect-error">{syncError}</div>}
                <div className="connect-help">{t("sync.help")}</div>
              </div>
            ) : (
              <div className="sheet-actions">
                <button className="sheet-item" onClick={() => setShowSync(true)}>
                  {t("sync.connect")}
                </button>
                <div className="sheet-note">{t("sync.help")}</div>
              </div>
            )}

            <div className="sheet-section">{t("connect.apiTitle")}</div>
            {connected ? (
              <>
                <div className="sheet-note">
                  <b>{t("connect.connectedTitle")} · {MODEL}</b>
                  <br />
                  {t("connect.connectedBody", { model: MODEL })}
                </div>
                <div className="sheet-actions">
                  {conn.examples > 0 && !synced && (
                    <button
                      className="sheet-item"
                      onClick={() => {
                        conn.clearExamples();
                        setOpen(false);
                      }}
                    >
                      {t("connect.clearExamples")}
                    </button>
                  )}
                  <button
                    className="sheet-item danger"
                    onClick={() => {
                      if (conn.disconnect()) setOpen(false);
                    }}
                  >
                    {t("connect.disconnect")}
                  </button>
                </div>
              </>
            ) : (
              <ConnectKeyPanel />
            )}
          </div>
        </div>,
        document.body,
        )}
    </>
  );
}
