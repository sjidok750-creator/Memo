"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { thumbKey, thumbnailCandidates, type ThumbCandidate } from "@/lib/thumbnail";
import type { Lang } from "@/lib/i18n";
import type { Memo } from "@/lib/types";

/**
 * 메모의 대표 이미지를 찾아 준다 (책 표지 · 인물 사진 · 주제 그림).
 *
 * 찾은 주소는 이 기기(localStorage)에 기억해 두므로 같은 것을 다시 찾지 않는다.
 * 메모 자체는 건드리지 않는다 — 이미지는 언제든 다시 찾을 수 있는 정보이고,
 * 화면을 그리는 중에 저장소에 쓰면 기기 사이에서 충돌이 나기 때문이다.
 *
 * 실제로 열리는 주소인지는 <img> 가 판정한다: onError 가 나면 다음 후보로 넘어가고,
 * 열린 주소는 onLoad 에서 유일한 후보로 굳혀 다음부터 한 번에 뜨게 한다.
 * 후보가 다 떨어지면 null 을 돌려주고, 화면은 글자 표지로 돌아간다.
 */

const CACHE_KEY = "memo-thumbs";
/** 표지만 찾던 시절의 기억 (형식이 달라 그냥 지운다) */
const OLD_CACHE_KEY = "memo-book-covers";
/** 찾은 이미지를 기억하는 기간 */
const OK_TTL = 180 * 24 * 3600 * 1000;
/** 못 찾았을 때 다시 찾아보기까지의 기간 (나중에 등록될 수 있다) */
const FAIL_TTL = 7 * 24 * 3600 * 1000;

interface Entry {
  found: ThumbCandidate[];
  at: number;
}

let cache: Record<string, Entry> | null = null;
const inflight = new Map<string, Promise<ThumbCandidate[]>>();

/**
 * 한 번에 찾는 메모 수. 메모가 많을 때 요청을 한꺼번에 쏟아부으면
 * 상대 쪽 요청 한도에 걸려 오히려 이미지를 못 받는다.
 */
const MAX_PARALLEL = 3;
let running = 0;
const waiting: (() => void)[] = [];

async function slot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await run();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function read(): Record<string, Entry> {
  if (cache) return cache;
  try {
    window.localStorage.removeItem(OLD_CACHE_KEY);
    const raw = window.localStorage.getItem(CACHE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function same(a: ThumbCandidate[], b: ThumbCandidate[]): boolean {
  return a.length === b.length && a.every((c, i) => c.url === b[i].url);
}

function write(key: string, found: ThumbCandidate[]) {
  const c = read();
  // 같은 내용이면 그냥 둔다 (카드마다 저장소를 다시 쓰지 않게)
  if (c[key] && same(c[key].found, found)) return;
  c[key] = { found, at: Date.now() };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* 저장 공간이 없어도 이번 화면에는 이미지가 뜬다 */
  }
}

function fresh(e: Entry | undefined): ThumbCandidate[] | null {
  if (!e || !Array.isArray(e.found)) return null;
  const ttl = e.found.length ? OK_TTL : FAIL_TTL;
  return Date.now() - e.at < ttl ? e.found : null;
}

export interface MemoThumb {
  src: string;
  /** 어디서 찾은 것인지 (상세 화면의 출처 표시에 쓴다) */
  source: ThumbCandidate["source"];
  /** 이 주소가 안 열렸다 → 다음 후보로 */
  onError: () => void;
  /** 이 주소가 열렸다 → 이걸로 굳힌다 */
  onLoad: () => void;
}

export function useMemoThumb(memo: Memo | null | undefined, lang: Lang): MemoThumb | null {
  // 영상은 영상 썸네일이, 사진은 사진 자체가 이미 있다
  const wanted = memo?.kind === "book";
  const title = memo?.title ?? "";
  const author = memo?.meta.author ?? null;
  const publisher = memo?.meta.publisher ?? null;
  const year = memo?.meta.year ?? null;
  const isbn = memo?.meta.isbn ?? null;
  const tags = (memo?.tags ?? []).join("\u0000");
  const key = wanted ? thumbKey({ title, author }) : "";
  const [found, setFound] = useState<ThumbCandidate[] | null>(null);
  const [i, setI] = useState(0);
  const keyRef = useRef(key);

  useEffect(() => {
    if (!wanted || !title.trim()) return;
    keyRef.current = key;
    setI(0);

    const cached = fresh(read()[key]);
    if (cached) {
      setFound(cached);
      return;
    }
    setFound(null);

    // 찾는 일은 중간에 끊지 않는다. 카드가 사라졌다고 멈추면 "이미지 없음" 으로
    // 잘못 기억해 버리고, 같은 것을 여는 다른 화면도 같이 손해를 본다.
    // (각 요청에는 이미 시간 제한이 걸려 있다.)
    let alive = true;
    let job = inflight.get(key);
    if (!job) {
      const ref = { title, author, publisher, year, isbn, tags: tags ? tags.split("\u0000") : [], lang };
      job = slot(() => thumbnailCandidates(ref)).then(({ candidates, unreachable }) => {
        // 아예 닿지 못했으면 기억하지 않는다 — 다음에 다시 찾아본다
        if (!unreachable) write(key, candidates);
        inflight.delete(key);
        return candidates;
      });
      inflight.set(key, job);
    }
    void job.then((c) => {
      if (alive && keyRef.current === key) setFound(c);
    });

    return () => {
      alive = false;
    };
  }, [wanted, key, title, author, publisher, year, isbn, tags, lang]);

  const onError = useCallback(() => {
    setI((n) => {
      // 기기가 offline 이면 주소가 나쁜 게 아니라 지금 못 받는 것이다 → 기억하지 않는다
      if (navigator.onLine !== false) write(keyRef.current, (found ?? []).slice(n + 1));
      return n + 1;
    });
  }, [found]);

  const onLoad = useCallback(() => {
    const hit = found?.[i];
    if (hit) write(keyRef.current, [hit]);
  }, [found, i]);

  if (!wanted || !found || i >= found.length) return null;
  return { src: found[i].url, source: found[i].source, onError, onLoad };
}
