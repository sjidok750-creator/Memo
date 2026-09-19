"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CategoryId, Memo, MemoKind } from "@/lib/types";
import { DEMO, demoStore } from "@/lib/demo";

interface Health {
  apiKey: boolean;
  mock: boolean;
  model: string;
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
}

const MemoContext = createContext<Ctx | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [kind, setKind] = useState<MemoKind | "all">("all");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (DEMO) {
      setMemos(demoStore.list());
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
  }, []);

  useEffect(() => {
    void refresh();
    if (DEMO) {
      setHealth({ apiKey: true, mock: true, model: "demo" });
      return;
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: Health) => setHealth(h))
      .catch(() => setHealth({ apiKey: false, mock: false, model: "" }));
  }, [refresh]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
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

  const remove = useCallback(async (id: string) => {
    if (DEMO) demoStore.remove(id);
    else await fetch(`/api/memos/${id}`, { method: "DELETE" });
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const patch = useCallback(
    async (id: string, p: Partial<Memo>) => {
      if (DEMO) {
        const memo = demoStore.patch(id, p);
        if (memo) upsert(memo);
        return memo;
      }
      // 먼저 화면에 반영하고, 실패하면 되돌린다
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
    [upsert, memos],
  );

  const value = useMemo<Ctx>(
    () => ({ memos, loading, category, setCategory, kind, setKind, query, setQuery, health, refresh, upsert, remove, patch, toast }),
    [memos, loading, category, kind, query, health, refresh, upsert, remove, patch, toast],
  );

  return (
    <MemoContext.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </MemoContext.Provider>
  );
}

export function useMemos(): Ctx {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("MemoProvider 밖에서 useMemos 를 호출했습니다");
  return ctx;
}
