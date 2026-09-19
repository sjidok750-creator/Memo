/** D1 저장소. 메모는 JSON 통째로, 사진은 BLOB 으로 둔다. */

export interface Env {
  DB: D1Database;
  APP_URL?: string;
}

export interface MemoRow {
  id: string;
  created_at: string;
  updated_at: string;
  json: string;
}

let ready: Promise<void> | null = null;
/** 첫 요청 때 테이블을 만든다 (마이그레이션 도구 없이도 배포만으로 동작하도록) */
export function ensureSchema(db: D1Database): Promise<void> {
  if (!ready) {
    ready = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS memos (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, kind TEXT, category TEXT, json TEXT NOT NULL)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS memos_created ON memos(created_at DESC)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
      ])
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

export function newId(prefix = "m"): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Date.now().toString(36)}${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}
export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, value).run();
}

/* ---------- 메모 ---------- */
export type Memo = Record<string, unknown> & { id: string; createdAt: string; updatedAt: string; kind?: string; category?: string };

export async function listMemos(db: D1Database, opts: { limit?: number; category?: string; query?: string } = {}): Promise<Memo[]> {
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 1000);
  let sql = `SELECT json FROM memos`;
  const binds: unknown[] = [];
  const where: string[] = [];
  if (opts.category) {
    where.push(`category = ?`);
    binds.push(opts.category);
  }
  if (opts.query) {
    where.push(`json LIKE ?`);
    binds.push(`%${opts.query.replace(/[%_]/g, "")}%`);
  }
  if (where.length) sql += ` WHERE ` + where.join(" AND ");
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(limit);
  const { results } = await db.prepare(sql).bind(...binds).all<{ json: string }>();
  return results.map((r) => JSON.parse(r.json) as Memo);
}

export async function getMemo(db: D1Database, id: string): Promise<Memo | null> {
  const row = await db.prepare(`SELECT json FROM memos WHERE id = ?`).bind(id).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as Memo) : null;
}

export async function putMemo(db: D1Database, memo: Memo): Promise<void> {
  await db
    .prepare(
      `INSERT INTO memos (id, created_at, updated_at, kind, category, json) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, kind = excluded.kind, category = excluded.category, json = excluded.json`,
    )
    .bind(memo.id, memo.createdAt, memo.updatedAt, memo.kind ?? null, memo.category ?? null, JSON.stringify(memo))
    .run();
}

export async function deleteMemo(db: D1Database, id: string): Promise<boolean> {
  const memo = await getMemo(db, id);
  if (!memo) return false;
  const img = (memo.source as { image?: string } | undefined)?.image;
  await db.prepare(`DELETE FROM memos WHERE id = ?`).bind(id).run();
  if (img?.startsWith("img:")) await db.prepare(`DELETE FROM images WHERE id = ?`).bind(img.slice(4)).run();
  return true;
}

export async function countMemos(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM memos`).first<{ n: number }>();
  return row?.n ?? 0;
}

/* ---------- 사진 ---------- */
export async function putImage(db: D1Database, mime: string, data: ArrayBuffer): Promise<string> {
  const id = newId("i");
  await db.prepare(`INSERT INTO images (id, mime, data, created_at) VALUES (?, ?, ?, ?)`).bind(id, mime, data, new Date().toISOString()).run();
  return id;
}
export async function getImage(db: D1Database, id: string): Promise<{ mime: string; data: ArrayBuffer } | null> {
  const row = await db.prepare(`SELECT mime, data FROM images WHERE id = ?`).bind(id).first<{ mime: string; data: ArrayBuffer }>();
  return row ?? null;
}
