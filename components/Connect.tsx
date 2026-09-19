"use client";

import { useEffect, useState } from "react";
import { getBrowserApiKey, setBrowserApiKey } from "@/lib/browser-key";
import { MODEL, testApiKey } from "@/lib/claude";
import { demoStore } from "@/lib/demo";
import { useMemos } from "./MemoProvider";
import { IconCheck, IconSpark, IconX } from "./Icons";

/** 정적 배포(브라우저 모드)에서 Claude API 키를 연결하는 패널 */
export function Connect() {
  const { refresh, toast, memos } = useMemos();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const examples = memos.filter((m) => m.model === "demo").length;

  useEffect(() => setConnected(Boolean(getBrowserApiKey())), []);

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
    setConnected(true);
    setOpen(false);
    setKey("");
    toast("Claude 와 연결됐어요");
  };
  const disconnect = () => {
    if (!window.confirm("연결을 해제할까요? 저장된 메모는 그대로 남아요.")) return;
    setBrowserApiKey(null);
    setConnected(false);
    toast("연결을 해제했어요");
  };
  const clearExamples = () => {
    const n = demoStore.clearExamples();
    void refresh();
    toast(n ? `예시 메모 ${n}개를 지웠어요` : "지울 예시 메모가 없어요");
  };

  if (connected === null) return null;

  if (connected) {
    return (
      <div className="banner ok">
        <span>
          <strong>Claude 연결됨</strong> · 이 기기에서 바로 요약해요 ({MODEL}). 유튜브는 브라우저에서 자막을 못 읽어 웹 검색으로 조사하고, 메모는 이 브라우저에 저장돼요. 백업은 아래에서.
        </span>
        <span className="banner-actions">
          {examples > 0 && (
            <button className="btn sm" onClick={clearExamples}>
              예시 메모 지우기
            </button>
          )}
          <button className="btn sm ghost" onClick={disconnect}>
            연결 해제
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="banner">
      {!open ? (
        <>
          <span>
            <strong>미리보기 데모</strong> · 지금은 예시 문장으로 흐름만 보여줘요. Claude API 키를 넣으면 이 기기에서 실제로 요약합니다.
          </span>
          <span className="banner-actions">
            <button className="btn sm primary" onClick={() => setOpen(true)}>
              <IconSpark size={13} /> Claude 연결
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
              aria-label="Claude API 키"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn sm primary" onClick={() => void connect()} disabled={busy || !key.trim()}>
              {busy ? "확인 중…" : <><IconCheck /> 연결</>}
            </button>
            <button className="btn sm ghost" onClick={() => { setOpen(false); setError(null); }} aria-label="닫기">
              <IconX />
            </button>
          </div>
          {error && <div className="connect-error">{error}</div>}
          <div className="connect-help">
            키는 <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> 에서 만들 수 있어요. 키는 이 기기 브라우저에만 저장되고 Anthropic 서버로만 전송돼요. 공용 기기라면 다 쓴 뒤 연결을 해제하세요.
          </div>
        </div>
      )}
    </div>
  );
}
