/**
 * 정적 배포에서 쓰는 저장소 하나. 동기화 서버가 연결돼 있으면 서버, 아니면 이 기기(demoStore).
 * 모든 화면·캡처 코드는 이것만 쓴다.
 */
import { demoStore } from "./demo";
import { isSynced, remoteStore } from "./sync";
import type { Lang } from "./i18n";
import type { Memo } from "./types";

export const clientStore = {
  isRemote: () => isSynced(),
  /** 즉시 그릴 수 있는 목록 (서버면 캐시) */
  cached(lang: Lang): Memo[] {
    return isSynced() ? remoteStore.cached() : demoStore.list(lang);
  },
  async list(lang: Lang): Promise<Memo[]> {
    return isSynced() ? remoteStore.list() : demoStore.list(lang);
  },
  async get(id: string, lang: Lang): Promise<Memo | null> {
    if (!isSynced()) return demoStore.get(id, lang);
    return remoteStore.cached().find((m) => m.id === id) ?? (await remoteStore.get(id));
  },
  async add(memo: Memo): Promise<Memo> {
    if (isSynced()) return remoteStore.add(memo);
    demoStore.add(memo);
    return memo;
  },
  async patch(id: string, p: Partial<Memo>, lang: Lang): Promise<Memo | null> {
    return isSynced() ? remoteStore.patch(id, p) : demoStore.patch(id, p, lang);
  },
  async remove(id: string, lang: Lang): Promise<void> {
    if (isSynced()) await remoteStore.remove(id);
    else demoStore.remove(id, lang);
  },
  async importAll(memos: Memo[], lang: Lang): Promise<{ added: number; skipped: number }> {
    return isSynced() ? remoteStore.importAll(memos) : demoStore.importAll(memos, lang);
  },
  async exportAll(lang: Lang): Promise<string> {
    const memos = await this.list(lang);
    return JSON.stringify({ app: "memo", version: 1, exportedAt: new Date().toISOString(), memos }, null, 2);
  },
  /** 서버 연결 직후: 이 기기의 실제 메모(예시 제외)를 서버로 올린다 */
  async migrateLocalToRemote(lang: Lang): Promise<number> {
    const local = demoStore.list(lang).filter((m) => m.model !== "demo");
    if (!local.length) return 0;
    const r = await remoteStore.importAll(local);
    return r.added;
  },
};
