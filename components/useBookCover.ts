"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bookCoverCandidates, coverKey } from "@/lib/book-cover";
import type { Memo } from "@/lib/types";

/**
 * 책 메모의 표지를 찾아 준다.
 *
 * 찾은 주소는 이 기기(localStorage)에 기억해 두므로 같은 책을 다시 찾지 않는다.
 * 메모 자체는 건드리지 않는다 — 표지는 언제든 다시 찾을 수 있는 정보이고,
 * 화면을 그리는 중에 저장소에 쓰면 기기 사이에서 충돌이 나기 때문이다.
 *
 * 실제로 열리는 주소인지는 <img> 가 판정한다: onError 가 나면 다음 후보로 넘어가고,
 * 열린 주소는 onLoad 에서 유일한 후보로 굳혀 다음부터 한 번에 뜨게 한다.
 * 후보가 다 떨어지면 null 을 돌려주고, 화면은 글자 표지로 돌아간다.
 */

const CACHE_KEY = "memo-book-covers";
/** 찾은 표지를 기억하는 기간 */
const OK_TTL = 180 * 24 * 3600 * 1000;
/** 못 찾았을 때 다시 찾아보기까지의 기간 (나중에 표지가 등록될 수 있다) */
const FAIL_TTL = 7 * 24 * 3600 * 1000;

interface Entry {
  urls: string[];
  at: number;
}

let cache: Record<string, Entry> | null = null;
const inflight = new Map<string, Promise<string[]>>();

/**
 * 한 번에 찾는 책 수. 메모가 많을 때 요청을 한꺼번에 쏟아부으면
 * 상대 쪽 요청 한도에 걸려 오히려 표지를 못 받는다.
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
    const raw = window.localStorage.getItem(CACHE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(key: string, urls: string[]) {
  const c = read();
  const before = c[key];
  // 같은 내용이면 그냥 둔다 (카드마다 저장소를 다시 쓰지 않게)
  if (before && before.urls.length === urls.length && before.urls.every((u, n) => u === urls[n])) return;
  c[key] = { urls, at: Date.now() };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* 저장 공간이 없어도 이번 화면에는 표지가 뜬다 */
  }
}

function fresh(e: Entry | undefined): string[] | null {
  if (!e) return null;
  const ttl = e.urls.length ? OK_TTL : FAIL_TTL;
  return Date.now() - e.at < ttl ? e.urls : null;
}

export interface BookCover {
  src: string;
  /** 이 주소가 안 열렸다 → 다음 후보로 */
  onError: () => void;
  /** 이 주소가 열렸다 → 이걸로 굳힌다 */
  onLoad: () => void;
}

export function useBookCover(memo: Memo | null | undefined): BookCover | null {
  const isBook = memo?.kind === "book";
  const title = memo?.title ?? "";
  const author = memo?.meta.author ?? null;
  const isbn = memo?.meta.isbn ?? null;
  const key = isBook ? coverKey({ title, author }) : "";
  const [urls, setUrls] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const keyRef = useRef(key);

  useEffect(() => {
    if (!isBook || !title.trim()) return;
    keyRef.current = key;
    setI(0);

    const cached = fresh(read()[key]);
    if (cached) {
      setUrls(cached);
      return;
    }
    setUrls(null);

    // 찾는 일은 중간에 끊지 않는다. 카드가 사라졌다고 멈추면 "표지 없음" 으로
    // 잘못 기억해 버리고, 같은 책을 여는 다른 화면도 같이 손해를 본다.
    // (각 요청에는 이미 시간 제한이 걸려 있다.)
    let alive = true;
    let job = inflight.get(key);
    if (!job) {
      job = slot(() => bookCoverCandidates({ title, author, isbn })).then(({ urls: found, unreachable }) => {
        // 아예 닿지 못했으면 기억하지 않는다 — 다음에 다시 찾아본다
        if (!unreachable) write(key, found);
        inflight.delete(key);
        return found;
      });
      inflight.set(key, job);
    }
    void job.then((found) => {
      if (alive && keyRef.current === key) setUrls(found);
    });

    return () => {
      alive = false;
    };
  }, [isBook, key, title, author, isbn]);

  const onError = useCallback(() => {
    setI((n) => {
      // 기기가 offline 이면 주소가 나쁜 게 아니라 지금 못 받는 것이다 → 기억하지 않는다
      if (navigator.onLine !== false) write(keyRef.current, (urls ?? []).slice(n + 1));
      return n + 1;
    });
  }, [urls]);

  const onLoad = useCallback(() => {
    const src = urls?.[i];
    if (src) write(keyRef.current, [src]);
  }, [urls, i]);

  if (!isBook || !urls || i >= urls.length) return null;
  return { src: urls[i], onError, onLoad };
}
