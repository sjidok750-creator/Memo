"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CaptureRequest, CategoryId, Memo, MemoKind } from "@/lib/types";
import { DEMO, demoCapture, demoStore, memoHref } from "@/lib/demo";
import { isBrowserConnected, KEY_EVENT } from "@/lib/browser-key";
import { MODEL } from "@/lib/claude";
import { detectLang, LANG_KEY, translate, type Lang } from "@/lib/i18n";
import { captureStream } from "@/lib/capture-client";
import { friendlyError } from "@/lib/errors";

interface Health {
  apiKey: boolean;
  mock: boolean;
  model: string;
}

/** 진행 중인 요약 작업. 화면을 옮겨도 살아 있다. */
export interface Job {
  req: CaptureRequest;
  label: string;
  kind: MemoKind;
  stage: string;
  startedAt: number;
  replace?: string;
}

interface Pending {
  req: CaptureRequest;
  label: string;
  startedAt: number;
}

interface Ctx {
  memos: Memo[];
  loading: boolean;
  category: CategoryId | "all";
  setCategory: (c: CategoryId | "all") => void;
  kind: MemoKind | "all";
  setKind: (k: MemoKind | "all") => void;
  query: string;
  setQuery: (q: string) => void;
  health: Health | null;
  refresh: () => Promise<void>;
  upsert: (m: Memo) => void;
  remove: (id: string) => Promise<void>;
  patch: (id: string, p: Partial<Memo>) => Promise<Memo | null>;
  toast: (msg: string) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  job: Job | null;
  jobError: { message: string; req: CaptureRequest; label: string } | null;
  clearJobError: () => void;
  interrupted: Pending | null;
  discardInterrupted: () => void;
  startJob: (req: CaptureRequest, label: string) => void;
  cancelJob: () => void;
}

const MemoContext = createContext<Ctx | null>(null);
const PENDING_KEY = "memo-pending-job";

function readPending(): Pending | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) window.localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* 용량 초과 등은 무시 */
  }
}

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [kind, setKind] = useState<MemoKind | "all">("all");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lang, setLangState] = useState<Lang>("ko");
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<Ctx["jobError"]>(null);
  const [interrupted, setInterrupted] = useState<Pending | null>(null);
  const jobAbort = useRef<AbortController | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const healthRef = useRef<Health | null>(null);
  healthRef.current = health;

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    setLangState(detectLang());
    // 이전에 끝나지 못한 작업이 있으면 알려준다
    const p = readPending();
    if (p) setInterrupted(p);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const tRef = useRef(t);
  tRef.current = t;

  const refresh = useCallback(async () => {
    if (DEMO) {
      setMemos(demoStore.list(lang));
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/memos", { cache: "no-store" });
      const j = (await res.json()) as { memos: Memo[] };
      setMemos(j.memos);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void refresh();
    if (DEMO) {
      const update = () => setHealth(isBrowserConnected() ? { apiKey: true, mock: false, model: MODEL } : { apiKey: true, mock: true, model: "demo" });
      update();
      window.addEventListener(KEY_EVENT, update);
      return () => window.removeEventListener(KEY_EVENT, update);
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: Health) => setHealth(h))
      .catch(() => setHealth({ apiKey: false, mock: false, model: "" }));
  }, [refresh]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const upsert = useCallback((m: Memo) => {
    setMemos((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i < 0) return [m, ...prev];
      const next = prev.slice();
      next[i] = m;
      return next;
    });
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (DEMO) demoStore.remove(id, lang);
      else await fetch(`/api/memos/${id}`, { method: "DELETE" });
      setMemos((prev) => prev.filter((m) => m.id !== id));
    },
    [lang],
  );

  const patch = useCallback(
    async (id: string, p: Partial<Memo>) => {
      if (DEMO) {
        const memo = demoStore.patch(id, p, lang);
        if (memo) upsert(memo);
        return memo;
      }
      const prev = memos.find((m) => m.id === id);
      if (prev) upsert({ ...prev, ...p });
      const res = await fetch(`/api/memos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (!res.ok) {
        if (prev) upsert(prev);
        return null;
      }
      const { memo } = (await res.json()) as { memo: Memo };
      upsert(memo);
      return memo;
    },
    [upsert, memos, lang],
  );

  /* ---------- 요약 작업 (화면 이동과 무관하게 살아 있다) ---------- */
  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && document.visibilityState === "visible") wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      /* 지원하지 않거나 거부됨 */
    }
  }, []);
  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLock.current?.release();
    } catch {
      /* ignore */
    }
    wakeLock.current = null;
  }, []);
  useEffect(() => {
    // 화면이 잠겼다 돌아오면 wake lock 이 풀려 있으므로 다시 잡는다
    const onVis = () => {
      if (document.visibilityState === "visible" && jobAbort.current) void acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [acquireWakeLock]);

  const startJob = useCallback(
    (req: CaptureRequest, label: string) => {
      if (jobAbort.current) return;
      const ctrl = new AbortController();
      jobAbort.current = ctrl;
      const startedAt = Date.now();
      const replace = req.replace;
      setJobError(null);
      setInterrupted(null);
      setJob({ req, label, kind: req.kind, stage: "", startedAt, replace });
      if (!replace) writePending({ req, label, startedAt });
      void acquireWakeLock();

      const onStage = (id: string) => setJob((j) => (j ? { ...j, stage: id } : j));
      const finish = (memo: Memo, dup: boolean) => {
        upsert(memo);
        const tt = tRef.current;
        if (replace) {
          toast(tt("detail.redoDone"));
          return;
        }
        toast(dup ? tt("capture.duplicate") : healthRef.current?.mock ? tt("capture.savedExample") : tt("capture.saved"));
        // 아직 홈에 있으면 결과로 바로 이동, 다른 화면이면 목록에만 넣어 둔다
        if (pathRef.current === "/") router.push(memoHref(memo.id));
        else toast(`${tt("job.done")} · ${memo.title}`);
      };

      (async () => {
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
            finish(memo, dup);
          } else {
            await captureStream(
              req,
              (ev) => {
                if (ev.type === "stage") onStage(ev.id);
                else if (ev.type === "done") finish(ev.memo, false);
                else if (ev.type === "duplicate") finish(ev.memo, true);
              },
              ctrl.signal,
            );
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            const message = DEMO ? friendlyError(e) : (e as Error).message;
            if (replace) toast(message);
            else setJobError({ message, req, label });
          }
        } finally {
          jobAbort.current = null;
          setJob(null);
          writePending(null);
          void releaseWakeLock();
        }
      })();
    },
    [acquireWakeLock, releaseWakeLock, upsert, toast, router],
  );

  const cancelJob = useCallback(() => jobAbort.current?.abort(), []);
  const clearJobError = useCallback(() => setJobError(null), []);
  const discardInterrupted = useCallback(() => {
    writePending(null);
    setInterrupted(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      memos, loading, category, setCategory, kind, setKind, query, setQuery, health, refresh, upsert, remove, patch, toast, lang, setLang, t,
      job, jobError, clearJobError, interrupted, discardInterrupted, startJob, cancelJob,
    }),
    [memos, loading, category, kind, query, health, refresh, upsert, remove, patch, toast, lang, setLang, t, job, jobError, clearJobError, interrupted, discardInterrupted, startJob, cancelJob],
  );

  return (
    <MemoContext.Provider value={value}>
      {children}
      {job && !job.replace && pathname !== "/" && <JobPill job={job} t={t} onClick={() => router.push("/")} />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </MemoContext.Provider>
  );
}

/** 홈을 벗어나 있을 때 떠 있는 진행 표시 */
function JobPill({ job, t, onClick }: { job: Job; t: Ctx["t"]; onClick: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tm = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tm);
  }, []);
  const sec = Math.max(0, Math.round((now - job.startedAt) / 1000));
  return (
    <button className="job-pill" onClick={onClick}>
      <span className="ring sm" />
      <span>
        {t("job.running")} · {t("capture.elapsed", { n: sec })}
        {job.stage && <em> · {t(`stage.${job.stage}`)}</em>}
      </span>
      <span className="job-pill-tap">{t("job.tap")}</span>
    </button>
  );
}

export function useMemos(): Ctx {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("MemoProvider 밖에서 useMemos 를 호출했습니다");
  return ctx;
}
