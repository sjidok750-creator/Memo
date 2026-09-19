"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectInput } from "@/lib/detect";
import { fileToDataUrl } from "@/lib/image-client";
import { DEMO } from "@/lib/demo";
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

export function Capture() {
  const { health, lang, t, job, jobError, clearJobError, interrupted, discardInterrupted, startJob, cancelJob } = useMemos();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [touch, setTouch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const detected = useMemo(() => detectInput(text), [text]);
  const busy = Boolean(job && !job.replace);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  useEffect(() => {
    if (!busy) return;
    setNow(Date.now());
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
        setLocalError(t("capture.onlyImages"));
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file, DEMO ? 1280 : 1600, DEMO ? 0.8 : 0.86);
        setImage({ dataUrl, name: file.name });
        setLocalError(null);
      } catch (e) {
        setLocalError((e as Error).message);
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

  const submit = () => {
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
    setLocalError(null);
    setText("");
    setNote("");
    setImage(null);
    startJob(req, label);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
    if (f) {
      e.preventDefault();
      void acceptFile(f);
    }
  };

  if (job && !job.replace) {
    const elapsed = Math.max(0, Math.round((now - job.startedAt) / 1000));
    const slots = EXPECTED[job.kind];
    const cur = job.stage ? (SLOT[job.stage] ?? job.stage) : slots[0];
    const idx = Math.max(0, slots.indexOf(cur));
    return (
      <section className="capture" aria-live="polite">
        <div className="progress">
          <div className="ring" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="progress-title">
              {t(`capture.reading.${job.kind}`)}
              <span className="elapsed">{t("capture.elapsed", { n: elapsed })}</span>
            </div>
            <div className="progress-input">{job.label}</div>
            <ul className="stages">
              {slots.map((slot, i) => {
                const state = i < idx ? "done" : i === idx ? "active" : "";
                const id = i === idx && job.stage ? job.stage : slot;
                return (
                  <li key={slot} className={`stage ${state}`}>
                    <span className="mark">{state === "done" ? <IconCheck /> : null}</span>
                    {t(`stage.${id}`)}
                  </li>
                );
              })}
            </ul>
            <div className="progress-foot">
              <span>{DEMO ? t("job.keepOpen") : elapsed > 25 ? t("capture.tipLong") : t("capture.tipShort")}</span>
              <button className="btn ghost sm" onClick={cancelJob}>
                {t("capture.cancel")}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const placeholder = image ? t("capture.notePlaceholder") : t("capture.placeholder");
  const error = localError ?? jobError?.message ?? null;

  return (
    <section className={`capture ${drag ? "drag" : ""}`}>
      {interrupted && (
        <div className="interrupted">
          <div>
            <strong>{t("job.interrupted")}</strong> · {interrupted.label}
            <div className="interrupted-body">{t("job.interruptedBody")}</div>
          </div>
          <span className="banner-actions">
            <button className="btn sm primary" onClick={() => startJob(interrupted.req, interrupted.label)}>
              {t("job.resume")}
            </button>
            <button className="btn sm ghost" onClick={discardInterrupted}>
              {t("job.discard")}
            </button>
          </span>
        </div>
      )}
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

      {error && (
        <div className="error-box" role="alert">
          <span>{error}</span>
          <span className="error-actions">
            {jobError && !localError && (
              <button className="btn sm" onClick={() => startJob(jobError.req, jobError.label)}>
                {t("capture.retry")}
              </button>
            )}
            <button
              className="btn ghost sm"
              onClick={() => {
                setLocalError(null);
                clearJobError();
              }}
              aria-label={t("capture.close")}
            >
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
