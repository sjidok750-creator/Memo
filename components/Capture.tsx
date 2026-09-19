"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { detectInput } from "@/lib/detect";
import { fileToDataUrl } from "@/lib/image-client";
import { DEMO, demoCapture, memoHref } from "@/lib/demo";
import { captureStream } from "@/lib/capture-client";
import { friendlyError } from "@/lib/errors";
import type { CaptureRequest, MemoKind } from "@/lib/types";
import { useMemos } from "./MemoProvider";
import { IconArrowRight, IconBook, IconCheck, IconImage, IconPlay, IconX } from "./Icons";

/** 종류별 예상 단계 (서버가 보내는 stage id 로 실제 진행이 표시된다) */
const EXPECTED: Record<MemoKind, string[]> = {
  youtube: ["source", "transcript", "summarize", "save"],
  book: ["search", "summarize", "save"],
  photo: ["upload", "summarize", "save"],
};

/** 서버 stage id → 화면에 놓을 자리 */
const SLOT: Record<string, string> = {
  "transcript-web": "transcript",
  "summarize-transcript": "summarize",
  "summarize-web": "summarize",
  "summarize-book": "summarize",
  "summarize-photo": "summarize",
};

interface Stage {
  slot: string;
  id: string;
}

type Phase = { name: "idle" } | { name: "busy"; kind: MemoKind; label: string; stages: Stage[]; current: string; startedAt: number } | { name: "error"; message: string };

export function Capture() {
  const router = useRouter();
  const { upsert, health, toast, lang, t } = useMemos();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [now, setNow] = useState(0);
  const [touch, setTouch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const detected = useMemo(() => detectInput(text), [text]);
  const busy = phase.name === "busy";

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const tm = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tm);
  }, [busy]);

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
        setPhase({ name: "error", message: t("capture.onlyImages") });
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file, DEMO ? 1280 : 1600, DEMO ? 0.8 : 0.86);
        setImage({ dataUrl, name: file.name });
        setPhase({ name: "idle" });
      } catch (e) {
        setPhase({ name: "error", message: (e as Error).message });
      }
    },
    [t],
  );

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

  const onStage = useCallback((id: string) => {
    const slot = SLOT[id] ?? id;
    setPhase((p) => {
      if (p.name !== "busy") return p;
      const stages = p.stages.some((s) => s.slot === slot) ? p.stages.map((s) => (s.slot === slot ? { slot, id } : s)) : [...p.stages, { slot, id }];
      return { ...p, current: slot, stages };
    });
  }, []);

  const finish = useCallback(
    (memoId: string, msg: string) => {
      setText("");
      setNote("");
      setImage(null);
      setPhase({ name: "idle" });
      toast(msg);
      router.push(memoHref(memoId));
    },
    [router, toast],
  );

  const submit = useCallback(async () => {
    if (busy || !canSubmit) return;
    let req: CaptureRequest;
    let label: string;
    if (image) {
      req = { kind: "photo", image: image.dataUrl, note: note.trim() || undefined, lang };
      label = image.name;
    } else if (detected.kind === "youtube") {
      req = { kind: "youtube", input: text.trim(), lang };
      label = text.trim();
    } else if (detected.kind === "book") {
      req = { kind: "book", input: text.trim(), lang };
      label = text.trim();
    } else return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const stages = EXPECTED[req.kind].map((slot) => ({ slot, id: slot }));
    setPhase({ name: "busy", kind: req.kind, label, stages, current: stages[0].slot, startedAt: Date.now() });
    setNow(Date.now());

    try {
      if (DEMO) {
        let dup = false;
        const memo = await demoCapture(
          req,
          (ev) => {
            if (ev.type === "stage") onStage(ev.id);
            else if (ev.type === "duplicate") dup = true;
          },
          ctrl.signal,
        );
        upsert(memo);
        finish(memo.id, dup ? t("capture.duplicate") : health?.mock ? t("capture.savedExample") : t("capture.saved"));
        return;
      }
      await captureStream(
        req,
        (ev) => {
          if (ev.type === "stage") onStage(ev.id);
          else if (ev.type === "done") {
            upsert(ev.memo);
            finish(ev.memo.id, t("capture.saved"));
          } else if (ev.type === "duplicate") finish(ev.memo.id, t("capture.duplicate"));
        },
        ctrl.signal,
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") setPhase({ name: "idle" });
      else setPhase({ name: "error", message: DEMO ? friendlyError(e) : (e as Error).message });
    } finally {
      abortRef.current = null;
    }
  }, [busy, canSubmit, image, note, detected, text, lang, upsert, finish, onStage, health, t]);

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

  if (phase.name === "busy") {
    const elapsed = Math.max(0, Math.round((now - phase.startedAt) / 1000));
    const idx = phase.stages.findIndex((s) => s.slot === phase.current);
    return (
      <section className="capture" aria-live="polite">
        <div className="progress">
          <div className="ring" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="progress-title">
              {t(`capture.reading.${phase.kind}`)}
              <span className="elapsed">{t("capture.elapsed", { n: elapsed })}</span>
            </div>
            <div className="progress-input">{phase.label}</div>
            <ul className="stages">
              {phase.stages.map((s, i) => {
                const state = i < idx ? "done" : i === idx ? "active" : "";
                return (
                  <li key={s.slot} className={`stage ${state}`}>
                    <span className="mark">{state === "done" ? <IconCheck /> : null}</span>
                    {t(`stage.${s.id}`)}
                  </li>
                );
              })}
            </ul>
            <div className="progress-foot">
              <span>{elapsed > 25 ? t("capture.tipLong") : t("capture.tipShort")}</span>
              <button className="btn ghost sm" onClick={cancel}>
                {t("capture.cancel")}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const placeholder = image ? t("capture.notePlaceholder") : t("capture.placeholder");

  return (
    <section className={`capture ${drag ? "drag" : ""}`}>
      <div className="capture-field" onClick={() => textRef.current?.focus()}>
        <div className="capture-row">
          {image ? (
            <div className="attach">
              <div className="attach-thumb">
                <img src={image.dataUrl} alt="" />
                <button
                  className="attach-remove"
                  aria-label={t("capture.removePhoto")}
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
                <textarea className="note" rows={2} placeholder={placeholder} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={onKey} onPaste={onPaste} autoFocus />
              </div>
            </div>
          ) : (
            <textarea ref={textRef} rows={1} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onPaste={onPaste} aria-label={t("capture.placeholder")} />
          )}
          <button className="btn primary" onClick={submit} disabled={!canSubmit || health?.apiKey === false}>
            {t("capture.submit")} <IconArrowRight size={15} />
          </button>
        </div>
        <div className="capture-meta">
          <Detect kind={image ? "photo" : detected.kind} />
          <span className="kbd">
            <kbd>Enter</kbd> {t("capture.enterHint")}
          </span>
        </div>
      </div>

      <div className="hints">
        <span className="label">{t("capture.hintsLabel")}</span>
        <button className="hint" onClick={() => textRef.current?.focus()}>
          <IconPlay size={12} /> {t("capture.hintYoutube")}
        </button>
        <button className="hint" onClick={() => textRef.current?.focus()}>
          <IconBook size={13} /> {t("capture.hintBook")}
        </button>
        <button className="hint" onClick={() => fileRef.current?.click()}>
          <IconImage size={13} /> {touch ? t("capture.hintPhotoTouch") : t("capture.hintPhoto")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void acceptFile(e.target.files?.[0])} />
      </div>

      {phase.name === "error" && (
        <div className="error-box" role="alert">
          <span>{phase.message}</span>
          <span className="error-actions">
            {canSubmit && (
              <button className="btn sm" onClick={() => void submit()}>
                {t("capture.retry")}
              </button>
            )}
            <button className="btn ghost sm" onClick={() => setPhase({ name: "idle" })} aria-label={t("capture.close")}>
              <IconX />
            </button>
          </span>
        </div>
      )}
      {drag && <div className="drop-overlay">{t("capture.dropHere")}</div>}
    </section>
  );
}

function Detect({ kind }: { kind: "empty" | "youtube" | "book" | "unsupported-url" | "photo" }) {
  const { t } = useMemos();
  switch (kind) {
    case "photo":
      return (
        <span className="detect on">
          <IconImage size={13} /> {t("capture.detectPhoto")}
        </span>
      );
    case "youtube":
      return (
        <span className="detect on">
          <IconPlay size={12} /> {t("capture.detectYoutube")}
        </span>
      );
    case "book":
      return (
        <span className="detect on">
          <IconBook size={13} /> {t("capture.detectBook")}
        </span>
      );
    case "unsupported-url":
      return <span className="detect warn">{t("capture.detectUnsupported")}</span>;
    default:
      return <span className="detect">{t("capture.detectIdle")}</span>;
  }
}
