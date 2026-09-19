"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { formatDate, kindLabel, memoToMarkdown } from "@/lib/format";
import { renderInline, renderRich } from "@/lib/richtext";
import type { CategoryId, Memo } from "@/lib/types";
import { DEMO, imageSrc } from "@/lib/demo";
import { clientStore } from "@/lib/store-client";
import { KindIcon } from "./MemoCard";
import { useMemos } from "./MemoProvider";
import { useMemoThumb } from "./useMemoThumb";
import { IconArrowLeft, IconCheck, IconCopy, IconEdit, IconLink, IconPlay, IconRefresh, IconTrash, IconX } from "./Icons";

export function MemoDetail({ id }: { id: string }) {
  const router = useRouter();
  const { memos, loading, upsert, remove, patch, toast, lang, t, job, startJob, cancelJob } = useMemos();
  const [fetched, setFetched] = useState<Memo | null | undefined>(undefined);
  const memo = memos.find((m) => m.id === id) ?? fetched ?? null;
  const thumb = useMemoThumb(memo, lang);
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string | null>(null);
  const redo = job && job.replace === id ? job : null;
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [thoughtsState, setThoughtsState] = useState<"idle" | "saving" | "saved">("idle");
  const thoughtsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thoughtsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setThoughts(null);
    setThoughtsState("idle");
    setEditTitle(null);
    setEditTags(null);
  }, [id]);

  useEffect(() => {
    if (memos.some((m) => m.id === id)) return;
    if (DEMO) {
      let alive = true;
      void clientStore.get(id, lang).then((m) => alive && setFetched(m));
      return () => {
        alive = false;
      };
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
  }, [id, memos, upsert, lang]);

  if (!memo) {
    if (loading || fetched === undefined) return <div className="notfound">{t("detail.loading")}</div>;
    return (
      <div className="notfound">
        <p>{t("detail.notFound")}</p>
        <Link href="/" className="btn">
          <IconArrowLeft /> {t("detail.back")}
        </Link>
      </div>
    );
  }

  const cat = categoryOf(memo.category);
  const c = { "--c": `light-dark(${cat.color}, ${cat.dark})` } as React.CSSProperties;

  const onDelete = async () => {
    if (!window.confirm(t("detail.deleteConfirm"))) return;
    await remove(memo.id);
    toast(t("detail.deleted"));
    router.push("/");
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoToMarkdown(memo, lang));
      toast(t("detail.copied"));
    } catch {
      toast(t("detail.copyFailed"));
    }
  };
  const saveTitle = async () => {
    const v = (editTitle ?? "").trim();
    setEditTitle(null);
    if (!v || v === memo.title) return;
    const ok = await patch(memo.id, { title: v });
    toast(ok ? t("detail.titleChanged") : t("detail.saveFailed"));
  };
  const saveTags = async () => {
    const tags = (editTags ?? "")
      .split(/[,、\s#]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12);
    setEditTags(null);
    if (tags.join("|") === memo.tags.join("|")) return;
    const ok = await patch(memo.id, { tags });
    toast(ok ? t("detail.tagsChanged") : t("detail.saveFailed"));
  };
  const onRedo = () => {
    if (job) return;
    if (!window.confirm(t("detail.redoConfirm"))) return;
    startJob({ kind: memo.kind, replace: memo.id, lang }, memo.title);
  };
  const onThoughts = (v: string) => {
    setThoughts(v);
    setThoughtsState("saving");
    if (thoughtsTimer.current) clearTimeout(thoughtsTimer.current);
    thoughtsTimer.current = setTimeout(async () => {
      const ok = await patch(memo.id, { thoughts: v });
      setThoughtsState(ok ? "saved" : "idle");
      if (!ok) toast(t("detail.saveFailed"));
    }, 700);
  };
  const onCategory = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as CategoryId;
    const ok = await patch(memo.id, { category: next });
    toast(ok ? t("detail.categoryChanged", { name: categoryOf(next).label[lang] }) : t("detail.saveFailed"));
  };

  const sourceBits: React.ReactNode[] = [];
  if (memo.kind === "book") {
    if (memo.meta.author) sourceBits.push(<span key="a">{memo.meta.author}</span>);
    if (memo.meta.publisher) sourceBits.push(<span key="p">{memo.meta.publisher}</span>);
    if (memo.meta.year) sourceBits.push(<span key="y">{memo.meta.year}</span>);
    if (!sourceBits.length && memo.source.query) sourceBits.push(<span key="q">{t("detail.query", { q: memo.source.query })}</span>);
  } else if (memo.kind === "youtube") {
    if (memo.meta.channel) sourceBits.push(<span key="ch">{memo.meta.channel}</span>);
    if (memo.meta.author && memo.meta.author !== memo.meta.channel) sourceBits.push(<span key="a">{memo.meta.author}</span>);
    if (memo.source.url)
      sourceBits.push(
        <a key="u" href={memo.source.url} target="_blank" rel="noreferrer">
          <IconLink /> {t("detail.watch")}
        </a>,
      );
  } else if (memo.source.note) {
    sourceBits.push(<span key="n">{t("detail.myNote", { note: memo.source.note })}</span>);
  }

  return (
    <article className="article">
      <div className="article-bar">
        <Link href="/" className="btn ghost sm">
          <IconArrowLeft size={15} /> {t("detail.back")}
        </Link>
        <div className="article-actions">
          <button className="btn ghost sm" onClick={onRedo} disabled={Boolean(redo)} title={t("detail.redoTitle")}>
            <IconRefresh size={15} className={redo ? "spin" : undefined} /> {t("detail.redo")}
          </button>
          <button className="btn ghost sm" onClick={onCopy}>
            <IconCopy size={15} /> {t("detail.copy")}
          </button>
          <button className="btn ghost sm danger" onClick={onDelete}>
            <IconTrash size={15} /> {t("detail.delete")}
          </button>
        </div>
      </div>

      <div className="article-meta">
        <span className="kind">
          <KindIcon kind={memo.kind} size={14} />
          {kindLabel(memo.kind, lang)}
        </span>
        <select className="select-chip" style={c} value={memo.category} onChange={onCategory} aria-label={t("detail.changeCategory")}>
          {CATEGORIES.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label[lang]}
            </option>
          ))}
        </select>
        <time dateTime={memo.createdAt}>{formatDate(memo.createdAt, lang)}</time>
      </div>

      {redo && (
        <div className="redo-bar" role="status">
          <span className="ring sm" /> {redo.stage ? t(`stage.${redo.stage}`) : t("detail.preparing")}…
          <button className="btn ghost sm" onClick={cancelJob}>
            {t("detail.cancel")}
          </button>
        </div>
      )}

      {editTitle === null ? (
        <h1 className="editable" onClick={() => setEditTitle(memo.title)} title={t("detail.editTitle")}>
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
          />
          <button className="btn sm primary" onClick={() => void saveTitle()}>
            <IconCheck /> {t("detail.save")}
          </button>
          <button className="btn ghost sm" onClick={() => setEditTitle(null)} aria-label={t("detail.cancel")}>
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
      {memo.kind === "book" && thumb && (
        <div className="hero book">
          <img className="thumb-blur" src={thumb.src} alt="" aria-hidden />
          <img
            className="thumb-img"
            src={thumb.src}
            alt={t(thumb.source === "book" ? "card.cover" : "card.thumb")}
            onLoad={thumb.onLoad}
            onError={thumb.onError}
          />
          {thumb.source === "wikipedia" && <span className="thumb-credit">{t("card.viaWikipedia")}</span>}
        </div>
      )}

      <div className="callout">{memo.oneLiner}</div>

      <section className="section">
        <div className="section-label">{t("detail.summary")}</div>
        <div className="prose">{renderRich(memo.summary)}</div>
      </section>

      {memo.keyPoints.length > 0 && (
        <section className="section">
          <div className="section-label">{t("detail.points")}</div>
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
          <div className="section-label">{t(`detail.quotes.${memo.kind}`)}</div>
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
          {t("detail.tags")}
          {editTags === null && (
            <button className="link-btn" onClick={() => setEditTags(memo.tags.join(", "))}>
              <IconEdit size={12} /> {t("detail.edit")}
            </button>
          )}
        </div>
        {editTags === null ? (
          <div className="tags-row">
            {memo.tags.length ? (
              memo.tags.map((x) => (
                <span key={x} className="tag">
                  {x}
                </span>
              ))
            ) : (
              <span className="muted">{t("detail.noTags")}</span>
            )}
          </div>
        ) : (
          <div className="title-edit">
            <input
              autoFocus
              value={editTags}
              placeholder={t("detail.tagsPlaceholder")}
              onChange={(e) => setEditTags(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void saveTags();
                if (e.key === "Escape") setEditTags(null);
              }}
            />
            <button className="btn sm primary" onClick={() => void saveTags()}>
              <IconCheck /> {t("detail.save")}
            </button>
            <button className="btn ghost sm" onClick={() => setEditTags(null)} aria-label={t("detail.cancel")}>
              <IconX />
            </button>
          </div>
        )}
      </section>

      <section className="section thoughts">
        <div className="section-label">
          {t("thoughts.title")}
          <span className="thoughts-state">{thoughtsState === "saving" ? t("thoughts.saving") : thoughtsState === "saved" ? t("thoughts.saved") : ""}</span>
        </div>
        <textarea
          ref={thoughtsRef}
          className="thoughts-box"
          placeholder={t("thoughts.placeholder")}
          value={thoughts ?? memo.thoughts ?? ""}
          onChange={(e) => onThoughts(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.max(120, el.scrollHeight)}px`;
          }}
          rows={4}
        />
      </section>

      <footer className="footnote">
        <span className={`confidence ${memo.confidence}`}>
          <i /> {t(`detail.conf.${memo.confidence}`)}
          {memo.kind === "youtube" && memo.source.transcript === false && ` · ${t("detail.noTranscript")}`}
        </span>
        <span>{memo.model === "claude-app" ? t("detail.viaApp") : memo.model && memo.model !== "demo" ? `Claude ${memo.model}` : DEMO ? t("detail.example") : ""}</span>
      </footer>
    </article>
  );
}
