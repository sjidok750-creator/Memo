"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectInput } from "@/lib/detect";
import { fileToDataUrl } from "@/lib/image-client";
import { DEMO } from "@/lib/demo";
import { buildClaudePrompt, claudeNewUrl, clearPendingImport, looksLikeClaudeReply, readPendingImport, savePendingImport } from "@/lib/claude-app";
import { useReplyImport } from "./useReplyImport";
import { IconClipboard } from "./Icons";
import { IconSpark } from "./Icons";
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
  const { health, lang, t, job, jobError, clearJobError, interrupted, discardInterrupted, startJob, cancelJob, toast } = useMemos();
  const importReply = useReplyImport();
  const importing = useRef(false);
  const [awaiting, setAwaiting] = useState(false);
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
    // Claude 앱으로 보낸 뒤 돌아왔는지 (답을 기다리는 중)
    const check = () => setAwaiting(Boolean(readPendingImport()));
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
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
  const canOpenClaude = image ? true : detected.kind === "youtube" || detected.kind === "book";
  const apiReady = DEMO ? health?.mock === false : health?.apiKey === true;

  /** Claude 앱에서 받아온 답이 붙여넣어지면 바로 저장 (사진이 붙어 있으면 메모 칸에 붙여넣게 된다) */
  const replyText = image ? (looksLikeClaudeReply(note) ? note : null) : detected.kind === "import" ? text : null;
  useEffect(() => {
    if (!replyText || importing.current) return;
    importing.current = true;
    (async () => {
      const ok = await importReply(replyText, image ? { image: image.dataUrl, note: undefined } : undefined);
      if (ok) {
        setText("");
        setImage(null);
        setNote("");
        setLocalError(null);
      } else setLocalError(t("app.invalid"));
      importing.current = false;
    })();
  }, [replyText, image, importReply, t]);

  /** 돌아왔을 때 한 번에: 클립보드의 Claude 답을 읽어 저장 */
  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!looksLikeClaudeReply(clip)) {
        toast(t("app.clipboardEmpty"));
        return;
      }
      if (image) setNote(clip);
      else setText(clip);
    } catch {
      toast(t("app.clipboardDenied"));
    }
  };

  const clearPendingImportLocal = () => {
    clearPendingImport();
    setAwaiting(false);
  };

  /** claude.ai 를 요청문과 함께 연다. 사진은 요청문을 복사해 주고 사용자가 첨부한다 */
  const openClaude = async () => {
    let req: CaptureRequest;
    if (image) req = { kind: "photo", image: image.dataUrl, note: note.trim() || undefined, lang };
    else if (detected.kind === "youtube") req = { kind: "youtube", input: text.trim(), lang };
    else if (detected.kind === "book") req = { kind: "book", input: text.trim(), lang };
    else return;
    savePendingImport({ kind: req.kind, input: req.input, image: req.image, note: req.note, lang, at: Date.now() });
    setAwaiting(true);
    const prompt = buildClaudePrompt(req, lang);
    if (req.kind === "photo") {
      try {
        await navigator.clipboard.writeText(prompt);
        toast(t("app.photoCopied"));
      } catch {
        /* 클립보드 실패해도 창은 연다 */
      }
      window.open("https://claude.ai/new", "_blank", "noopener");
      return;
    }
    window.open(claudeNewUrl(prompt), "_blank", "noopener");
  };

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
      {awaiting && !replyText && (
        <div className="awaiting">
          <span>{t("app.awaiting")}</span>
          <span className="banner-actions">
            <button className="btn sm primary" onClick={() => void pasteFromClipboard()}>
              <IconClipboard size={14} /> {t("app.pasteClipboard")}
            </button>
            <button
              className="btn sm ghost"
              onClick={() => {
                clearPendingImportLocal();
              }}
              aria-label={t("capture.close")}
            >
              <IconX />
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
          {apiReady ? (
            <button className="btn primary" onClick={submit} disabled={!canSubmit}>
              {t("capture.submit")} <IconArrowRight size={15} />
            </button>
          ) : (
            <button className="btn primary" onClick={() => void openClaude()} disabled={!canOpenClaude}>
              <IconSpark size={14} /> {t("app.button")}
            </button>
          )}
        </div>
        <div className="capture-meta">
          <Detect kind={replyText ? "import" : image ? "photo" : detected.kind} />
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
        {apiReady ? (
          <button className="hint claude" onClick={() => void openClaude()} disabled={!canOpenClaude}>
            <IconSpark size={12} /> {t("app.button")}
          </button>
        ) : DEMO && health?.mock ? (
          <button className="hint" onClick={submit} disabled={!canSubmit}>
            {t("capture.demoSubmit")}
          </button>
        ) : null}
      </div>
      <div className="app-hint">{t("app.hint")}</div>

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

function Detect({ kind }: { kind: "empty" | "youtube" | "book" | "unsupported-url" | "photo" | "import" }) {
  const { t } = useMemos();
  switch (kind) {
    case "import":
      return (
        <span className="detect on">
          <IconSpark size={12} /> {t("app.detected")}
        </span>
      );
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
