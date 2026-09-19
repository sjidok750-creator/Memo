"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { detectInput } from "@/lib/detect";
import { fileToDataUrl } from "@/lib/image-client";
import { DEMO, demoCapture, memoHref } from "@/lib/demo";
import type { CaptureEvent, CaptureRequest, MemoKind } from "@/lib/types";
import { useMemos } from "./MemoProvider";
import { IconArrowRight, IconBook, IconCheck, IconImage, IconPlay, IconX } from "./Icons";

interface Stage {
  id: string;
  label: string;
}

/** 종류별로 예상되는 단계 (서버가 보내는 stage 이벤트로 실제 라벨이 덮어써진다) */
const EXPECTED: Record<MemoKind, Stage[]> = {
  youtube: [
    { id: "source", label: "영상 정보 확인" },
    { id: "transcript", label: "자막 수집" },
    { id: "summarize", label: "요약 작성" },
    { id: "save", label: "분야 분류 및 저장" },
  ],
  book: [
    { id: "search", label: "책 정보 검색" },
    { id: "summarize", label: "핵심 내용 요약 · 명문장 발췌" },
    { id: "save", label: "분야 분류 및 저장" },
  ],
  photo: [
    { id: "upload", label: "사진 저장" },
    { id: "summarize", label: "사진 읽고 요약 작성" },
    { id: "save", label: "분야 분류 및 저장" },
  ],
};

type Phase = { name: "idle" } | { name: "busy"; kind: MemoKind; label: string; stages: Stage[]; current: string; startedAt: number } | { name: "error"; message: string };

export function Capture() {
  const router = useRouter();
  const { upsert, health, toast } = useMemos();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [now, setNow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const detected = useMemo(() => detectInput(text), [text]);
  const busy = phase.name === "busy";

  // 경과 시간 표시
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [busy]);

  // 텍스트 영역 높이 자동 조절
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const acceptFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setPhase({ name: "error", message: "이미지 파일만 넣을 수 있어요 (JPG, PNG, WEBP, GIF)." });
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        setImage({ dataUrl, name: file.name });
        setPhase({ name: "idle" });
      } catch (e) {
        setPhase({ name: "error", message: (e as Error).message });
      }
    },
    [],
  );

  // 페이지 어디에나 떨어뜨려도 받도록
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setDrag(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDrag(false);
    };
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setDrag(false);
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      void acceptFile(e.dataTransfer.files[0]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [acceptFile]);

  const canSubmit = image ? true : detected.kind === "youtube" || detected.kind === "book";

  const submit = useCallback(async () => {
    if (busy || !canSubmit) return;
    let req: CaptureRequest;
    let label: string;
    if (image) {
      req = { kind: "photo", image: image.dataUrl, note: note.trim() || undefined };
      label = image.name;
    } else if (detected.kind === "youtube") {
      req = { kind: "youtube", input: text.trim() };
      label = text.trim();
    } else if (detected.kind === "book") {
      req = { kind: "book", input: text.trim() };
      label = text.trim();
    } else return;

    const stages = EXPECTED[req.kind];
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ name: "busy", kind: req.kind, label, stages, current: stages[0].id, startedAt: Date.now() });
    setNow(Date.now());

    try {
      if (DEMO) {
        const memo = await demoCapture(req, (ev) => {
          if (ev.type === "stage") setPhase((p) => (p.name === "busy" ? { ...p, current: ev.id } : p));
        }, ctrl.signal);
        upsert(memo);
        setText("");
        setNote("");
        setImage(null);
        setPhase({ name: "idle" });
        toast("메모를 저장했어요 (데모)");
        router.push(memoHref(memo.id));
        return;
      }
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `서버 오류 (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as CaptureEvent;
          if (ev.type === "stage") {
            setPhase((p) =>
              p.name === "busy"
                ? { ...p, current: ev.id, stages: p.stages.some((s) => s.id === ev.id) ? p.stages.map((s) => (s.id === ev.id ? { ...s, label: ev.label } : s)) : [...p.stages, { id: ev.id, label: ev.label }] }
                : p,
            );
          } else if (ev.type === "done") {
            upsert(ev.memo);
            setText("");
            setNote("");
            setImage(null);
            setPhase({ name: "idle" });
            toast("메모를 저장했어요");
            router.push(memoHref(ev.memo.id));
            finished = true;
          } else if (ev.type === "duplicate") {
            setPhase({ name: "idle" });
            toast("이미 저장된 영상이에요");
            router.push(memoHref(ev.memo.id));
            finished = true;
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
      if (!finished) throw new Error("연결이 끊겼습니다. 다시 시도해 주세요.");
    } catch (e) {
      if ((e as Error).name === "AbortError") setPhase({ name: "idle" });
      else setPhase({ name: "error", message: (e as Error).message });
    } finally {
      abortRef.current = null;
    }
  }, [busy, canSubmit, image, note, detected, text, upsert, toast, router]);

  const cancel = () => abortRef.current?.abort();

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
    if (f) {
      e.preventDefault();
      void acceptFile(f);
    }
  };

  /* ---------- 진행 중 화면 ---------- */
  if (phase.name === "busy") {
    const elapsed = Math.max(0, Math.round((now - phase.startedAt) / 1000));
    const idx = phase.stages.findIndex((s) => s.id === phase.current);
    const kindLabel = { youtube: "영상을", book: "책을", photo: "사진을" }[phase.kind];
    return (
      <section className="capture" aria-live="polite">
        <div className="progress">
          <div className="ring" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="progress-title">
              {kindLabel} 읽고 있어요
              <span className="elapsed">{elapsed}초</span>
            </div>
            <div className="progress-input">{phase.label}</div>
            <ul className="stages">
              {phase.stages.map((s, i) => {
                const state = i < idx ? "done" : i === idx ? "active" : "";
                return (
                  <li key={s.id} className={`stage ${state}`}>
                    <span className="mark">{state === "done" ? <IconCheck /> : null}</span>
                    {s.label}
                  </li>
                );
              })}
            </ul>
            <div className="progress-foot">
              <span>{elapsed > 25 ? "긴 내용은 1~2분쯤 걸릴 수 있어요." : "Claude 가 내용을 읽고 핵심을 고르는 중입니다."}</span>
              <button className="btn ghost sm" onClick={cancel}>
                취소
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ---------- 입력 화면 ---------- */
  const placeholder = image ? "이 사진에 대해 메모하고 싶은 것 (선택)" : "유튜브 링크를 붙여넣거나, 책 제목을 적거나, 사진을 끌어다 놓으세요";

  return (
    <section className={`capture ${drag ? "drag" : ""}`}>
      <div className="capture-field" onClick={() => textRef.current?.focus()}>
        <div className="capture-row">
          {image ? (
            <div className="attach">
              <div className="attach-thumb">
                <img src={image.dataUrl} alt="첨부한 사진" />
                <button
                  className="attach-remove"
                  aria-label="사진 제거"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImage(null);
                  }}
                >
                  <IconX size={12} />
                </button>
              </div>
              <div className="attach-body">
                <span className="attach-name">{image.name}</span>
                <textarea
                  className="note"
                  rows={2}
                  placeholder={placeholder}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={onKey}
                  onPaste={onPaste}
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <textarea
              ref={textRef}
              rows={1}
              placeholder={placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              onPaste={onPaste}
              aria-label="유튜브 링크 또는 책 제목"
            />
          )}
          <button className="btn primary" onClick={submit} disabled={!canSubmit || health?.apiKey === false}>
            요약하기 <IconArrowRight size={15} />
          </button>
        </div>
        <div className="capture-meta">
          <Detect detected={detected} image={Boolean(image)} />
          <span className="kbd">
            <kbd>Enter</kbd> 로 요약
          </span>
        </div>
      </div>

      <div className="hints">
        <span className="label">넣을 수 있는 것</span>
        <button className="hint" onClick={() => textRef.current?.focus()}>
          <IconPlay size={12} /> 유튜브 링크
        </button>
        <button className="hint" onClick={() => textRef.current?.focus()}>
          <IconBook size={13} /> 책 제목
        </button>
        <button className="hint" onClick={() => fileRef.current?.click()}>
          <IconImage size={13} /> 사진 (끌어다 놓기 · 붙여넣기)
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void acceptFile(e.target.files?.[0])} />
      </div>

      {phase.name === "error" && (
        <div className="error-box" role="alert">
          <span>{phase.message}</span>
          <button className="btn ghost sm" onClick={() => setPhase({ name: "idle" })} aria-label="닫기">
            <IconX />
          </button>
        </div>
      )}
      {drag && <div className="drop-overlay">사진을 여기에 놓으세요</div>}
    </section>
  );
}

function Detect({ detected, image }: { detected: ReturnType<typeof detectInput>; image: boolean }) {
  if (image)
    return (
      <span className="detect on">
        <IconImage size={13} /> 사진으로 요약해요
      </span>
    );
  switch (detected.kind) {
    case "youtube":
      return (
        <span className="detect on">
          <IconPlay size={12} /> 유튜브 영상으로 알아봤어요
        </span>
      );
    case "book":
      return (
        <span className="detect on">
          <IconBook size={13} /> 책 제목으로 알아봤어요
        </span>
      );
    case "unsupported-url":
      return <span className="detect warn">아직 유튜브 링크만 지원해요</span>;
    default:
      return <span className="detect">무엇을 넣어도 알아서 구분해요</span>;
  }
}
