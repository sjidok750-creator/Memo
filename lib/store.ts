import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import type { Memo } from "./types";

const DATA_DIR = process.env.MEMO_DATA_DIR ? path.resolve(process.env.MEMO_DATA_DIR) : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "memos.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

interface Db {
  memos: Memo[];
}

// 파일 접근을 직렬화하는 아주 단순한 잠금
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Db>;
    return { memos: Array.isArray(parsed.memos) ? parsed.memos : [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { memos: [] };
    throw err;
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

export function newId(): string {
  return `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}

export async function listMemos(): Promise<Memo[]> {
  const db = await readDb();
  return db.memos.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getMemo(id: string): Promise<Memo | null> {
  const db = await readDb();
  return db.memos.find((m) => m.id === id) ?? null;
}

export async function findByVideoId(videoId: string): Promise<Memo | null> {
  const db = await readDb();
  return db.memos.find((m) => m.kind === "youtube" && m.source.videoId === videoId) ?? null;
}

export async function createMemo(memo: Memo): Promise<Memo> {
  return locked(async () => {
    const db = await readDb();
    db.memos.push(memo);
    await writeDb(db);
    return memo;
  });
}

export async function updateMemo(id: string, patch: Partial<Memo>): Promise<Memo | null> {
  return locked(async () => {
    const db = await readDb();
    const idx = db.memos.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const updated: Memo = { ...db.memos[idx], ...patch, id, updatedAt: new Date().toISOString() };
    db.memos[idx] = updated;
    await writeDb(db);
    return updated;
  });
}

export async function deleteMemo(id: string): Promise<Memo | null> {
  return locked(async () => {
    const db = await readDb();
    const idx = db.memos.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const [removed] = db.memos.splice(idx, 1);
    await writeDb(db);
    if (removed.source.image) {
      await fs.unlink(path.join(UPLOAD_DIR, removed.source.image)).catch(() => undefined);
    }
    return removed;
  });
}

/** data URL 을 uploads/ 에 저장하고 파일 이름을 돌려준다 */
export async function saveImage(dataUrl: string): Promise<{ file: string; mediaType: string; base64: string }> {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new Error("지원하지 않는 이미지 형식입니다 (jpeg, png, webp, gif)");
  const mediaType = m[1];
  const base64 = m[2].replace(/\s/g, "");
  const ext = mediaType === "image/jpeg" ? "jpg" : mediaType.split("/")[1];
  const file = `${newId()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, file), Buffer.from(base64, "base64"));
  return { file, mediaType, base64 };
}

/** 저장된 사진을 data URL 로 (백업용) */
export async function readImageAsDataUrl(file: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, file));
    const ext = file.split(".").pop()!.toLowerCase();
    const mediaType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    return `data:${mediaType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** 백업 파일의 메모들을 합친다. 같은 id 가 이미 있으면 건너뛴다. 사진은 data URL 에서 복원한다. */
export async function importMemos(incoming: Memo[]): Promise<{ added: number; skipped: number }> {
  return locked(async () => {
    const db = await readDb();
    const have = new Set(db.memos.map((m) => m.id));
    let added = 0;
    let skipped = 0;
    for (const raw of incoming) {
      if (!raw || typeof raw.id !== "string" || have.has(raw.id)) {
        skipped++;
        continue;
      }
      const memo: Memo = { ...raw, source: { ...raw.source } };
      const data = (memo.source as { imageData?: string }).imageData;
      delete (memo.source as { imageData?: string }).imageData;
      if (data) {
        try {
          memo.source.image = (await saveImage(data)).file;
        } catch {
          memo.source.image = undefined;
        }
      }
      db.memos.push(memo);
      have.add(memo.id);
      added++;
    }
    await writeDb(db);
    return { added, skipped };
  });
}
