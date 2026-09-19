"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { formatDate, KIND_LABEL, memoToMarkdown } from "@/lib/format";
import { renderInline, renderRich } from "@/lib/richtext";
import type { CategoryId, Memo } from "@/lib/types";
import { DEMO, demoCapture, demoStore, imageSrc } from "@/lib/demo";
import { captureStream } from "@/lib/capture-client";
import { friendlyError } from "@/lib/errors";
import { KindIcon } from "./MemoCard";
import { useMemos } from "./MemoProvider";
import { IconArrowLeft, IconCheck, IconCopy, IconEdit, IconLink, IconPlay, IconRefresh, IconTrash, IconX } from "./Icons";

export function MemoDetail({ id }: { id: string }) {
  const router = useRouter();
  const { memos, loading, upsert, remove, patch, toast } = useMemos();
  const [fetched, setFetched] = useState<Memo | null | undefined>(undefined);
  const memo = memos.find((m) => m.id === id) ?? fetched ?? null;
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string | null>(null);
  const [redo, setRedo] = useState<{ label: string } | null>(null);
  const redoAbort = useRef<AbortController | null>(null);

  // 새로고침으로 바로 들어온 경우 목록보다 먼저 한 장만 가져온다
  useEffect(() => {
    if (memos.some((m) => m.id === id)) return;
    if (DEMO) {
      setFetched(demoStore.get(id));
      return;
    }
    let alive = true;
    fetch(`/api/memos/${id}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { memo: Memo }).memo : null))
      .then((m) => {
        if (!alive) return;
        setFetched(m);
        if (m) upsert(m);
      })
      .catch(() => alive && setFetched(null));
    return () => {
      alive = false;
    };
  }, [id, memos, upsert]);

  if (!memo) {
    if (loading || fetched === undefined) return <div className="notfound">불러오는 중…</div>;
    return (
      <div className="notfound">
        <p>메모를 찾을 수 없어요.</p>
        <Link href="/" className="btn">
          <IconArrowLeft /> 목록으로
        </Link>
      </div>
    );
  }

  const cat = categoryOf(memo.category);
  const c = { "--c": `light-dark(${cat.color}, ${cat.dark})` } as React.CSSProperties;

  const onDelete = async () => {
    if (!window.confirm("이 메모를 삭제할까요? 되돌릴 수 없어요.")) return;
    await remove(memo.id);
    toast("삭제했어요");
    router.push("/");
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoToMarkdown(memo));
      toast("마크다운으로 복사했어요");
    } catch {
      toast("복사에 실패했어요");
    }
  };
  const saveTitle = async () => {
    const t = (editTitle ?? "").trim();
    setEditTitle(null);
    if (!t || t === memo.title) return;
    const ok = await patch(memo.id, { title: t });
    toast(ok ? "제목을 바꿨어요" : "저장하지 못했어요");
  };
  const saveTags = async () => {
    const tags = (editTags ?? "")
      .split(/[,\s#]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
    setEditTags(null);
    if (tags.join("|") === memo.tags.join("|")) return;
    const ok = await patch(memo.id, { tags });
    toast(ok ? "태그를 바꿨어요" : "저장하지 못했어요");
  };
  const onRedo = async () => {
    if (redo) return;
    if (!window.confirm("지금 요약을 버리고 처음부터 다시 요약할까요? 제목·태그·분야도 새로 정해져요.")) return;
    const ctrl = new AbortController();
    redoAbort.current = ctrl;
    setRedo({ label: "준비 중" });
    try {
      if (DEMO) {
        const updated = await demoCapture({ kind: memo.kind, replace: memo.id }, (ev) => ev.type === "stage" && setRedo({ label: ev.label }), ctrl.signal);
        upsert(updated);
      } else {
        await captureStream(
          { kind: memo.kind, replace: memo.id },
          (ev) => {
            if (ev.type === "stage") setRedo({ label: ev.label });
            else if (ev.type === "done") upsert(ev.memo);
          },
          ctrl.signal,
        );
      }
      toast("다시 요약했어요");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast(DEMO ? friendlyError(e) : (e as Error).message);
    } finally {
      setRedo(null);
      redoAbort.current = null;
    }
  };
  const onCategory = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as CategoryId;
    const ok = await patch(memo.id, { category: next });
    toast(ok ? `분야를 '${categoryOf(next).label}'(으)로 바꿨어요` : "저장하지 못했어요");
  };

  const sourceBits: React.ReactNode[] = [];
  if (memo.kind === "book") {
    if (memo.meta.author) sourceBits.push(<span key="a">{memo.meta.author}</span>);
    if (memo.meta.publisher) sourceBits.push(<span key="p">{memo.meta.publisher}</span>);
    if (memo.meta.year) sourceBits.push(<span key="y">{memo.meta.year}</span>);
    if (!sourceBits.length && memo.source.query) sourceBits.push(<span key="q">검색어 “{memo.source.query}”</span>);
  } else if (memo.kind === "youtube") {
    if (memo.meta.channel) sourceBits.push(<span key="ch">{memo.meta.channel}</span>);
    if (memo.meta.author && memo.meta.author !== memo.meta.channel) sourceBits.push(<span key="a">{memo.meta.author}</span>);
    if (memo.source.url)
      sourceBits.push(
        <a key="u" href={memo.source.url} target="_blank" rel="noreferrer">
          <IconLink /> 영상 보기
        </a>,
      );
  } else if (memo.source.note) {
    sourceBits.push(<span key="n">내 메모: {memo.source.note}</span>);
  }

  return (
    <article className="article">
      <div className="article-bar">
        <Link href="/" className="btn ghost sm">
          <IconArrowLeft size={15} /> 목록으로
        </Link>
        <div className="article-actions">
          <button className="btn ghost sm" onClick={onRedo} disabled={Boolean(redo)} title="같은 원본으로 요약을 새로 만듭니다">
            <IconRefresh size={15} className={redo ? "spin" : undefined} /> 다시 요약
          </button>
          <button className="btn ghost sm" onClick={onCopy}>
            <IconCopy size={15} /> 복사
          </button>
          <button className="btn ghost sm danger" onClick={onDelete}>
            <IconTrash size={15} /> 삭제
          </button>
        </div>
      </div>

      <div className="article-meta">
        <span className="kind">
          <KindIcon kind={memo.kind} size={14} />
          {KIND_LABEL[memo.kind]}
        </span>
        <select className="select-chip" style={c} value={memo.category} onChange={onCategory} aria-label="분야 바꾸기">
          {CATEGORIES.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <time dateTime={memo.createdAt}>{formatDate(memo.createdAt)}</time>
      </div>

      {redo && (
        <div className="redo-bar" role="status">
          <span className="ring sm" /> {redo.label}…
          <button className="btn ghost sm" onClick={() => redoAbort.current?.abort()}>
            취소
          </button>
        </div>
      )}

      {editTitle === null ? (
        <h1 className="editable" onClick={() => setEditTitle(memo.title)} title="눌러서 제목 고치기">
          {memo.title}
          <IconEdit size={16} className="edit-hint" />
        </h1>
      ) : (
        <div className="title-edit">
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void saveTitle();
              if (e.key === "Escape") setEditTitle(null);
            }}
            aria-label="제목"
          />
          <button className="btn sm primary" onClick={() => void saveTitle()}>
            <IconCheck /> 저장
          </button>
          <button className="btn ghost sm" onClick={() => setEditTitle(null)} aria-label="취소">
            <IconX />
          </button>
        </div>
      )}
      {sourceBits.length > 0 && (
        <div className="source-line">
          {sourceBits.map((b, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span className="sep">·</span>}
              {b}
            </span>
          ))}
        </div>
      )}

      {memo.kind === "youtube" && memo.source.thumbnail && (
        <a className="hero" href={memo.source.url ?? "#"} target={memo.source.url ? "_blank" : undefined} rel="noreferrer" style={{ display: "block" }}>
          <img
            src={imageSrc(memo.source.thumbnail.replace("hqdefault", "maxresdefault"))}
            onError={(e) => {
              const img = e.currentTarget;
              const fallback = imageSrc(memo.source.thumbnail!);
              if (!img.src.endsWith(fallback)) img.src = fallback;
              else img.classList.add("broken");
            }}
            alt=""
          />
          <div className="play">
            <span>
              <IconPlay size={28} />
            </span>
          </div>
        </a>
      )}
      {memo.kind === "photo" && memo.source.image && (
        <div className="hero photo">
          <img src={imageSrc(memo.source.image)} alt={memo.title} />
        </div>
      )}

      <div className="callout">{memo.oneLiner}</div>

      <section className="section">
        <div className="section-label">핵심 요약</div>
        <div className="prose">{renderRich(memo.summary)}</div>
      </section>

      {memo.keyPoints.length > 0 && (
        <section className="section">
          <div className="section-label">주요 포인트</div>
          <ol className="points">
            {memo.keyPoints.map((p, i) => (
              <li key={i}>
                <span>{renderInline(p)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {memo.quotes.length > 0 && (
        <section className="section">
          <div className="section-label">{memo.kind === "book" ? "명대사 · 명문장" : memo.kind === "youtube" ? "인상적인 말" : "사진 속 문장"}</div>
          <div className="quotes">
            {memo.quotes.map((q, i) => (
              <blockquote key={i} className="quote">
                <p>{renderInline(q.text)}</p>
                {q.note && <div className="note">— {q.note}</div>}
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-label">
          태그
          {editTags === null && (
            <button className="link-btn" onClick={() => setEditTags(memo.tags.join(", "))}>
              <IconEdit size={12} /> 편집
            </button>
          )}
        </div>
        {editTags === null ? (
          <div className="tags-row">
            {memo.tags.length ? (
              memo.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))
            ) : (
              <span className="muted">태그가 없어요</span>
            )}
          </div>
        ) : (
          <div className="title-edit">
            <input
              autoFocus
              value={editTags}
              placeholder="쉼표로 구분 (예: 습관, 집중)"
              onChange={(e) => setEditTags(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void saveTags();
                if (e.key === "Escape") setEditTags(null);
              }}
              aria-label="태그"
            />
            <button className="btn sm primary" onClick={() => void saveTags()}>
              <IconCheck /> 저장
            </button>
            <button className="btn ghost sm" onClick={() => setEditTags(null)} aria-label="취소">
              <IconX />
            </button>
          </div>
        )}
      </section>

      <footer className="footnote">
        <span className={`confidence ${memo.confidence}`}>
          <i /> {memo.confidence === "high" ? "원문을 직접 읽고 정리" : memo.confidence === "medium" ? "검색 자료를 바탕으로 정리" : "확인이 부족한 내용 포함"}
          {memo.kind === "youtube" && memo.source.transcript === false && " · 자막 없음"}
        </span>
        <span>{memo.model && memo.model !== "demo" ? `Claude ${memo.model}` : DEMO ? "예시 메모" : ""}</span>
      </footer>
    </article>
  );
}
