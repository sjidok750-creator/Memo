"use client";

import { useEffect, useState } from "react";
import { getBrowserApiKey, KEY_EVENT, setBrowserApiKey } from "@/lib/browser-key";
import { MODEL, testApiKey } from "@/lib/claude";
import { demoStore } from "@/lib/demo";
import { useMemos } from "./MemoProvider";
import { IconCheck, IconSpark, IconX } from "./Icons";

/** 브라우저 모드의 연결 상태와 동작 (배너와 상단 표시가 함께 쓴다) */
export function useClaudeConnection() {
  const { refresh, toast, memos, lang, t } = useMemos();
  const [connected, setConnected] = useState<boolean | null>(null);
  const examples = memos.filter((m) => m.model === "demo").length;
  useEffect(() => {
    const update = () => setConnected(Boolean(getBrowserApiKey()));
    update();
    window.addEventListener(KEY_EVENT, update);
    return () => window.removeEventListener(KEY_EVENT, update);
  }, []);
  const disconnect = () => {
    if (!window.confirm(t("connect.disconnectConfirm"))) return false;
    setBrowserApiKey(null);
    toast(t("connect.disconnected"));
    return true;
  };
  const clearExamples = () => {
    const n = demoStore.clearExamples(lang);
    void refresh();
    toast(n ? t("connect.clearedN", { n }) : t("connect.nothingToClear"));
  };
  return { connected, examples, disconnect, clearExamples };
}

/** 정적 배포(브라우저 모드)에서 Claude API 키를 연결하는 패널. 연결되면 아무것도 그리지 않는다 (상단 표시가 대신한다). */
export function Connect() {
  const { toast, t } = useMemos();
  const { connected } = useClaudeConnection();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    const k = key.trim();
    if (!k) return;
    setBusy(true);
    setError(null);
    const r = await testApiKey(k);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setBrowserApiKey(k);
    setOpen(false);
    setKey("");
    toast(t("connect.connected"));
  };

  if (connected === null || connected) return null;

  const help = t("connect.help", { link: "__LINK__" }).split("__LINK__");

  return (
    <div className="banner">
      {!open ? (
        <>
          <span>
            <strong>{t("connect.demoTitle")}</strong> · {t("connect.demoBody")}
          </span>
          <span className="banner-actions">
            <button className="btn sm primary" onClick={() => setOpen(true)}>
              <IconSpark size={13} /> {t("connect.button")}
            </button>
          </span>
        </>
      ) : (
        <div className="connect">
          <div className="connect-row">
            <input
              type="password"
              autoFocus
              placeholder="sk-ant-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void connect()}
              aria-label={t("connect.keyLabel")}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn sm primary" onClick={() => void connect()} disabled={busy || !key.trim()}>
              {busy ? t("connect.checking") : <><IconCheck /> {t("connect.connect")}</>}
            </button>
            <button className="btn sm ghost" onClick={() => { setOpen(false); setError(null); }} aria-label={t("capture.close")}>
              <IconX />
            </button>
          </div>
          {error && <div className="connect-error">{error}</div>}
          <div className="connect-help">
            {help[0]}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>
            {help[1]}
          </div>
        </div>
      )}
    </div>
  );
}
