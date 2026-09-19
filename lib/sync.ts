/**
 * 동기화 서버(worker/) 연결. 정적 배포에서 메모를 이 기기 대신 서버에 두고,
 * Claude 커넥터(MCP)가 저장한 메모도 같은 곳에서 읽는다.
 */
import type { Memo } from "./types";

export const SYNC_KEY = "memo-sync";
export const SYNC_EVENT = "memo-sync-change";
const CACHE_KEY = "memo-remote-cache";

export interface SyncConfig {
  server: string;
  token: string;
}

export function getSync(): SyncConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : null;
  } catch {
    return null;
  }
}
export function setSync(c: SyncConfig | null) {
  try {
    if (c) window.localStorage.setItem(SYNC_KEY, JSON.stringify(c));
    else {
      window.localStorage.removeItem(SYNC_KEY);
      window.localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export const isSynced = () => Boolean(getSync());

/** 설정 페이지의 주소(…/s/<token>, …/mcp/<token>, …/api/<token>) 를 받아 서버와 토큰으로 나눈다 */
export function parseSyncUrl(input: string): SyncConfig | null {
  const s = input.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const m = /^\/(?:s|mcp|api)\/([A-Za-z0-9_-]{16,})/.exec(u.pathname);
  if (!m) return null;
  return { server: u.origin, token: m[1] };
}

function api(path: string): string {
  const c = getSync();
  if (!c) throw new Error("sync not configured");
  return `${c.server}/api/${c.token}${path}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(api(path), { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function readCache(): Memo[] {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Memo[]) : [];
  } catch {
    return [];
  }
}
function writeCache(memos: Memo[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(memos));
  } catch {
    /* 용량 초과 시 캐시 없이 동작 */
  }
}

export const remoteStore = {
  async ping(c?: SyncConfig): Promise<{ ok: boolean; count: number }> {
    const cfg = c ?? getSync();
    if (!cfg) throw new Error("sync not configured");
    const res = await fetch(`${cfg.server}/api/${cfg.token}/ping`);
    if (!res.ok) throw new Error(res.status === 401 ? "unauthorized" : `HTTP ${res.status}`);
    return (await res.json()) as { ok: boolean; count: number };
  },
  cached: (): Memo[] => readCache(),
  async list(): Promise<Memo[]> {
    const { memos } = await call<{ memos: Memo[] }>("/memos");
    writeCache(memos);
    return memos;
  },
  async get(id: string): Promise<Memo | null> {
    try {
      return (await call<{ memo: Memo }>(`/memos/${encodeURIComponent(id)}`)).memo;
    } catch {
      return null;
    }
  },
  /** 사진이 data URL 이면 먼저 올리고 참조로 바꾼 뒤 저장 */
  async add(memo: Memo): Promise<Memo> {
    const m = { ...memo, source: { ...memo.source } };
    if (m.source.image?.startsWith("data:")) m.source.image = await this.uploadImage(m.source.image);
    await call("/memos?overwrite=1", { method: "POST", body: JSON.stringify(m) });
    writeCache([m, ...readCache().filter((x) => x.id !== m.id)]);
    return m;
  },
  async patch(id: string, p: Partial<Memo>): Promise<Memo | null> {
    try {
      const { memo } = await call<{ memo: Memo }>(`/memos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(p) });
      writeCache(readCache().map((x) => (x.id === id ? memo : x)));
      return memo;
    } catch {
      return null;
    }
  },
  async remove(id: string): Promise<void> {
    await call(`/memos/${encodeURIComponent(id)}`, { method: "DELETE" });
    writeCache(readCache().filter((x) => x.id !== id));
  },
  async importAll(memos: Memo[]): Promise<{ added: number; skipped: number }> {
    // 사진은 서버가 data URL 을 받아 저장한다 (imageData)
    const prepared = memos.map((m) => {
      const src = { ...m.source } as Memo["source"] & { imageData?: string };
      if (src.image?.startsWith("data:")) {
        src.imageData = src.image;
        delete src.image;
      }
      return { ...m, source: src };
    });
    const r = await call<{ added: number; skipped: number }>("/memos", { method: "POST", body: JSON.stringify({ memos: prepared }) });
    return r;
  },
  async uploadImage(dataUrl: string): Promise<string> {
    const { id } = await call<{ id: string }>("/images", { method: "POST", body: JSON.stringify({ dataUrl }) });
    return id; // "img:<id>"
  },
  imageUrl(ref: string): string {
    const c = getSync();
    if (!c) return "";
    return `${c.server}/api/${c.token}/images/${ref.replace(/^img:/, "")}`;
  },
};
